use crate::auth::TicketCache;
use crate::Storage;
use actix_web::{web, HttpMessage, HttpRequest};
use rusty_tarantool::tarantool::IteratorType;
use serde_derive::{Deserialize, Serialize};
use std::io;
use std::sync::Mutex;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::ticket::Ticket;
use v_common::onto::individual::Individual;
use v_common::onto::parser::parse_raw;
use v_common::storage::storage::{Storage as MStorage, StorageId};
use v_common::v_api::obj::ResultCode;
use v_common::v_authorization::common::{Access, AuthorizationContext};

pub(crate) const INDIVIDUALS_SPACE_ID: i32 = 512;
pub(crate) const TICKETS_SPACE_ID: i32 = 513;

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

async fn check_indv_access_read(mut indv: Individual, uri: &str, user_uri: &str, az: &web::Data<Mutex<LmdbAzContext>>) -> io::Result<(Individual, ResultCode)> {
    if az.lock().unwrap().authorize(uri, user_uri, Access::CanRead as u8, false, None).unwrap_or(0) != Access::CanRead as u8 {
        return Ok((indv, ResultCode::NotAuthorized));
    }

    if indv.get_id().is_empty() {
        return Ok((indv, ResultCode::NotFound));
    }
    indv.parse_all();
    return Ok((indv, ResultCode::Ok));
}

pub(crate) async fn get_individual_from_db(
    uri: &str,
    user_uri: &str,
    db: &web::Data<Storage>,
    az: &web::Data<Mutex<LmdbAzContext>>,
) -> io::Result<(Individual, ResultCode)> {
    if let Some(tt) = &db.tt {
        let response = tt.select(INDIVIDUALS_SPACE_ID, 0, &(uri,), 0, 100, IteratorType::EQ).await?;

        let mut iraw = Individual::default();
        iraw.set_raw(&response.data[5..]);
        if parse_raw(&mut iraw).is_ok() {
            return check_indv_access_read(iraw, uri, user_uri, az).await;
        }
        return Ok((iraw, ResultCode::UnprocessableEntity));
    }
    if let Some(lmdb) = &db.lmdb {
        let mut iraw = Individual::default();
        if lmdb.lock().unwrap().get_individual_from_db(StorageId::Individuals, &uri, &mut iraw) {
            return check_indv_access_read(iraw, uri, user_uri, az).await;
        } else {
            return Ok((Individual::default(), ResultCode::NotFound));
        }
    }

    return Ok((Individual::default(), ResultCode::UnprocessableEntity));
}

pub(crate) async fn check_ticket(w_ticket_id: &Option<String>, ticket_cache: &web::Data<TicketCache>, db: &Storage) -> io::Result<(ResultCode, Option<String>)> {
    if w_ticket_id.is_none() {
        return Ok((ResultCode::Ok, Some("cfg:Guest".to_owned())));
    }

    let ticket_id = w_ticket_id.as_ref().unwrap();
    if ticket_id == "" || ticket_id == "systicket" {
        return Ok((ResultCode::Ok, Some("cfg:Guest".to_owned())));
    }

    if let Some(cached_ticket) = ticket_cache.read.get(&ticket_id.to_owned()) {
        if let Some(t) = cached_ticket.get_one() {
            if t.is_ticket_valid() != ResultCode::Ok {
                return Ok((ResultCode::TicketNotFound, None));
            }
            return Ok((ResultCode::Ok, Some(t.user_uri.clone())));
        } else {
            return Ok((ResultCode::TicketNotFound, None));
        }
    } else {
        let mut ticket_obj = Ticket::default();

        if let Some(tt) = &db.tt {
            let response = tt.select(TICKETS_SPACE_ID, 0, &(&ticket_id,), 0, 100, IteratorType::EQ).await?;

            let mut to = Individual::default();
            to.set_raw(&response.data[5..]);
            if parse_raw(&mut to).is_ok() {
                ticket_obj.update_from_individual(&mut to);
                ticket_obj.result = ResultCode::Ok;
            }
        }
        if let Some(lmdb) = &db.lmdb {
            let mut to = Individual::default();
            if lmdb.lock().unwrap().get_individual_from_db(StorageId::Tickets, &ticket_id, &mut to) {
                ticket_obj.update_from_individual(&mut to);
                ticket_obj.result = ResultCode::Ok;
            }
        }

        if ticket_obj.result != ResultCode::Ok {
            return Ok((ResultCode::TicketNotFound, None));
        }
        if ticket_obj.is_ticket_valid() != ResultCode::Ok {
            return Ok((ResultCode::TicketNotFound, None));
        }

        let user_uri = ticket_obj.user_uri.clone();
        if let Ok(mut t) = ticket_cache.write.lock() {
            t.insert(ticket_id.to_owned(), ticket_obj);
            t.refresh();
        }
        return Ok((ResultCode::Ok, Some(user_uri)));
    }
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
    } else {
        if let Some(c) = req.cookie("ticket") {
            return Some(c.value().to_owned());
        }
    }
    None
}
