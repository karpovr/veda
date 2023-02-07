use crate::VQLHttpClient;
use actix_web::{web, HttpMessage, HttpRequest};
use async_std::io;
use futures::channel::mpsc::Sender;
use futures::lock::Mutex;
use futures::SinkExt;
use rusty_tarantool::tarantool::{ClientConfig, IteratorType};
use serde_derive::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Error, ErrorKind};
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Instant;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::ticket::Ticket;
use v_common::onto::individual::Individual;
use v_common::onto::parser::parse_raw;
use v_common::search::ft_client::FTClient;
use v_common::storage::async_storage::{get_individual_from_db, get_individual_use_storage_id, AStorage, TICKETS_SPACE_ID};
use v_common::storage::common::{Storage, StorageId, StorageMode};
use v_common::storage::lmdb_storage::LMDBStorage;
use v_common::v_api::obj::ResultCode;

pub(crate) const LIMITATA_COGNOSCI: &[&str] = &["v-s:Credential", "v-s:Connection", "v-s:LinkedNode"];
pub(crate) const BASE_PATH: &str = "./data";

pub type UserId = String;

pub struct UserContextCache {
    pub read_tickets: evmap::ReadHandle<String, Ticket>,
    pub write_tickets: Arc<Mutex<evmap::WriteHandle<String, Ticket>>>,
    pub check_ticket_ip: bool,
    pub are_external_users: bool,
}

pub(crate) enum VQLClientConnectType {
    Direct,
    Http,
    Nng,
    Unknown,
}

pub(crate) struct VQLClient {
    pub(crate) query_type: VQLClientConnectType,
    pub(crate) http_client: Option<VQLHttpClient>,
    pub(crate) nng_client: Option<FTClient>,
    pub(crate) xr: Option<XapianReader>,
}

impl Default for VQLClient {
    fn default() -> Self {
        VQLClient {
            query_type: VQLClientConnectType::Unknown,
            http_client: None,
            nng_client: None,
            xr: None,
        }
    }
}

#[derive(Default)]
pub struct UserInfo {
    pub ticket: Option<String>,
    pub addr: Option<IpAddr>,
    pub user_id: String,
}

pub async fn get_user_info(
    in_ticket: Option<String>,
    req: &HttpRequest,
    ticket_cache: &web::Data<UserContextCache>,
    db: &AStorage,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> Result<UserInfo, ResultCode> {
    let ticket_id = if in_ticket.is_some() {
        in_ticket
    } else {
        get_ticket(req, &None)
    };

    let addr = extract_addr(req);
    let user_id = check_ticket(&ticket_id, ticket_cache, &addr, db, activity_sender).await?;

    Ok(UserInfo {
        ticket: ticket_id,
        addr,
        user_id,
    })
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
    pub(crate) password: Option<String>,
    pub(crate) secret: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct TicketUriRequest {
    pub(crate) ticket: Option<String>,
    pub(crate) user_id: Option<String>,
    pub(crate) uri: String,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct Uris {
    pub(crate) uris: Vec<String>,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct QueryRequest {
    pub stored_query: Option<String>,
    pub params: Option<Value>,
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
        return Some(t.clone());
    } else if let Some(c) = req.cookie("ticket") {
        return Some(c.value().to_owned());
    }

    None
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

    if let Some(v) = req.peer_addr() {
        return Some(v.ip());
    }

    None
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

    let action = if operation.is_empty() {
        "".to_string()
    } else {
        format!("action = {operation}, ")
    };

    let res_str = if res == ResultCode::Zero {
        "".to_string()
    } else {
        format!("{res:?}, ")
    };

    if res == ResultCode::InternalServerError {
        if let Some(t) = start_time {
            error!("{ip}, {ticket_id}, {action}user = {user_id}, {res_str}{args}, time = {:.3} ms", t.elapsed().as_secs_f64() * 1000.0);
        } else {
            error!("{ip}, {ticket_id}, {action}user = {user_id}, {res_str}{args}");
        }
    } else if let Some(t) = start_time {
        info!("{ip},  {ticket_id}, {action}user = {user_id}, {res_str}{args}, time = {:.3} ms", t.elapsed().as_secs_f64() * 1000.0);
    } else {
        info!("{ip},  {ticket_id}, {action}user = {user_id}, {res_str}{args}");
    }
}

pub(crate) fn log(start_time: Option<&Instant>, uinf: &UserInfo, operation: &str, args: &str, res: ResultCode) {
    log_w(start_time, &uinf.ticket, &uinf.addr, &uinf.user_id, operation, args, res);
}

pub(crate) async fn check_ticket(
    w_ticket_id: &Option<String>,
    user_context_cache: &UserContextCache,
    addr: &Option<IpAddr>,
    db: &AStorage,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> Result<String, ResultCode> {
    if w_ticket_id.is_none() {
        return Ok("cfg:Guest".to_owned());
    }

    let ticket_id = w_ticket_id.as_ref().unwrap();
    if ticket_id.is_empty() || ticket_id == "systicket" {
        return Ok("cfg:Guest".to_owned());
    }

    let user_id = if let Some(cached_ticket) = user_context_cache.read_tickets.get(ticket_id) {
        if let Some(ticket_obj) = cached_ticket.get_one() {
            if ticket_obj.is_ticket_valid(addr, user_context_cache.check_ticket_ip) != ResultCode::Ok {
                return Err(ResultCode::TicketNotFound);
            }
            send_user_activity(activity_sender, &ticket_obj.user_uri).await;
            Ok(ticket_obj.user_uri.clone())
        } else {
            Err(ResultCode::TicketNotFound)
        }
    } else {
        let ticket_obj = read_ticket_obj(ticket_id, db).await?;

        if ticket_obj.is_ticket_valid(addr, user_context_cache.check_ticket_ip) != ResultCode::Ok {
            return Err(ResultCode::TicketNotFound);
        }

        let user_uri = ticket_obj.user_uri.clone();

        if user_context_cache.are_external_users {
            check_external_user(&user_uri, db).await?;
        }

        send_user_activity(activity_sender, &user_uri).await;

        //info!("@ upd cache ticket={}", ticket_obj.id);
        let mut t = user_context_cache.write_tickets.lock().await;
        t.insert(ticket_id.to_owned(), ticket_obj);
        t.refresh();

        Ok(user_uri)
    };

    user_id
}

async fn send_user_activity(activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>, user_id: &str) {
    {
        let mut sender = activity_sender.lock().await;
        sender.send(user_id.to_string()).await.unwrap();
    }
}

pub async fn read_system_ticket_id(db: &AStorage) -> io::Result<String> {
    let (mut systicket_info, res_code) = get_individual_use_storage_id(StorageId::Tickets, "systicket", "", db, None).await?;
    if res_code == ResultCode::Ok {
        if let Some(v) = systicket_info.get_first_literal("v-s:resource") {
            return Ok(v);
        }
    }
    Err(Error::new(ErrorKind::Other, format!("fail read system ticket id, err={:?}", res_code)))
}

async fn read_ticket_obj(ticket_id: &str, db: &AStorage) -> Result<Ticket, ResultCode> {
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
    Ok(ticket_obj)
}

pub(crate) async fn check_external_user(user_uri: &str, db: &AStorage) -> Result<(), ResultCode> {
    if let Ok((mut user_indv, res)) = get_individual_from_db(user_uri, "", db, None).await {
        if res == ResultCode::Ok {
            if let Some(o) = user_indv.get_first_literal("v-s:origin") {
                if o != "ExternalUser" {
                    error!("user {user_uri} is not external");
                    return Err(ResultCode::AuthenticationFailed);
                }
            } else {
                error!("user {user_uri} not content field [origin]");
                return Err(ResultCode::AuthenticationFailed);
            }
        } else {
            error!("fail read user {user_uri}, err={res:?}");
            return Err(ResultCode::AuthenticationFailed);
        }
    } else {
        error!("fail read user {user_uri}");
        return Err(ResultCode::AuthenticationFailed);
    }
    Ok(())
}

pub(crate) fn db_connector(tt_config: &Option<ClientConfig>) -> AStorage {
    if let Some(cfg) = &tt_config {
        AStorage {
            tt: Some(cfg.clone().build()),
            lmdb: None,
        }
    } else {
        AStorage {
            tt: None,
            lmdb: Some(Mutex::from(LMDBStorage::new(BASE_PATH, StorageMode::ReadOnly, Some(1000)))),
        }
    }
}
