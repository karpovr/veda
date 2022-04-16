use actix_web::{HttpMessage, HttpRequest};
use async_std::sync::Arc;
use futures::lock::Mutex;
use serde_derive::{Deserialize, Serialize};
use serde_json::Value;
use std::net::IpAddr;
use v_common::onto::onto_index::OntoIndex;
use v_common::storage::async_storage::{get_individual_from_db, AStorage};

pub(crate) const BASE_PATH: &str = "./data";

pub struct PrefixesCache {
    pub read: evmap::ReadHandle<String, String>,
    pub write: Arc<Mutex<evmap::WriteHandle<String, String>>>,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct SparqlResponse {
    pub head: Head,
    pub results: Bindings,
}
#[derive(Serialize, Deserialize)]
pub(crate) struct Head {
    pub vars: Vec<String>,
}
#[derive(Serialize, Deserialize)]
pub(crate) struct Bindings {
    pub bindings: Vec<Value>,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct GetTicketTrustedRequest {
    pub ticket: String,
    pub(crate) login: Option<String>,
    pub(crate) ip: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct TicketRequest {
    pub ticket: Option<String>,
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
    pub sparql: Option<String>,
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

pub(crate) async fn get_short_prefix(storage: &AStorage, full_prefix: &str, prefixes_cache: &PrefixesCache) -> String {
    if prefixes_cache.read.is_empty() {
        let mut t = prefixes_cache.write.lock().await;
        let onto_index = OntoIndex::load();
        for id in onto_index.data.keys() {
            if let Ok((mut rindv, _res)) = get_individual_from_db(id, "", storage, None).await {
                rindv.parse_all();

                if rindv.any_exists("rdf:type", &["owl:Ontology"]) {
                    if let Some(full_url) = rindv.get_first_literal("v-s:fullUrl") {
                        debug!("prefix : {} -> {}", rindv.get_id(), full_url);
                        let short_prefix = rindv.get_id().trim_end_matches(':');

                        t.insert(full_url, short_prefix.to_owned());
                    }
                }
            } else {
                error!("failed to read individual {}", id);
            }
            t.refresh();
        }
    }

    if let Some(v) = prefixes_cache.read.get(full_prefix) {
        if let Some(t) = v.get_one() {
            return t.to_string();
        }
    }

    full_prefix.to_owned()
}

pub(crate) fn extract_addr(req: &HttpRequest) -> Option<IpAddr> {
    if let Some(xf) = req.headers().get(actix_web::http::header::HeaderName::from_static("x-real-ip")) {
        if let Ok(xfu) = xf.to_str() {
            let (f1, _) = xfu.split_once(',').unwrap_or((xfu, ""));
            if let Ok(a) = f1.parse::<IpAddr>() {
                return Some(a);
            }
        }
    }

    Some(req.peer_addr().unwrap().ip())
}

pub(crate) fn log(w_user_id: Option<&str>, w_ticket: &Option<String>, addr: &Option<IpAddr>, operation: &str, args: &str) {
    let ip = if let Some(a) = addr {
        a.to_string()
    } else {
        "unknown".to_string()
    };

    let ticket_id = if let Some(t) = w_ticket {
        if let Some(part) = t.get(0..7) {
            part
        } else {
            "unknown"
        }
    } else {
        "unknown"
    };

    let user_id = w_user_id.unwrap_or("unknown");

    info!("{} {} {} {} = {}", ip, user_id, ticket_id, operation, args);
}
