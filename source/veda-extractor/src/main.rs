#[macro_use]
extern crate log;

use v_api::IndvOp;
use v_exim::*;
use v_module::info::ModuleInfo;
use v_module::module::*;
use v_module::onto::*;
use v_onto::datatype::*;
use v_onto::individual::*;
use v_onto::individual2msgpack::*;
use v_onto::onto::*;
use v_queue::consumer::*;
use v_queue::queue::*;
use v_queue::record::*;

pub struct Context {
    onto: Onto,
    db_id: String,
    queue_out: Queue,
}

fn main() -> Result<(), i32> {
    init_log();

    let mut module = Module::default();

    let mut db_id = get_db_id(&mut module);
    if db_id.is_none() {
        db_id = create_db_id(&mut module);

        if db_id.is_none() {
            error!("fail create Database Identification");
            return Ok(());
        }
    }

    let mut onto = Onto::default();

    info!("load onto start");
    load_onto(&mut module.fts, &mut module.storage, &mut onto);
    info!("load onto end");

    let module_info = ModuleInfo::new("./data", "extract", true);
    if module_info.is_err() {
        error!("{:?}", module_info.err());
        return Err(-1);
    }

    //wait_load_ontology();

    let queue_out = Queue::new("./data/out", "extract", Mode::ReadWrite).expect("!!!!!!!!! FAIL QUEUE");
    let mut queue_consumer = Consumer::new("./data/queue", "extract", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");

    let mut ctx = Context {
        onto,
        db_id: db_id.unwrap(),
        queue_out,
    };

    module.listen_queue(
        &mut queue_consumer,
        &mut module_info.unwrap(),
        &mut ctx,
        &mut (before_batch as fn(&mut Module, &mut Context, batch_size: u32) -> Option<u32>),
        &mut (prepare as fn(&mut Module, &mut ModuleInfo, &mut Context, &mut Individual) -> Result<(), PrepareError>),
        &mut (after_batch as fn(&mut Module, &mut Context, prepared_batch_size: u32)),
    );
    Ok(())
}

fn before_batch(_module: &mut Module, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Module, _ctx: &mut Context, _prepared_batch_size: u32) {}

fn prepare(module: &mut Module, _module_info: &mut ModuleInfo, ctx: &mut Context, queue_element: &mut Individual) -> Result<(), PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("cmd is none");
        return Ok(());
    }

    let mut prev_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    let date = queue_element.get_first_integer("date");
    if date.is_none() {
        return Err(PrepareError::Fatal);
    }

    let exportable = is_exportable(module, ctx, &mut prev_state, &mut new_state);

    if exportable.is_none() {
        return Ok(());
    }
    let exportable = exportable.unwrap();

    if let Err(e) = add_to_queue(&mut ctx.queue_out, cmd.unwrap(), &mut new_state, &queue_element.get_id(), &ctx.db_id, &exportable, date.unwrap_or_default()) {
        error!("fail prepare message, err={:?}", e);
        return Err(PrepareError::Fatal);
    }

    Ok(())
}

fn is_exportable(module: &mut Module, ctx: &mut Context, _prev_state_indv: &mut Individual, new_state_indv: &mut Individual) -> Option<String> {
    if new_state_indv.get_first_literal("sys:source").is_some() {
        return None;
    }

    if let Some(types) = new_state_indv.get_literals("rdf:type") {
        for itype in types {
            // для всех потребителей выгружаем элемент орг струкутры не имеющий поля [sys:source]
            if ctx.onto.is_some_entered(&itype, &["v-s:OrganizationUnit"]) {
                return Some("*".to_owned());
            }

            // выгрузка person
            if itype == "v-s:Person" {
                return Some("*".to_owned());
            }

            // выгрузка прав если они содержат ссылку на внешнего индивида
            if itype == "v-s:PermissionStatement" {
                if let Some(src) = module.get_literal_of_link(new_state_indv, "v-s:permissionSubject", "sys:source", &mut Individual::default()) {
                    return Some(src);
                }
            }

            // выгрузка формы решения у которого в поле [v-wf:to] находится индивид из другой системы
            // и в поле [v-wf:onDocument] должен находится документ типа gen:InternalDocument
            if itype == "v-wf:DecisionForm" {
                if let Some(d) = new_state_indv.get_first_literal("v-wf:onDocument") {
                    let mut doc = Individual::default();

                    if !module.storage.get_individual(&d, &mut doc) {
                        error!("fail read {} (v-wf:onDocument)", d);
                        return None;
                    }

                    if let Some(t) = doc.get_first_literal("rdf:type") {
                        if t == "gen:InternalDocument" || t == "gen:Contract" {
                            if let Some(src) = module.get_literal_of_link(new_state_indv, "v-wf:to", "sys:source", &mut Individual::default()) {
                                for predicate in doc.get_predicates_of_type(DataType::Uri) {
                                    if predicate == "v-s:lastEditor" || predicate == "v-s:creator" || predicate == "v-s:initiator" {
                                        continue;
                                    }
                                    let mut linked_doc = Individual::default();
                                    if let Some(p) = module.get_literal_of_link(&mut doc, &predicate, "v-s:parent", &mut linked_doc) {
                                        if p == doc.get_id() {
                                            if let Err(e) = add_to_queue(&mut ctx.queue_out, IndvOp::Put, &mut linked_doc, "?", &ctx.db_id, &src, 0) {
                                                error!("fail add to queue, err={:?}", e);
                                                return None;
                                            }
                                        }
                                    }
                                }

                                if let Err(e) = add_to_queue(&mut ctx.queue_out, IndvOp::Put, &mut doc, "?", &ctx.db_id, &src, 0) {
                                    error!("fail add to queue, err={:?}", e);
                                    return None;
                                }

                                return Some(src);
                            }
                        }
                    }
                }
            }

            // выгрузка принятого решения у которого в поле [v-s:lastEditor] находится индивид из другой системы
            if ctx.onto.is_some_entered(&itype, &["v-wf:Decision"]) {
                if let Some(src) = module.get_literal_of_link(new_state_indv, "v-s:backwardTarget", "sys:source", &mut Individual::default()) {
                    return Some(src);
                }
            }
        }
    }

    None
}

fn add_to_queue(queue_out: &mut Queue, cmd: IndvOp, new_state_indv: &mut Individual, msg_id: &str, source: &str, target: &str, date: i64) -> Result<(), i32> {
    new_state_indv.parse_all();

    let mut raw: Vec<u8> = Vec::new();
    if to_msgpack(&new_state_indv, &mut raw).is_ok() {
        let mut new_indv = Individual::default();
        new_indv.set_id(msg_id);
        new_indv.add_binary("new_state", raw);
        new_indv.add_integer("cmd", cmd as i64);
        new_indv.add_integer("date", date);
        new_indv.add_string("source_veda", source, Lang::NONE);
        new_indv.add_string("target_veda", target, Lang::NONE);

        info!("add to export queue: uri={}, source={}, target={}", new_state_indv.get_id(), &source, &target);

        let mut raw1: Vec<u8> = Vec::new();
        if let Err(e) = to_msgpack(&new_indv, &mut raw1) {
            error!("fail serialize, err={:?}", e);
            return Err(-2);
        }
        if let Err(e) = queue_out.push(&raw1, MsgType::Object) {
            error!("fail push into queue, err={:?}", e);
            return Err(-1);
        }
    }
    Ok(())
}
