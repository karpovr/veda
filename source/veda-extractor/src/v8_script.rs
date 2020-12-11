use crate::Context;
use rusty_v8 as v8;
use rusty_v8::{ContextScope, HandleScope, Local, Value};
use std::sync::Mutex;
use v_api::app::ResultCode;
use v_ft_xapian::xapian_reader::XapianReader;
use v_module::module::Module;
use v_onto::individual::Individual;
use v_search::common::FTQuery;
use v_v8::callback::*;
use v_v8::common::*;
use v_v8::scripts_workplace::ScriptsWorkPlace;
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

#[derive(Debug)]
pub struct OutValue {
    pub target: String,
    pub indv: Option<Individual>,
}

pub fn is_exportable(_module: &mut Module, ctx: &mut Context, prev_state_indv: Option<&mut Individual>, new_state_indv: &mut Individual, user_id: &str) -> Vec<OutValue> {
    let mut ov = vec![];

    new_state_indv.parse_all();

    let rdf_types = new_state_indv.get_literals("rdf:type").unwrap_or_default();

    let mut session_data = CallbackSharedData::default();

    if let Some(indv) = prev_state_indv {
        session_data.g_key2indv.insert("$prev_state".to_owned(), Individual::new_from_obj(indv.get_obj()));
    }
    session_data.g_key2indv.insert("$document".to_owned(), Individual::new_from_obj(new_state_indv.get_obj()));
    session_data.g_key2attr.insert("$ticket".to_owned(), ctx.sys_ticket.to_owned());
    if !user_id.is_empty() {
        session_data.g_key2attr.insert("$user".to_owned(), user_id.to_string());
    } else {
        session_data.g_key2attr.insert("$user".to_owned(), "cfg:VedaSystem".to_owned());
    }
    session_data.set_g_super_classes(&rdf_types, &ctx.onto);

    let mut sh_g_vars = G_VARS.lock().unwrap();
    let g_vars = sh_g_vars.get_mut();
    *g_vars = session_data;
    drop(sh_g_vars);

    for script_id in ctx.workplace.scripts_order.iter() {
        if let Some(script) = ctx.workplace.scripts.get(script_id) {
            if let Some(compiled_script) = script.compiled_script {
                if !is_filter_pass(script, new_state_indv.get_id(), &rdf_types, &mut ctx.onto) {
                    debug!("skip (filter) script:{}", script_id);
                    continue;
                }

                debug!("script_id={}, doc_id={}", script_id, new_state_indv.get_id());

                let mut scope = ContextScope::new(&mut ctx.workplace.scope, ctx.workplace.context);
                if let Some(res) = compiled_script.run(&mut scope) {
                    if res.is_array() {
                        if let Some(res) = res.to_object(&mut scope) {
                            if let Some(key_list) = res.get_property_names(&mut scope) {
                                for resources_idx in 0..key_list.length() {
                                    let j_resources_idx = v8::Integer::new(&mut scope, resources_idx as i32);
                                    if let Some(v) = res.get(&mut scope, j_resources_idx.into()) {
                                        prepare_out_obj(&mut ov, v, &mut scope);
                                    }
                                }
                            }
                        }
                    } else if res.is_object() {
                        prepare_out_obj(&mut ov, res, &mut scope);
                    } else if res.is_string() {
                        if let Some(s) = res.to_string(scope.as_mut()) {
                            let target = s.to_rust_string_lossy(&mut scope);
                            if !target.is_empty() {
                                ov.push(OutValue {
                                    target,
                                    indv: None,
                                });
                            }
                        }
                    } else if res.is_null_or_undefined() {
                        debug!("empty result");
                    } else {
                        error!("unknown result type");
                    }
                }
            }
        }
    }
    return ov;
}

fn prepare_out_obj(ov: &mut Vec<OutValue>, res: Local<Value>, scope: &mut ContextScope<HandleScope>) {
    if let Some(out_obj) = res.to_object(scope) {
        if let Some(j_predicates) = out_obj.get_property_names(scope) {
            let idx0 = v8::Integer::new(scope, 0);
            let k0 = j_predicates.get(scope, idx0.into()).unwrap();
            let t0 = out_obj.get(scope, k0).unwrap();
            let target = v8_2_str(scope, &t0);

            let mut ri = Individual::default();
            v8obj_into_individual(scope, out_obj, &mut ri);
            ov.push(OutValue {
                target,
                indv: Some(ri),
            });
        }
    }
}

pub(crate) fn load_exim_filter_scripts(wp: &mut ScriptsWorkPlace<ScriptInfoContext>, xr: &mut XapianReader) {
    let res = xr.query(FTQuery::new_with_user("cfg:VedaSystem", "'rdf:type' === 'v-s:EximFilter'"), &mut wp.module.storage);

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

    if let Some(script_text) = ev_indv.get_first_literal("v-s:script") {
        let str_script = "\
      (function () { \
        try { \
          var ticket = get_env_str_var ('$ticket'); \
          var document = get_individual (ticket, '$document'); \
          var prev_state = get_individual (ticket, '$prev_state'); \
          var super_classes = get_env_str_var ('$super_classes'); \
          var user_uri = get_env_str_var ('$user'); \
          "
        .to_owned()
            + &script_text
            + " \
         } catch (e) { log_trace (e); } \
      })();";

        let mut scr_inf: ScriptInfo<ScriptInfoContext> = ScriptInfo::new_with_src(&ev_indv.get_id(), &str_script);

        scr_inf.context.prevent_by_type = HashVec::new(ev_indv.get_literals("v-s:preventByType").unwrap_or_default());
        scr_inf.context.trigger_by_uid = HashVec::new(ev_indv.get_literals("v-s:triggerByUid").unwrap_or_default());
        scr_inf.context.trigger_by_type = HashVec::new(ev_indv.get_literals("v-s:triggerByType").unwrap_or_default());
        scr_inf.dependency = HashVec::new(ev_indv.get_literals("v-s:dependency").unwrap_or_default());

        wp.add_to_order(&scr_inf);

        let scope = &mut v8::ContextScope::new(&mut wp.scope, wp.context);
        scr_inf.compile_script(ev_indv.get_id(), scope);
        wp.scripts.insert(scr_inf.id.to_string(), scr_inf);
    } else {
        error!("v-s:script no found");
    }
}
