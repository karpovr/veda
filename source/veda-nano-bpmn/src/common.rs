use crate::Context;
use std::error::Error;
use std::fmt;
use v_api::app::generate_unique_uri;
use v_api::IndvOp;
use v_module::module::Module;
use v_onto::individual::Individual;
use v_onto::onto::Onto;

#[derive(Debug)]
pub struct MyError(pub String);

impl fmt::Display for MyError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "There is an error: {}", self.0)
    }
}

impl Error for MyError {}

pub fn set_and_store_token_into(dest_uri: &str, token_uri: &[String], sys_ticket: &str, module: &mut Module) -> Result<(), Box<dyn Error>> {
    let indv = &mut Individual::default();
    indv.set_id(dest_uri);

    indv.remove("bpmn:hasToken");
    for u in token_uri {
        indv.add_uri("bpmn:hasToken", u);
    }

    module.api.update_or_err(sys_ticket, "", "store-token-into", IndvOp::SetIn, indv)?;
    Ok(())
}

pub fn add_and_store_token_into(dest_uri: &str, token_uri: &str, sys_ticket: &str, module: &mut Module) -> Result<(), Box<dyn Error>> {
    let indv = &mut Individual::default();
    indv.set_id(dest_uri);
    indv.add_uri("bpmn:hasToken", token_uri);

    module.api.update_or_err(sys_ticket, "", "store-token-into", IndvOp::AddTo, indv)?;
    Ok(())
}

pub fn store_work_order_into(dest_uri: &str, work_order_uri: &str, sys_ticket: &str, module: &mut Module) -> Result<(), Box<dyn Error>> {
    let indv = &mut Individual::default();
    indv.set_id(dest_uri);
    indv.add_uri("bpmn:hasWorkOrder", work_order_uri);

    module.api.update_or_err(sys_ticket, "", "store-wo-into", IndvOp::SetIn, indv)?;
    Ok(())
}

pub fn store_is_completed_into(uri: &str, value: bool, src: &str, sys_ticket: &str, module: &mut Module) -> Result<(), Box<dyn Error>> {
    let indv = &mut Individual::default();
    indv.set_id(uri);
    indv.set_bool("bpmn:isCompleted", value);

    module.api.update_or_err(sys_ticket, "", src, IndvOp::SetIn, indv)?;
    Ok(())
}

pub fn add_right(subj_uri: &str, obj_uri: &str, ctx: &mut Context, module: &mut Module) -> Result<(), Box<dyn Error>> {
    if subj_uri.is_empty() || obj_uri.is_empty() {
        return Err(Box::new(MyError("empty subj_uri or obj_uri".into())));
    }

    let mut right = Individual::default();
    right.set_id(&generate_unique_uri("wd:r_", ""));
    right.add_uri("rdf:type", "v-s:PermissionStatement");
    right.add_uri("v-s:permissionObject", obj_uri);
    right.add_uri("v-s:permissionSubject", subj_uri);
    right.add_bool("v-s:canRead", true);
    right.add_bool("v-s:canUpdate", true);

    module.api.update_or_err(&ctx.sys_ticket, "", "add-right", IndvOp::Put, &right)?;
    Ok(())
}

pub(crate) fn is_start_form(rdf_types: &[String], onto: &mut Onto) -> bool {
    for itype in rdf_types {
        if itype == "bpmn:StartForm" {
            return true;
        }
        if onto.is_some_entered(&itype, &["bpmn:StartForm"]) {
            return true;
        }
    }
    false
}

pub fn get_individual(module: &mut Module, uri: &str) -> Result<Individual, Box<dyn Error>> {
    let mut indv = Individual::default();
    if uri.is_empty() || !module.storage.get_individual(uri, &mut indv) {
        return Err(Box::new(MyError(format!("individual {} not found", uri))));
    }
    Ok(indv)
}
