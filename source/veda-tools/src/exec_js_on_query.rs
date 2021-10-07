use ini::Ini;
use serde_json::json;
use std::io::{Error, ErrorKind};
use std::{fs, io, thread};
use v_common::module::module::{Module, PrepareError};
use v_common::module::remote_indv_r_storage::inproc_storage_manager;
use v_common::module::veda_backend::Backend;
use v_common::search::clickhouse_client::CHClient;
use v_common::v_api::obj::OptAuthorize;
use v_v8::callback::*;
use v_v8::common::{ScriptInfo, ScriptInfoContext};
use v_v8::jsruntime::JsRuntime;
use v_v8::rusty_v8 as v8;
use v_v8::rusty_v8::ContextScope;
use v_v8::scripts_workplace::ScriptsWorkPlace;
use v_v8::session_cache::{commit, CallbackSharedData, Transaction};
use v_v8::v_common::v_api::api_client::MStorageClient;
use v_v8::v_common::v_api::obj::ResultCode;

struct Context {}

pub(crate) fn exec_js_on_query<'a>(path_to_query: &str, path_to_js: &str) {
    thread::spawn(move || inproc_storage_manager());
    let mut js_runtime = JsRuntime::new();
    q1(&mut js_runtime, path_to_query, path_to_js);
}

fn q1<'a>(js_runtime: &'a mut JsRuntime, path_to_query: &str, path_to_js: &str) -> io::Result<()> {
    let mut backend = Backend::default();
    let mut veda_client = MStorageClient::new(Module::get_property("main_module_url").unwrap());

    let conf = Ini::load_from_file("veda.properties").expect("fail load veda.properties file");
    let section = conf.section(None::<String>).expect("fail parse veda.properties");
    let query_search_db = section.get("query_search_db").expect("param [query_search_db_url] not found in veda.properties");
    let mut ch_client = CHClient::new(query_search_db.to_owned());

    let ticket_id = &backend.get_sys_ticket_id().unwrap();
    let sys_ticket = backend.get_ticket_from_db(ticket_id);

    let mut workplace: ScriptsWorkPlace<'a, ScriptInfoContext> = ScriptsWorkPlace::new(js_runtime.v8_isolate());
    workplace.load_ext_scripts(&sys_ticket.id);

    let f = fs::read_to_string(path_to_js)?;

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
    for el in ch_client.select(&sys_ticket.user_uri, &query, 1000000, 1000000, 0, OptAuthorize::NO).result.iter() {
        if let Some(s) = scr_inf.compiled_script {
            let mut session_data = CallbackSharedData::default();
            session_data.g_key2attr.insert("$ticket".to_owned(), sys_ticket.id.to_owned());
            session_data.g_key2attr.insert("$data".to_owned(), json!(el).to_string());

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
        }
    }

    Ok(())
}
