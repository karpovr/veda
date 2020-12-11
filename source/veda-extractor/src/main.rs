/*
 * Извлекает из текущей очереди [individuals-flow] и производит проверку
 * следует ли выгружать в другую систему. Проверка производится методом
 * is_exportable, если ответ успешный, то происходит запись в очередь
 * ./data/out/extract
 */
#[macro_use]
extern crate log;
#[macro_use]
extern crate lazy_static;

use crate::v8_script::{is_exportable, load_exim_filter_scripts};
use std::{env, thread, time};
use v_api::app::ResultCode;
use v_api::IndvOp;
use v_exim::*;
use v_ft_xapian::xapian_reader::XapianReader;
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
use v_search::common::FTQuery;
use v_storage::remote_indv_r_storage::inproc_storage_manager;
use v_v8::common::ScriptInfoContext;
use v_v8::jsruntime::JsRuntime;
use v_v8::scripts_workplace::ScriptsWorkPlace;

mod v8_script;

pub struct Context<'a> {
    sys_ticket: String,
    db_id: String,
    queue_out: Queue,
    workplace: ScriptsWorkPlace<'a, ScriptInfoContext>,
    xr: XapianReader,
    onto: Onto,
}

fn main() -> Result<(), i32> {
    init_log("EXTRACTOR");
    thread::spawn(move || inproc_storage_manager(get_storage_init_param()));

    let mut js_runtime = JsRuntime::new();
    listen_queue(&mut js_runtime)
}

fn listen_queue<'a>(js_runtime: &'a mut JsRuntime) -> Result<(), i32> {
    let module_info = ModuleInfo::new("./data", "extract", true);
    if module_info.is_err() {
        error!("{:?}", module_info.err());
        return Err(-1);
    }

    let mut module = Module::default();
    while !module.api.connect() {
        error!("main module not ready, sleep and repeat");
        thread::sleep(time::Duration::from_millis(1000));
    }
    let sys_ticket;
    if let Ok(t) = module.get_sys_ticket_id() {
        sys_ticket = t;
    } else {
        error!("fail get sys_ticket");
        return Ok(());
    }

    let mut onto = Onto::default();

    info!("load onto start");
    load_onto(&mut module.storage, &mut onto);
    info!("load onto end");

    let mut my_node_id = get_db_id(&mut module);
    if my_node_id.is_none() {
        my_node_id = create_db_id(&mut module);

        if my_node_id.is_none() {
            error!("fail create Database Identification");
            return Ok(());
        }
    }
    let my_node_id = my_node_id.unwrap();
    info!("my node_id={}", my_node_id);

    let queue_out = Queue::new("./data/out", "extract", Mode::ReadWrite).expect("!!!!!!!!! FAIL QUEUE");
    let mut queue_consumer = Consumer::new("./data/queue", "extract", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");

    if let Some(xr) = XapianReader::new("russian", &mut module.storage) {
        let mut ctx = Context {
            sys_ticket,
            queue_out,
            db_id: my_node_id,
            workplace: ScriptsWorkPlace::new(js_runtime.v8_isolate()),
            xr,
            onto,
        };

        ctx.workplace.load_ext_scripts(&ctx.sys_ticket);
        load_exim_filter_scripts(&mut ctx.workplace, &mut ctx.xr);

        let args: Vec<String> = env::args().collect();
        for el in args.iter() {
            if el.starts_with("--query") {
                if let Some(i) = el.find("=") {
                    let query = el.to_string().split_off(i + 1).replace("\'", "'");
                    if let Err(e) = export_from_query(&query, &mut module, &mut ctx) {
                        error!("fail execute query [{}], err={:?}", query, e);
                    }
                }
            }
        }

        module.listen_queue(
            &mut queue_consumer,
            &mut module_info.unwrap(),
            &mut ctx,
            &mut (before_batch as fn(&mut Module, &mut Context<'a>, batch_size: u32) -> Option<u32>),
            &mut (prepare as fn(&mut Module, &mut ModuleInfo, &mut Context<'a>, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
            &mut (after_batch as fn(&mut Module, &mut ModuleInfo, &mut Context<'a>, prepared_batch_size: u32) -> bool),
            &mut (heartbeat as fn(&mut Module, &mut ModuleInfo, &mut Context<'a>)),
        );
    }
    Ok(())
}

fn heartbeat(_module: &mut Module, _module_info: &mut ModuleInfo, _ctx: &mut Context) {}

fn before_batch(_module: &mut Module, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Module, _module_info: &mut ModuleInfo, _ctx: &mut Context, _prepared_batch_size: u32) -> bool {
    false
}

fn prepare(module: &mut Module, _module_info: &mut ModuleInfo, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("cmd is none");
        return Ok(true);
    }

    let mut prev_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    let user_id = queue_element.get_first_literal("user_uri").unwrap_or_default();

    let date = queue_element.get_first_integer("date");
    //    if date.is_none() {
    //        return Ok(());
    //    }
    prepare_indv(module, ctx, cmd.unwrap(), Some(&mut prev_state), &mut new_state, &user_id, date.unwrap_or_default(), &queue_element.get_id())
}

fn prepare_indv(
    module: &mut Module,
    ctx: &mut Context,
    cmd: IndvOp,
    prev_state: Option<&mut Individual>,
    new_state: &mut Individual,
    user_id: &str,
    date: i64,
    msg_id: &str,
) -> Result<bool, PrepareError> {
    let mut exportable = is_exportable(module, ctx, prev_state, new_state, user_id);
    if exportable.is_empty() {
        return Ok(true);
    }

    for el in exportable.iter_mut() {
        let res = if let Some(i) = &mut el.indv {
            add_to_queue(&mut ctx.queue_out, cmd.clone(), i, msg_id, &ctx.db_id, &el.target, date)
        } else {
            add_to_queue(&mut ctx.queue_out, cmd.clone(), new_state, msg_id, &ctx.db_id, &el.target, date)
        };

        if let Err(e) = res {
            error!("fail prepare message, err={:?}", e);
            return Err(PrepareError::Fatal);
        }
    }

    Ok(true)
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

fn export_from_query(query: &str, module: &mut Module, ctx: &mut Context) -> Result<(), PrepareError> {
    let mut ftq = FTQuery::new_with_user("cfg:VedaSystem", query);
    ftq.top = 100000;
    ftq.limit = 100000;
    info!("execute query [{:?}]", ftq);
    let res = ctx.xr.query(ftq, &mut module.storage);
    if res.result_code == ResultCode::Ok && res.count > 0 {
        for id in &res.result {
            if let Some(mut indv) = module.get_individual(id, &mut Individual::default()) {
                let msg_id = indv.get_id().to_string();
                prepare_indv(module, ctx, IndvOp::Put, None, &mut indv, "", 0, &msg_id)?;
            }
        }
    }
    Ok(())
}
