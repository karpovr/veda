#[macro_use]
extern crate log;
#[macro_use]
extern crate lazy_static;

use crate::common::out_value_2_complete_external_task;
use crate::v8_script::{execute_external_js_task, load_external_task_scripts, OutValue, ScriptInfoContext};
use camunda_client::apis::client::APIClient;
use camunda_client::apis::configuration::Configuration;
use camunda_client::models::{FetchExternalTaskTopicDto, FetchExternalTasksDto};
use serde_json::Value;
use std::{thread, time};
use v_ft_xapian::xapian_reader::XapianReader;
use v_module::module::{init_log, Module, get_info_of_module, wait_module, wait_load_ontology, get_storage_init_param};
use v_module::onto::load_onto;
use v_onto::onto::Onto;
use v_storage::remote_indv_r_storage::inproc_storage_manager;
use v_v8::jsruntime::JsRuntime;
use v_v8::scripts_workplace::ScriptsWorkPlace;

mod common;
mod v8_script;

pub struct Context<'a> {
    sys_ticket: String,
    //onto: Onto,
    xr: XapianReader,
    workplace: ScriptsWorkPlace<'a, ScriptInfoContext>,
    pub api_client: APIClient,
}

fn main() -> Result<(), i32> {
    init_log("CAMUNDA-EXTERNAL-TASK");

    if get_info_of_module("fulltext_indexer").unwrap_or((0, 0)).0 == 0 {
        wait_module("fulltext_indexer", wait_load_ontology());
    }

    thread::spawn(move || inproc_storage_manager(get_storage_init_param()));

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

    let mut js_runtime = JsRuntime::new();

    if let Some(xr) = XapianReader::new("russian", &mut module.storage) {
        let mut ctx = Context {
            workplace: ScriptsWorkPlace::new(js_runtime.v8_isolate()),
            //onto,
            sys_ticket,
            xr,
            api_client: APIClient::new(Configuration::default()),
        };
        ctx.workplace.load_ext_scripts(&ctx.sys_ticket);

        load_external_task_scripts(&mut ctx.workplace, &mut ctx.xr);

        let worker_id = "camunda-external-task";

        loop {
            match ctx.api_client.external_task_api().get_external_tasks(
                None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None,
            ) {
                Ok(res) => {
                    for task in res {
                        if task.worker_id.is_some() {
                            continue;
                        }
                        let mut fetch_task_arg = FetchExternalTasksDto::new(worker_id.to_owned(), Some(1));
                        fetch_task_arg.topics = Some(vec![FetchExternalTaskTopicDto::new(task.topic_name.unwrap_or_default(), Some(60 * 60 * 1000))]);
                        match ctx.api_client.external_task_api().fetch_and_lock(Some(fetch_task_arg)) {
                            Ok(locked_tasks) => {
                                for i_task in locked_tasks.iter() {
                                    let execution_id = i_task.id.as_deref().unwrap_or_default();
                                    let topic_id = i_task.topic_name.as_deref().unwrap_or_default();
                                    let mut res = OutValue::Json(Value::default());
                                    if execute_external_js_task(i_task, topic_id, &mut ctx, &mut res) {
                                        let out_data = out_value_2_complete_external_task(worker_id, res);
                                        if let Err(e) = ctx.api_client.external_task_api().complete_external_task_resource(&execution_id, Some(out_data)) {
                                            error!("complete_external_task_resource, error={:?}", e);
                                        }
                                    } else {
                                        warn!("topic {} not found", topic_id);
                                        ctx.api_client.external_task_api().unlock(&execution_id);
                                    }
                                }
                            }
                            Err(e) => error!("fetch_and_lock, error={:?}", e),
                        }
                    }
                }
                Err(e) => error!("get_external_tasks, error={:?}", e),
            }
            thread::sleep(time::Duration::from_millis(300));
        }
    }

    Ok(())
}
