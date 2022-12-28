use crate::common::{extract_addr, get_user_info, log, log_w, TicketRequest, UserContextCache, UserId};
use actix_web::http::StatusCode;
use actix_web::{put, web, HttpRequest, HttpResponse};
use futures::channel::mpsc::Sender;
use futures::lock::Mutex;
use serde_json::json;
use serde_json::value::Value as JSONValue;
use std::io;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Instant;
use v_common::onto::individual::Individual;
use v_common::onto::json2individual::parse_json_to_individual;
use v_common::storage::async_storage::AStorage;
use v_common::v_api::api_client::{IndvOp, MStorageClient};
use v_common::v_api::obj::ResultCode;

pub(crate) async fn update(
    action: &str,
    addr: Option<IpAddr>,
    params: web::Query<TicketRequest>,
    cmd: IndvOp,
    data: web::Json<JSONValue>,
    request: HttpRequest,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    mstorage: web::Data<Mutex<MStorageClient>>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = match get_user_info(params.ticket.clone(), &request, &ticket_cache, &db, activity_sender).await {
        Ok(u) => u,
        Err(res) => {
            log_w(Some(&start_time), &params.ticket, &extract_addr(&request), "", action, "", res);
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    if let Some(v) = data.into_inner().as_object() {
        let event_id = if let Some(d) = v.get("event_id") {
            d.as_str().unwrap_or("")
        } else {
            ""
        };
        let src = if let Some(d) = v.get("src") {
            d.as_str().unwrap_or("")
        } else {
            ""
        };
        let assigned_subsystems = if let Some(d) = v.get("assigned_subsystems") {
            d.as_i64().unwrap_or(0)
        } else {
            0
        };

        let mut inds = vec![];

        if let Some(jseg) = v.get("individuals") {
            if let Some(jvec) = jseg.as_array() {
                for ji in jvec {
                    let mut new_indv = Individual::default();
                    if parse_json_to_individual(ji, &mut new_indv) && !new_indv.get_id().is_empty() {
                        inds.push(new_indv);
                    }
                }
            }
        } else {
            let mut new_indv = Individual::default();
            if let Some(i) = v.get("individual") {
                if !parse_json_to_individual(i, &mut new_indv) {
                    log(Some(&start_time), &uinf, action, &i.to_string(), ResultCode::BadRequest);
                    return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()));
                }
            } else if let Some(i) = v.get("uri") {
                if let Some(v) = i.as_str() {
                    new_indv.set_id(v);
                }
            } else {
                log(Some(&start_time), &uinf, action, "", ResultCode::BadRequest);
                return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()));
            }

            if new_indv.get_id().is_empty() {
                log(Some(&start_time), &uinf, action, new_indv.get_id(), ResultCode::InvalidIdentifier);
                return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::InvalidIdentifier as u16).unwrap()));
            }
            inds.push(new_indv);
        }

        let mut ms = mstorage.lock().await;

        let mut ind_ids: String = String::new();
        for el in &inds {
            if !ind_ids.is_empty() {
                ind_ids.push(',');
            }
            ind_ids.push_str(el.get_id());
        }

        if ms.check_ticket_ip && addr.is_none() {
            log(Some(&start_time), &uinf, action, &ind_ids, ResultCode::TicketExpired);
            return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::TicketExpired as u16).unwrap()));
        }

        let ticket = uinf.ticket.clone().unwrap_or_default();
        return match ms.updates_use_param_with_addr((&ticket, uinf.addr), event_id, src, assigned_subsystems, cmd, &inds) {
            Ok(r) => {
                log(Some(&start_time), &uinf, action, &ind_ids, r.result);
                if r.result == ResultCode::Ok {
                    Ok(HttpResponse::Ok().json(json!({"op_id":r.op_id,"result":r.result})))
                } else {
                    Ok(HttpResponse::new(StatusCode::from_u16(r.result as u16).unwrap()))
                }
            },
            Err(e) => {
                log(Some(&start_time), &uinf, action, &ind_ids, e.result);
                Ok(HttpResponse::new(StatusCode::from_u16(e.result as u16).unwrap()))
            },
        };
    }

    log(Some(&start_time), &uinf, action, "", ResultCode::BadRequest);
    Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()))
}

#[put("/put_individuals")]
pub(crate) async fn put_individuals(
    params: web::Query<TicketRequest>,
    data: web::Json<JSONValue>,
    mstorage: web::Data<Mutex<MStorageClient>>,
    req: HttpRequest,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    update("put_individuals", extract_addr(&req), params, IndvOp::Put, data, req, ticket_cache, db, mstorage, activity_sender).await
}

#[put("/put_individual")]
pub(crate) async fn put_individual(
    params: web::Query<TicketRequest>,
    data: web::Json<JSONValue>,
    mstorage: web::Data<Mutex<MStorageClient>>,
    req: HttpRequest,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    update("put_individual", extract_addr(&req), params, IndvOp::Put, data, req, ticket_cache, db, mstorage, activity_sender).await
}

#[put("/remove_individual")]
pub(crate) async fn remove_individual(
    req: HttpRequest,
    params: web::Query<TicketRequest>,
    data: web::Json<JSONValue>,
    mstorage: web::Data<Mutex<MStorageClient>>,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    update("remove_individual", extract_addr(&req), params, IndvOp::Remove, data, req, ticket_cache, db, mstorage, activity_sender).await
}

#[put("/add_to_individual")]
pub(crate) async fn add_to_individual(
    req: HttpRequest,
    params: web::Query<TicketRequest>,
    data: web::Json<JSONValue>,
    mstorage: web::Data<Mutex<MStorageClient>>,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    update("add_to_individual", extract_addr(&req), params, IndvOp::AddTo, data, req, ticket_cache, db, mstorage, activity_sender).await
}

#[put("/set_in_individual")]
pub(crate) async fn set_in_individual(
    req: HttpRequest,
    params: web::Query<TicketRequest>,
    data: web::Json<JSONValue>,
    mstorage: web::Data<Mutex<MStorageClient>>,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    update("set_in_individual", extract_addr(&req), params, IndvOp::SetIn, data, req, ticket_cache, db, mstorage, activity_sender).await
}

#[put("/remove_from_individual")]
pub(crate) async fn remove_from_individual(
    req: HttpRequest,
    params: web::Query<TicketRequest>,
    data: web::Json<JSONValue>,
    mstorage: web::Data<Mutex<MStorageClient>>,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    update("remove_from_individual", extract_addr(&req), params, IndvOp::RemoveFrom, data, req, ticket_cache, db, mstorage, activity_sender).await
}
