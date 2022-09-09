#[macro_use]
extern crate lazy_static;
#[macro_use]
extern crate log;
#[macro_use]
extern crate scan_fmt;

use std::sync::Mutex;
use std::{env, thread, time};
use v_v8::callback::*;
use v_v8::common::{is_filter_pass, HashVec, ScriptInfo, ScriptInfoContext};
use v_v8::v8::Isolate;
use v_v8::scripts_workplace::ScriptsWorkPlace;
use v_v8::session_cache::{commit, CallbackSharedData, Transaction};
use v_v8::v8;
use v_v8::v_common::ft_xapian::xapian_reader::XapianReader;
use v_v8::v_common::module::common::load_onto;
use v_v8::v_common::module::info::ModuleInfo;
use v_v8::v_common::module::module_impl::{get_cmd, get_info_of_module, get_inner_binobj_as_individual, init_log, wait_load_ontology, wait_module, Module, PrepareError};
use v_v8::v_common::module::remote_indv_r_storage::inproc_storage_manager;
use v_v8::v_common::module::veda_backend::Backend;
use v_v8::v_common::onto::individual::Individual;
use v_v8::v_common::onto::onto_impl::Onto;
use v_v8::v_common::search::common::FTQuery;
use v_v8::v_common::storage::common::StorageMode;
use v_v8::v_common::v_api::api_client::{IndvOp, MStorageClient};
use v_v8::v_common::v_api::obj::ResultCode;
use v_v8::v_common::v_queue::consumer::Consumer;
use v_v8::v_common::v_queue::record::Mode;

const MAX_COUNT_LOOPS: i32 = 100;
const MAIN_QUEUE_CS: &str = "scripts_main0";

lazy_static! {
    static ref INIT_LOCK: Mutex<u32> = Mutex::new(0);
}

#[must_use]
struct SetupGuard {}

impl Drop for SetupGuard {
    fn drop(&mut self) {
        // TODO shutdown process cleanly.
    }
}

fn setup() -> SetupGuard {
    static START: std::sync::Once = std::sync::Once::new();
    START.call_once(|| {
        assert!(v8::icu::set_common_data_71(align_data::include_aligned!(align_data::Align16, "third_party/icu/common/icudtl.dat")).is_ok());
        v8::V8::initialize_platform(v8::new_default_platform(0,false).make_shared());
        v8::V8::initialize();
    });
    SetupGuard {}
}

pub struct MyContext<'a> {
    api_client: MStorageClient,
    xr: XapianReader,
    onto: Onto,
    workplace: ScriptsWorkPlace<'a, ScriptInfoContext>,
    vm_id: String,
    sys_ticket: String,
    main_queue_cs: Option<Consumer>,
    queue_name: String,
    count_exec: i64,
    module_info: ModuleInfo,
}

fn main() -> Result<(), i32> {
    init_log("SCRIPT_V8");
    thread::spawn(move || inproc_storage_manager());

    let _setup_guard = setup();

    let isolate = &mut v8::Isolate::new(Default::default());

    info!("V8 version {}", v8::V8::get_version());

    main0(isolate)
}

fn main0<'a>(isolate: &'a mut Isolate) -> Result<(), i32> {
    if get_info_of_module("input-onto").unwrap_or((0, 0)).0 == 0 {
        wait_module("ontologist", wait_load_ontology());
    }

    let mut backend = Backend::create(StorageMode::ReadOnly, false);

    while !backend.mstorage_api.connect() {
        error!("failed to connect to main module, sleep and repeat");
        thread::sleep(time::Duration::from_millis(1000));
    }

    let mut onto = Onto::default();
    load_onto(&mut backend.storage, &mut onto);

    let w_sys_ticket = backend.get_sys_ticket_id();
    if w_sys_ticket.is_err() {
        error!("failed to get system ticket");
        return Ok(());
    }

    let mut vm_id = "main";
    let args: Vec<String> = env::args().collect();
    for el in args.iter() {
        if el == "main" || el.starts_with("lp") {
            vm_id = el;
            break;
        }
    }

    let process_name = "scripts_".to_owned() + vm_id;
    let consumer_name = &(process_name.to_owned() + "0");
    let main_queue_name = "individuals-flow";

    let module_info = ModuleInfo::new("./data", &process_name, true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", module_info.err());
        return Err(-1);
    }

    if let Some(xr) = XapianReader::new("russian", &mut backend.storage) {
        let mut ctx = MyContext {
            api_client: MStorageClient::new(Module::get_property("main_module_url").unwrap_or_default()),
            workplace: ScriptsWorkPlace::new(isolate),
            onto,
            vm_id: "main".to_owned(),
            sys_ticket: w_sys_ticket.unwrap(),
            main_queue_cs: None,
            queue_name: consumer_name.to_owned(),
            count_exec: 0,
            xr,
            module_info: module_info.unwrap(),
        };

        if vm_id.starts_with("lp") {
            if let Ok(lp_id) = scan_fmt!(vm_id, "lp{}", i32) {
                ctx.vm_id = format!("V8.LowPriority{}", lp_id);
            } else {
                ctx.vm_id = "V8.LowPriority".to_owned();
            }
        } else {
            ctx.vm_id = "main".to_owned();
        }

        info!("use VM id = {} -> {}", process_name, ctx.vm_id);

        ctx.workplace.load_ext_scripts(&ctx.sys_ticket);
        load_event_scripts(&mut ctx.workplace, &mut ctx.xr);

        let mut module = Module::default();

        let mut queue_consumer = Consumer::new("./data/queue", consumer_name, main_queue_name).expect("!!!!!!!!! FAIL OPEN RW CONSUMER");

        if vm_id.starts_with("lp") {
            loop {
                if let Ok(cs) = Consumer::new_with_mode("./data/queue", MAIN_QUEUE_CS, main_queue_name, Mode::Read) {
                    ctx.main_queue_cs = Some(cs);
                    break;
                }
                warn!("main queue consumer not open, sleep and repeat");
                thread::sleep(time::Duration::from_millis(1000));
            }
        }

        module.listen_queue(
            &mut queue_consumer,
            &mut ctx,
            &mut (before_batch as fn(&mut Backend, &mut MyContext<'a>, batch_size: u32) -> Option<u32>),
            &mut (prepare as fn(&mut Backend, &mut MyContext<'a>, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
            &mut (after_batch as fn(&mut Backend, &mut MyContext<'a>, prepared_batch_size: u32) -> Result<bool, PrepareError>),
            &mut (heartbeat as fn(&mut Backend, &mut MyContext<'a>) -> Result<(), PrepareError>),
            &mut backend,
        );
    } else {
        error!("failed to init ft-query");
    }
    Ok(())
}

fn heartbeat(_module: &mut Backend, _ctx: &mut MyContext) -> Result<(), PrepareError> {
    Ok(())
}

fn before_batch(_module: &mut Backend, _ctx: &mut MyContext, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Backend, _ctx: &mut MyContext, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
    Ok(false)
}

fn prepare(_module: &mut Backend, ctx: &mut MyContext, queue_element: &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError> {
    if let Some(main_cs_r) = &mut ctx.main_queue_cs {
        while my_consumer.count_popped > main_cs_r.count_popped && main_cs_r.id == my_consumer.id || my_consumer.id > main_cs_r.id {
            main_cs_r.get_info();

            if my_consumer.count_popped > main_cs_r.count_popped && main_cs_r.id == my_consumer.id || my_consumer.id > main_cs_r.id {
                info!("sleep, scripts_main={}:{}, my={}:{}", main_cs_r.id, main_cs_r.count_popped, my_consumer.id, my_consumer.count_popped);
                thread::sleep(time::Duration::from_millis(1000));
                main_cs_r.open(false);
            }
        }
    }

    match prepare_for_js(ctx, queue_element) {
        Ok(op_id) => {
            if let Err(e) = ctx.module_info.put_info(op_id, op_id) {
                error!("failed to write module_info, op_id = {}, err = {:?}", op_id, e);
                return Err(PrepareError::Fatal);
            }
        }
        Err(e) => {
            return Err(e);
        }
    }
    Ok(true)
}

fn prepare_for_js(ctx: &mut MyContext, queue_element: &mut Individual) -> Result<i64, PrepareError> {
    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();

    let src = queue_element.get_first_literal("src").unwrap_or_default();
    if src != "?" && ctx.queue_name != src {
        return Ok(op_id);
    }

    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("cmd is none, skip");
        return Ok(op_id);
    }

    if cmd.unwrap() == IndvOp::Remove {
        return Ok(op_id);
    }

    let event_id = queue_element.get_first_literal("event_id").unwrap_or_default();
    let user_id = queue_element.get_first_literal("user_uri").unwrap_or_default();
    let transaction_id = queue_element.get_first_integer("tnx_id").unwrap_or_default();
    let run_at = queue_element.get_first_literal("v-s:runAt").unwrap_or_default();

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    debug!("!!!! prepare document {}", new_state.get_id());

    let mut prepare_if_is_script = false;
    let rdf_types = new_state.get_literals("rdf:type").unwrap_or_default();
    let doc_id = new_state.get_id().to_owned();

    for t in rdf_types.iter() {
        if t == "v-s:PermissionStatement" || t == "v-s:Membership" {
            return Ok(op_id);
        } else if t == "v-s:Event" {
            prepare_if_is_script = true;
        }
        //else if t == "owl:Class" || t == "rdfs:Class" || t == "rdf:Property" || t == "rdfs:Datatype" || t == "owl:ObjectProperty" || t == "owl:DatatypeProperty" {
        //    info! ("update onto: id={}", new_state.get_id());
        //   ctx.onto.update(&mut new_state);
        //}
    }

    if !prepare_if_is_script && ctx.workplace.scripts.contains_key(&doc_id) {
        prepare_if_is_script = true;
    }

    if prepare_if_is_script {
        prepare_script(&mut ctx.workplace, &mut new_state);
    }

    let mut session_data = CallbackSharedData::default();

    session_data.set_g_parent_script_id_etc(&event_id);

    let mut prev_state = Individual::default();
    if get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state) {
        session_data.g_key2indv.insert("$prev_state".to_owned(), prev_state);
    }

    session_data.g_key2attr.insert("$ticket".to_owned(), ctx.sys_ticket.to_owned());

    session_data.set_g_super_classes(&rdf_types, &ctx.onto);

    let mut last_part_event_id = "";
    let te = event_id.to_owned();
    let full_path_els: Vec<&str> = te.split(';').collect();

    if let Some(s) = full_path_els.get(0) {
        last_part_event_id = s;
    }

    session_data.g_key2indv.insert("$document".to_owned(), new_state);

    if !user_id.is_empty() {
        session_data.g_key2attr.insert("$user".to_owned(), user_id);
    } else {
        session_data.g_key2attr.insert("$user".to_owned(), "cfg:VedaSystem".to_owned());
    }

    let mut sh_g_vars = G_VARS.lock().unwrap();
    let g_vars = sh_g_vars.get_mut();
    *g_vars = session_data;
    drop(sh_g_vars);

    let hs = v8::ContextScope::new(&mut ctx.workplace.scope, ctx.workplace.context);
    let mut local_scope = hs;

    for script_id in ctx.workplace.scripts_order.iter() {
        let run_script_id = doc_id.to_owned() + "+" + script_id;
        if let Some(script) = ctx.workplace.scripts.get(script_id) {
            if let Some(compiled_script) = script.compiled_script {
                if src == "?" && ((!run_at.is_empty() && run_at != ctx.vm_id) || (run_at.is_empty() && script.context.run_at != ctx.vm_id)) {
                    continue;
                }

                if event_id == "exim" && script.context.execute_if != event_id {
                    continue;
                }

                if !is_filter_pass(script, &doc_id, &rdf_types, &mut ctx.onto) {
                    debug!("skip (filter) script:{}", script_id);
                    continue;
                }

                if script.context.is_unsafe {
                    warn!("this script is UNSAFE!, {}", script.id);
                } else if !event_id.is_empty() {
                    if last_part_event_id == run_script_id || last_part_event_id == "IGNORE" {
                        error!("skip script, found looped sequence, path: {}", last_part_event_id);
                        continue;
                    }

                    let mut count_loops = 0;
                    for el in full_path_els.iter() {
                        if **el == run_script_id {
                            count_loops += 1;
                        }
                    }

                    if count_loops > MAX_COUNT_LOOPS {
                        error!("skip script, counted ({}) loops in sequencee > {}, path: [{}]", count_loops, MAX_COUNT_LOOPS, event_id);
                        continue;
                    }

                    if count_loops > 1 {
                        warn!("found [{}] loops in sequence, path: [{}]", count_loops, event_id);
                    }
                }

                info!("start: {}, {}, src={}, op_id={}, tnx_id={}, event_id={}", script_id, doc_id, src, op_id, transaction_id, event_id);

                let mut sh_tnx = G_TRANSACTION.lock().unwrap();
                let tnx = sh_tnx.get_mut();
                *tnx = Transaction::default();
                tnx.id = transaction_id;
                tnx.event_id = run_script_id.to_owned() + ";" + &event_id;
                tnx.sys_ticket = ctx.sys_ticket.to_owned();
                drop(sh_tnx);

                compiled_script.run(&mut local_scope);
                ctx.count_exec += 1;

                sh_tnx = G_TRANSACTION.lock().unwrap();
                let tnx = sh_tnx.get_mut();

                if script.context.disallow_changing_source {
                    tnx.src = src.to_owned();
                } else {
                    tnx.src = ctx.queue_name.to_owned();
                }

                let res = commit(tnx, &mut ctx.api_client);

                for item in tnx.queue.iter() {
                    info!("tnx item: cmd={:?}, uri={}, res={:?}", item.cmd, item.indv.get_id(), item.rc);
                }

                drop(sh_tnx);

                info!("{} end: {}", ctx.count_exec, script_id);

                if res != ResultCode::Ok {
                    error!("failed to execute event script: {}, result = {:?}", script_id, res);
                    return Err(PrepareError::Fatal);
                }
            }
        }
    }

    Ok(op_id)
}

const BEFORE_VARS: &str = "var document = get_individual (ticket, '$document'); if (document) {";
const AFTER_VARS: &str = "};";
const VARS_FOR_EVENT_SCRIPT: &str = "\
var user_uri = get_env_str_var ('$user');
var parent_script_id = get_env_str_var ('$parent_script_id');
var parent_document_id = get_env_str_var ('$parent_document_id');
var prev_state = get_individual (ticket, '$prev_state');
var super_classes = get_env_str_var ('$super_classes');
var queue_elements_count = get_env_num_var ('$queue_elements_count');
var queue_elements_processed = get_env_num_var ('$queue_elements_processed');
var _event_id = '?';";

pub(crate) fn load_event_scripts(wp: &mut ScriptsWorkPlace<ScriptInfoContext>, xr: &mut XapianReader) {
    let res = xr.query(FTQuery::new_with_user("cfg:VedaSystem", "'rdf:type' === 'v-s:Event'"), &mut wp.backend.storage);

    let mut scripts_ids = vec![];
    if res.result_code == ResultCode::Ok && res.count > 0 {
        for id in &res.result {
            scripts_ids.push(id);
        }
    }

    info!("found {} script events", scripts_ids.len());
    for id in scripts_ids {
        if let Some(ev_indv) = wp.backend.get_individual(id, &mut Individual::default()) {
            prepare_script(wp, ev_indv);
        }
    }

    info!("load scripts from storage: {:?}", wp.scripts_order);
}

pub(crate) fn prepare_script(wp: &mut ScriptsWorkPlace<ScriptInfoContext>, ev_indv: &mut Individual) {
    let first_section = "".to_owned();

    if ev_indv.is_exists_bool("v-s:deleted", true) || ev_indv.is_exists_bool("v-s:disabled", true) {
        info!("disable script {}", ev_indv.get_id());
        if let Some(scr_inf) = wp.scripts.get_mut(ev_indv.get_id()) {
            scr_inf.compiled_script = None;
        }
        return;
    }

    if let Some(script_text) = ev_indv.get_first_literal("v-s:script") {
        let str_script = first_section
            + "try { var ticket = get_env_str_var ('$ticket');"
            + BEFORE_VARS
            + "var _script_id = '"
            + ev_indv.get_id()
            + "';"
            + VARS_FOR_EVENT_SCRIPT
            + "script();"
            + AFTER_VARS
            + "function script() {"
            + &script_text
            + "}; } catch (e) { log_trace (e.stack); }";

        let mut scr_inf: ScriptInfo<ScriptInfoContext> = ScriptInfo::new_with_src(ev_indv.get_id(), &str_script);

        if let Some(v) = ev_indv.get_first_bool("v-s:unsafe") {
            scr_inf.context.is_unsafe = v;
        }

        if let Some(v) = ev_indv.get_first_literal("v-s:runAt") {
            scr_inf.context.run_at = v;
        }

        if let Some(v) = ev_indv.get_first_bool("v-s:disallowChangingSource") {
            scr_inf.context.disallow_changing_source = v;
        }

        if scr_inf.context.run_at.is_empty() {
            scr_inf.context.run_at = "main".to_owned();
        }

        scr_inf.context.prevent_by_type = HashVec::new(ev_indv.get_literals("v-s:preventByType").unwrap_or_default());
        scr_inf.context.trigger_by_uid = HashVec::new(ev_indv.get_literals("v-s:triggerByUid").unwrap_or_default());
        scr_inf.context.trigger_by_type = HashVec::new(ev_indv.get_literals("v-s:triggerByType").unwrap_or_default());

        if let Some(v) = ev_indv.get_first_literal("v-s:executeIfEvent") {
            scr_inf.context.execute_if = v;
        }

        scr_inf.dependency = HashVec::new(ev_indv.get_literals("v-s:dependency").unwrap_or_default());

        wp.add_to_order(&scr_inf);

        let scope = &mut v8::ContextScope::new(&mut wp.scope, wp.context);
        scr_inf.compile_script(ev_indv.get_id(), scope);
        wp.scripts.insert(scr_inf.id.to_string(), scr_inf);
    } else {
        error!("failed to read v-s:script attribute");
    }
}
