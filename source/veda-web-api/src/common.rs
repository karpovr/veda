use actix_web::{web, HttpMessage, HttpRequest};
use async_std::sync::Arc;
use futures::lock::Mutex;
use rusty_tarantool::tarantool::IteratorType;
use serde_derive::{Deserialize, Serialize};
use serde_json::Value;
use std::net::IpAddr;
use std::time::Instant;
use v_common::module::ticket::Ticket;
use v_common::onto::individual::Individual;
use v_common::onto::onto_index::OntoIndex;
use v_common::onto::parser::parse_raw;
use v_common::storage::async_storage::{get_individual_from_db, AStorage, TicketCache, TICKETS_SPACE_ID};
use v_common::storage::common::{Storage, StorageId};
use v_common::v_api::obj::ResultCode;

pub(crate) const BASE_PATH: &str = "./data";

#[derive(Default)]
pub struct UserInfo {
    pub ticket: Option<String>,
    pub addr: Option<IpAddr>,
    pub user_id: String,
}

pub async fn get_user_info(in_ticket: Option<String>, req: &HttpRequest, ticket_cache: &web::Data<TicketCache>, db: &AStorage) -> Result<UserInfo, ResultCode> {
    let ticket = if in_ticket.is_some() {
        in_ticket
    } else {
        get_ticket(req, &None)
    };

    let addr = extract_addr(req);
    match check_ticket(&ticket, ticket_cache, &addr, db).await {
        Ok(user_id) => Ok(UserInfo {
            ticket,
            addr,
            user_id,
        }),
        Err(res) => Err(res),
    }
}

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

pub(crate) fn log_w(start_time: Option<&Instant>, ticket: &Option<String>, addr: &Option<IpAddr>, user_id: &str, operation: &str, args: &str, res: ResultCode) {
    let ip = if let Some(a) = addr {
        a.to_string()
    } else {
        "?".to_string()
    };

    let ticket_id = if let Some(t) = &ticket {
        if let Some(part) = t.get(0..7) {
            part
        } else {
            "      ?"
        }
    } else {
        "      ?"
    };

    if res == ResultCode::InternalServerError {
        if let Some(t) = start_time {
            error!("{}, {}, action = {}, user = {}, {:?}, {:?}, time = {} ms", ip, ticket_id, operation, user_id, res, args, t.elapsed().as_millis());
        } else {
            error!("{}, {}, action = {}, user = {}, {:?}, {:?}", ip, ticket_id, operation, user_id, res, args);
        }
    } else {
        if let Some(t) = start_time {
            info!("{},  {}, action = {}, user = {}, {:?}, {:?}, time = {} ms", ip, ticket_id, operation, user_id, res, args, t.elapsed().as_millis());
        } else {
            info!("{},  {}, action = {}, user = {}, {:?}, {:?}", ip, ticket_id, operation, user_id, res, args);
        }
    }
}

pub(crate) fn log(start_time: Option<&Instant>, uinf: &UserInfo, operation: &str, args: &str, res: ResultCode) {
    log_w(start_time, &uinf.ticket, &uinf.addr, &uinf.user_id, operation, args, res)
}

pub(crate) async fn check_ticket(w_ticket_id: &Option<String>, ticket_cache: &TicketCache, addr: &Option<IpAddr>, db: &AStorage) -> Result<String, ResultCode> {
    if w_ticket_id.is_none() {
        return Ok("cfg:Guest".to_owned());
    }

    let ticket_id = w_ticket_id.as_ref().unwrap();
    if ticket_id.is_empty() || ticket_id == "systicket" {
        return Ok("cfg:Guest".to_owned());
    }

    if let Some(cached_ticket) = ticket_cache.read.get(ticket_id) {
        if let Some(t) = cached_ticket.get_one() {
            if t.is_ticket_valid(addr, ticket_cache.check_ticket_ip) != ResultCode::Ok {
                return Err(ResultCode::TicketNotFound);
            }
            Ok(t.user_uri.clone())
        } else {
            Err(ResultCode::TicketNotFound)
        }
    } else {
        let mut ticket_obj = Ticket::default();

        if let Some(tt) = &db.tt {
            let response = match tt.select(TICKETS_SPACE_ID, 0, &(&ticket_id,), 0, 100, IteratorType::EQ).await {
                Ok(r) => r,
                Err(_) => {
                    return Err(ResultCode::TicketNotFound);
                },
            };

            let mut to = Individual::default();
            to.set_raw(&response.data[5..]);
            if parse_raw(&mut to).is_ok() {
                ticket_obj.update_from_individual(&mut to);
                ticket_obj.result = ResultCode::Ok;
            }
        }
        if let Some(lmdb) = &db.lmdb {
            let mut to = Individual::default();
            if lmdb.lock().await.get_individual_from_db(StorageId::Tickets, ticket_id, &mut to) {
                ticket_obj.update_from_individual(&mut to);
                ticket_obj.result = ResultCode::Ok;
            }
        }

        if ticket_obj.result != ResultCode::Ok {
            return Err(ResultCode::TicketNotFound);
        }
        if ticket_obj.is_ticket_valid(addr, ticket_cache.check_ticket_ip) != ResultCode::Ok {
            return Err(ResultCode::TicketNotFound);
        }

        let user_uri = ticket_obj.user_uri.clone();

        if ticket_cache.are_external_users {
            if let Err(e) = check_external_user(&user_uri, db).await {
                return Err(e);
            }
        }

        let mut t = ticket_cache.write.lock().await;
        t.insert(ticket_id.to_owned(), ticket_obj);
        //info!("ticket cache size = {}", t.len());
        t.refresh();

        return Ok(user_uri);
    }
}

pub(crate) async fn check_external_user(user_uri: &str, db: &AStorage) -> Result<(), ResultCode> {
    if let Ok((mut user_indv, res)) = get_individual_from_db(&user_uri, "", db, None).await {
        if res == ResultCode::Ok {
            if let Some(o) = user_indv.get_first_literal("v-s:origin") {
                if o != "ExternalUser" {
                    error!("user {} is not external", user_uri);
                    return Err(ResultCode::NotAuthorized);
                }
            } else {
                error!("user {} not content field [origin]", user_uri);
                return Err(ResultCode::NotAuthorized);
            }
        } else {
            error!("fail read user {}, err={:?}", user_uri, res);
            return Err(ResultCode::NotAuthorized);
        }
    } else {
        error!("fail read user {}", user_uri);
        return Err(ResultCode::NotAuthorized);
    }
    Ok(())
}
