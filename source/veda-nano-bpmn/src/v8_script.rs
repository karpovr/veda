use crate::Context;
use rusty_v8::{ContextScope, Integer};
use std::sync::Mutex;
use v_onto::individual::Individual;
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
    Bool(bool),
    List(Vec<String>),
    Individual(Individual),
    None,
}

pub fn execute_js(
    token: &mut Individual,
    process_instance: &mut Individual,
    script_id: &str,
    work_order_uri: Option<&str>,
    script_text: Option<&String>,
    ctx: &mut Context,
    out: &mut OutValue,
) -> bool {
    if let Some(script_text) = script_text {
        let compiled_script = if let Some(script) = ctx.workplace.scripts.get(&get_script_identity(script_id, script_text)) {
            script.compiled_script
        } else {
            if let OutValue::None = out {
                prepare_script(&mut ctx.workplace, &script_id, script_text);
            } else {
                prepare_eval_script(&mut ctx.workplace, &script_id, script_text);
            }

            if let Some(s) = ctx.workplace.scripts.get(&get_script_identity(script_id, script_text)) {
                s.compiled_script
            } else {
                None
            }
        };

        if let Some(c) = compiled_script {
            let mut session_data = CallbackSharedData::default();
            session_data.g_key2attr.insert("$ticket".to_owned(), ctx.sys_ticket.to_owned());
            if let Some(w) = work_order_uri {
                session_data.g_key2attr.insert("$work_order".to_owned(), w.to_owned());
            }
            session_data.g_key2indv.insert("$process".to_owned(), Individual::new_from_obj(process_instance.parse_all().get_obj()));

            if !token.is_empty() {
                session_data.g_key2indv.insert("$token".to_owned(), Individual::new_from_obj(token.parse_all().get_obj()));
            }

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
    }

    false
}

pub(crate) fn prepare_script(wp: &mut ScriptsWorkPlace<ScriptInfoContext>, script_id: &str, script_text: &str) {
    let str_script = "\
      (function () { \
        try { \
          var ticket = get_env_str_var ('$ticket'); \
          var token = get_individual (ticket, '$token'); \
          var process = get_individual (ticket, '$process'); \
          "
    .to_owned()
        + script_text
        + " \
        } catch (e) { log_trace (e); } \
      })();";

    let mut scr_inf: ScriptInfo<ScriptInfoContext> = ScriptInfo::new_with_src(script_id, &str_script);

    wp.add_to_order(&scr_inf);

    let scope = &mut ContextScope::new(&mut wp.scope, wp.context);
    scr_inf.compile_script(script_id, scope);
    wp.scripts.insert(get_script_identity(&scr_inf.id, &script_text), scr_inf);
}

pub(crate) fn get_script_identity(id: &str, text: &str) -> String {
    format!("{}+{}", id, text)
}

pub(crate) fn prepare_eval_script(wp: &mut ScriptsWorkPlace<ScriptInfoContext>, script_id: &str, script_text: &str) {
    let str_script = "\
      (function () { \
        try { \
          var ticket = get_env_str_var ('$ticket'); \
          var token = get_individual (ticket, '$token'); \
          var process = get_individual (ticket, '$process'); \
          return "
        .to_owned()
        + script_text
        + " \
        ; } catch (e) { log_trace (e); } \
      })();";

    let mut scr_inf: ScriptInfo<ScriptInfoContext> = ScriptInfo::new_with_src(script_id, &str_script);

    wp.add_to_order(&scr_inf);

    let scope = &mut ContextScope::new(&mut wp.scope, wp.context);
    scr_inf.compile_script(script_id, scope);
    wp.scripts.insert(get_script_identity(&scr_inf.id, &script_text), scr_inf);
}
