use crate::Context;
use camunda_client::models::LockedExternalTaskDto;
use rusty_v8 as v8;
use rusty_v8::{json, ContextScope, Integer};
use serde_json::{json, Value};
use std::sync::Mutex;
use v_api::app::ResultCode;
use v_ft_xapian::xapian_reader::XapianReader;
use v_onto::individual::Individual;
use v_search::common::FTQuery;
use v_v8::callback::*;
use v_v8::common::{v8obj_into_individual, ScriptInfo};
use v_v8::scripts_workplace::{ScriptsWorkPlace};
use v_v8::session_cache::CallbackSharedData;

lazy_static! {
    static ref INIT_LOCK: Mutex<u32> = Mutex::new(0);
}

#[must_use]
pub struct SetupGuard {}

impl Drop for SetupGuard {
    fn drop(&mut self) {
        // TODO shutdown process cleanly.
    }
}

pub(crate) struct ScriptInfoContext {}

impl Default for ScriptInfoContext {
    fn default() -> Self {
        Self {}
    }
}

pub enum OutValue {
    Json(Value),
    Bool(bool),
    List(Vec<String>),
    Individual(Individual),
    None,
}

pub fn execute_external_js_task(task: &LockedExternalTaskDto, script_id: &str, ctx: &mut Context, out: &mut OutValue) -> bool {
    let mut session_data = CallbackSharedData::default();
    session_data.g_key2attr.insert("$ticket".to_owned(), ctx.sys_ticket.to_owned());
    session_data.g_key2attr.insert("$task".to_owned(), json!(task).to_string());
    execute_js(session_data, script_id, ctx, out)
}

pub fn execute_js(session_data: CallbackSharedData, script_id: &str, ctx: &mut Context, out: &mut OutValue) -> bool {
    let compiled_script = if let Some(script) = ctx.workplace.scripts.get(script_id) {
        script.compiled_script
    } else {
        None
    };

    if let Some(c) = compiled_script {
        let mut sh_g_vars = G_VARS.lock().unwrap();
        let g_vars = sh_g_vars.get_mut();
        *g_vars = session_data;
        drop(sh_g_vars);

        let hs = ContextScope::new(&mut ctx.workplace.scope, ctx.workplace.context);
        let mut local_scope = hs;

        if let Some(res) = c.run(&mut local_scope) {
            match out {
                OutValue::Bool(ov) => {
                    if res.is_boolean() {
                        if res.to_integer(local_scope.as_mut()).unwrap().value() != 0 {
                            *ov = true;
                        } else {
                            *ov = false;
                        }
                        return true;
                    }
                }
                OutValue::Json(ov) => {
                    if let Some(jo) = json::stringify(&mut local_scope, res) {
                        let js_str = jo.to_rust_string_lossy(&mut local_scope);
                        if let Ok(v) = serde_json::from_str(&js_str) {
                            *ov = v;
                            return true;
                        }
                    }
                }
                OutValue::List(ov) => {
                    if let Some(obj) = res.to_object(&mut local_scope) {
                        if let Some(key_list) = obj.get_property_names(&mut local_scope) {
                            for resources_idx in 0..key_list.length() {
                                let j_resources_idx = Integer::new(&mut local_scope, resources_idx as i32);
                                if let Some(v) = obj.get(&mut local_scope, j_resources_idx.into()) {
                                    if let Some(s) = v.to_string(&mut local_scope) {
                                        let ss = s.to_rust_string_lossy(&mut local_scope);
                                        ov.push(ss);
                                    }
                                }
                            }
                            return true;
                        }
                    }
                }
                OutValue::Individual(v) => {
                    if let Some(obj) = res.to_object(&mut local_scope) {
                        v8obj_into_individual(&mut local_scope, obj, v);
                        return true;
                    }
                }
                _ => {}
            }
        }
    }

    false
}

//pub fn get_script_identity(id: &str, text: &str) -> String {
//    format!("{}+{}", id, text)
//}

pub(crate) fn load_external_task_scripts(wp: &mut ScriptsWorkPlace<ScriptInfoContext>, xr: &mut XapianReader) {
    let res = xr.query(FTQuery::new_with_user("cfg:VedaSystem", "'rdf:type' === 'bpmn:ExternalTaskHandler'"), &mut wp.module.storage);

    if res.result_code == ResultCode::Ok && res.count > 0 {
        for id in &res.result {
            if let Some(ev_indv) = wp.module.get_individual(id, &mut Individual::default()) {
                prepare_script(wp, ev_indv);
            }
        }
    }
    info!("load scripts from db: {:?}", wp.scripts_order);
}

pub(crate) fn prepare_script(wp: &mut ScriptsWorkPlace<ScriptInfoContext>, ev_indv: &mut Individual) {
    if ev_indv.is_exists_bool("v-s:deleted", true) || ev_indv.is_exists_bool("v-s:disabled", true) {
        info!("disable script {}", ev_indv.get_id());
        if let Some(scr_inf) = wp.scripts.get_mut(ev_indv.get_id()) {
            scr_inf.compiled_script = None;
        }
        return;
    }

    if let Some(script_text) = ev_indv.get_first_literal("bpmn:script") {
        let str_script = "\
      (function () { \
        try { \
          var ticket = get_env_str_var ('$ticket'); \
          var task = JSON.parse(get_env_str_var ('$task')); \
          "
        .to_owned()
            + &script_text
            + " \
         } catch (e) { log_trace (e); } \
      })();";

        let topic = ev_indv.get_first_literal("bpmn:triggerByTopic").unwrap_or_default();

        let mut scr_inf: ScriptInfo<ScriptInfoContext> = ScriptInfo::new_with_src(&topic, &str_script);

        wp.add_to_order(&scr_inf);

        let scope = &mut v8::ContextScope::new(&mut wp.scope, wp.context);
        scr_inf.compile_script(ev_indv.get_id(), scope);
        wp.scripts.insert(scr_inf.id.to_string(), scr_inf);
    } else {
        error!("v-s:script no found");
    }
}
