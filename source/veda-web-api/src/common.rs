use actix_web::{HttpMessage, HttpRequest};
use serde_derive::{Deserialize, Serialize};

pub(crate) const BASE_PATH: &str = "./data";

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct TicketRequest {
    pub ticket: String,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct GetOperationStateRequest {
    pub(crate) module_id: u64,
    wait_op_id: String,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct AuthenticateRequest {
    pub(crate) login: String,
    pub(crate) password: String,
    pub(crate) secret: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct TicketUriRequest {
    pub(crate) ticket: Option<String>,
    pub(crate) uri: String,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct Uris {
    pub(crate) uris: Vec<String>,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct QueryRequest {
    pub ticket: Option<String>,
    pub user: Option<String>,
    pub sql: Option<String>,
    pub query: Option<String>,
    pub sort: Option<String>,
    pub databases: Option<String>,
    pub reopen: Option<bool>,
    pub top: Option<i32>,
    pub limit: Option<i32>,
    pub from: Option<i32>,
}

pub(crate) fn get_module_name(id: u64) -> &'static str {
    match id {
        1 => "subject_manager",
        2 => "acl_preparer",
        4 => "fulltext_indexer",
        8 => "fanout_email",
        16 => "scripts_main",
        32 => "ticket_manager",
        64 => "file_reader",
        128 => "fanout_sql_np",
        256 => "scripts_lp",
        512 => "ltr_scripts",
        1024 => "fanout_sql_lp",
        _ => "unknown",
    }
}

pub(crate) fn get_ticket(req: &HttpRequest, in_ticket: &Option<String>) -> Option<String> {
    if let Some(t) = in_ticket {
        return Some(t.to_owned());
    } else if let Some(c) = req.cookie("ticket") {
        return Some(c.value().to_owned());
    }

    None
}
