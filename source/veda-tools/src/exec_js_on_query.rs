use crate::common::pause_if_overload;
use std::io::{Error, ErrorKind};
use std::time;
use std::{fs, io, thread};
use stopwatch::Stopwatch;
use systemstat::{Platform, System};
use v_v8::callback::*;
use v_v8::common::{ScriptInfo, ScriptInfoContext};
use v_v8::jsruntime::JsRuntime;
use v_v8::scripts_workplace::ScriptsWorkPlace;
use v_v8::session_cache::{commit, CallbackSharedData, Transaction};
use v_v8::v8;
use v_v8::v8::ContextScope;
use v_v8::v_common::module::module_impl::Module;
use v_v8::v_common::module::remote_indv_r_storage::inproc_storage_manager;
use v_v8::v_common::module::veda_backend::Backend;
use v_v8::v_common::search::clickhouse_client::CHClient;
use v_v8::v_common::search::common::FTQuery;
use v_v8::v_common::v_api::api_client::MStorageClient;
use v_v8::v_common::v_api::obj::{OptAuthorize, ResultCode};
use v_v8::v_common::v_queue::consumer::Consumer;
use v_v8::v_common::v_queue::record::Mode;

pub(crate) fn exec_js_on_query<'a>(path_to_query: &str, path_to_js: &str) {
    thread::spawn(move || inproc_storage_manager());
    let mut js_runtime = JsRuntime::new();
    if let Err(e) = prepare(&mut js_runtime, path_to_query, path_to_js) {
        error!("{:?}", e);
    }
}

fn prepare<'a>(js_runtime: &'a mut JsRuntime, path_to_query: &str, path_to_js: &str) -> io::Result<()> {
    let sys = System::new();
    let max_load = num_cpus::get() / 2;

    let mut backend = Backend::default();
    let mut veda_client = MStorageClient::new(Module::get_property("main_module_url").unwrap());

    let query_search_db = Module::get_property("query_search_db").expect("param [query_search_db_url] not found in veda.properties");
    let mut ch_client = CHClient::new(query_search_db.to_owned());

    let ticket_id = &backend.get_sys_ticket_id().unwrap();
    let sys_ticket = backend.get_ticket_from_db(ticket_id);

    let mut workplace: ScriptsWorkPlace<'a, ScriptInfoContext> = ScriptsWorkPlace::new(js_runtime.v8_isolate());
    workplace.load_ext_scripts(&sys_ticket.id);

    let f = fs::read_to_string(path_to_js)?;

    let consumer_name = "fanout_sql";
    let queue_name = "individuals-flow";
    let base_path = "./data/queue";

    let str_script = "\
      (function () { \
        try { \
          var ticket = get_env_str_var ('$ticket'); \
          var data = get_env_str_var ('$data'); \
          "
    .to_owned()
        + &f
        + " \
         } catch (e) { log_trace (e); } \
      })();";

    let script_id = path_to_js;
    let mut scr_inf: ScriptInfo<ScriptInfoContext> = ScriptInfo::new_with_src(path_to_js, &str_script);
    {
        let scope = &mut v8::ContextScope::new(&mut workplace.scope, workplace.context);
        scr_inf.compile_script(script_id, scope);
    }

    let query = fs::read_to_string(path_to_query)?;
    let mut sw = Stopwatch::start_new();
    let req = FTQuery {
        ticket: "".to_string(),
        user: sys_ticket.user_uri,
        query,
        sort: "".to_string(),
        databases: "".to_string(),
        reopen: false,
        top: 10000,
        limit: 0,
        from: 0,
    };
    for el in ch_client.select(req, OptAuthorize::NO).result.iter() {
        if let Some(s) = scr_inf.compiled_script {
            let mut session_data = CallbackSharedData::default();
            session_data.g_key2attr.insert("$ticket".to_owned(), sys_ticket.id.to_owned());
            session_data.g_key2attr.insert("$data".to_owned(), el.to_owned());

            let mut sh_g_vars = G_VARS.lock().unwrap();
            let g_vars = sh_g_vars.get_mut();
            *g_vars = session_data;
            drop(sh_g_vars);

            let hs = ContextScope::new(&mut workplace.scope, workplace.context);
            let mut local_scope = hs;

            let mut sh_tnx = G_TRANSACTION.lock().unwrap();
            let tnx = sh_tnx.get_mut();
            *tnx = Transaction::default();
            tnx.id = 0;
            tnx.sys_ticket = sys_ticket.id.to_owned();
            drop(sh_tnx);

            s.run(local_scope.as_mut());

            sh_tnx = G_TRANSACTION.lock().unwrap();
            let tnx = sh_tnx.get_mut();

            let res = commit(tnx, &mut veda_client);

            for item in tnx.queue.iter() {
                info!("tnx item: cmd={:?}, uri={}, res={:?}", item.cmd, item.indv.get_id(), item.rc);
            }

            drop(sh_tnx);

            info!("{}", script_id);

            if res != ResultCode::Ok {
                info!("fail exec event script : {}, result={:?}", script_id, res);
                return Err(Error::new(ErrorKind::Other, ""));
            }

            if sw.elapsed_ms() > 1000 {
                loop {
                    match Consumer::new_with_mode(base_path, consumer_name, queue_name, Mode::Read) {
                        Ok(mut queue_consumer) => {
                            queue_consumer.open(false);
                            queue_consumer.get_info();
                            if queue_consumer.queue.get_info_of_part(queue_consumer.id, false).is_ok() {
                                //info!("queue_consumer.count_popped={}, queue_consumer.queue.count_pushed={}", queue_consumer.count_popped, queue_consumer.queue.count_pushed);
                                if queue_consumer.count_popped + 1000 < queue_consumer.queue.count_pushed {
                                    info!("sleep...");
                                    thread::sleep(time::Duration::from_millis(5000));
                                } else {
                                    break;
                                }
                            } else {
                                break;
                            }
                        },
                        Err(e) => {
                            error!("fail read queue, err={:?}", e);
                            break;
                        },
                    }
                }
                pause_if_overload(&sys, max_load);
                sw = Stopwatch::start_new();
            }
        }
    }

    Ok(())
}
