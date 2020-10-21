use crate::common::get_individual;
use crate::Context;

use camunda_client::apis::client::APIClient;
use camunda_client::apis::Error as CamundaError;
use camunda_client::models::{ProcessInstanceWithVariablesDto, StartProcessInstanceDto, VariableValueDto};
use std::collections::HashMap;
use std::error::Error;
use v_module::module::Module;
use v_onto::individual::Individual;

pub fn prepare_start_form(start_form: &mut Individual, ctx: &mut Context, module: &mut Module, _signal: &str) -> Result<(), Box<dyn Error>> {
    if start_form.any_exists("bpmn:hasStatus", &["bpmn:ToBeStarted"]) {
        if let Some(process_id) = start_form.get_first_literal("bpmn:startProcessId") {
            let start_form_id = start_form.get_id().to_owned();
            start_form.parse_all();

            let mut params = StartProcessInstanceDto::new();

            let mut vars = HashMap::new();
            let mut val = VariableValueDto::new();
            val.value = Some(start_form.get_obj().as_json());
            val._type = Some("json".to_owned());
            vars.insert("startForm".to_owned(), val);
            params.variables = Some(vars);
            match ctx.api_client.process_definition_api().start_process_instance_by_key(&process_id, Some(params)) {
                Ok(res) => info!("res={:?}", res),
                Err(e) => {
                    error!("fail execute process instance, err={:?}", e);
                }
            };
        }
    }

    Ok(())
}
