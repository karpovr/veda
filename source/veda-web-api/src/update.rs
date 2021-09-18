use crate::common::TicketRequest;
use actix_web::http::StatusCode;
use actix_web::{put, web, HttpResponse};
use futures::lock::Mutex;
use serde_json::json;
use serde_json::value::Value as JSONValue;
use std::io;
use v_common::onto::individual::Individual;
use v_common::onto::json2individual::parse_json_to_individual;
use v_common::v_api::api_client::{IndvOp, MStorageClient};
use v_common::v_api::obj::ResultCode;

pub(crate) async fn update(
    params: web::Query<TicketRequest>,
    cmd: IndvOp,
    data: web::Json<JSONValue>,
    mstorage: web::Data<Mutex<MStorageClient>>,
) -> io::Result<HttpResponse> {
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
                    return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()));
                }
            } else if let Some(i) = v.get("uri") {
                if let Some(v) = i.as_str() {
                    new_indv.set_id(v);
                }
            } else {
                return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()));
            }

            if new_indv.get_id().is_empty() {
                return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::InvalidIdentifier as u16).unwrap()));
            }
            inds.push(new_indv);
        }

        return match mstorage.lock().await.updates_use_param(&params.ticket, event_id, src, assigned_subsystems, cmd, &inds) {
            Ok(r) => {
                if r.result == ResultCode::Ok {
                    Ok(HttpResponse::Ok().json(json!({"op_id":r.op_id,"result":r.result})))
                } else {
                    Ok(HttpResponse::new(StatusCode::from_u16(r.result as u16).unwrap()))
                }
            }
            Err(e) => Ok(HttpResponse::new(StatusCode::from_u16(e.result as u16).unwrap())),
        };
    }

    Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()))
}

#[put("/put_individuals")]
async fn put_individuals(params: web::Query<TicketRequest>, data: web::Json<JSONValue>, mstorage: web::Data<Mutex<MStorageClient>>) -> io::Result<HttpResponse> {
    update(params, IndvOp::Put, data, mstorage).await
}

#[put("/put_individual")]
async fn put_individual(params: web::Query<TicketRequest>, data: web::Json<JSONValue>, mstorage: web::Data<Mutex<MStorageClient>>) -> io::Result<HttpResponse> {
    update(params, IndvOp::Put, data, mstorage).await
}

#[put("/remove_individual")]
async fn remove_individual(params: web::Query<TicketRequest>, data: web::Json<JSONValue>, mstorage: web::Data<Mutex<MStorageClient>>) -> io::Result<HttpResponse> {
    update(params, IndvOp::Remove, data, mstorage).await
}

#[put("/add_to_individual")]
async fn add_to_individual(params: web::Query<TicketRequest>, data: web::Json<JSONValue>, mstorage: web::Data<Mutex<MStorageClient>>) -> io::Result<HttpResponse> {
    update(params, IndvOp::AddTo, data, mstorage).await
}

#[put("/set_in_individual")]
async fn set_in_individual(params: web::Query<TicketRequest>, data: web::Json<JSONValue>, mstorage: web::Data<Mutex<MStorageClient>>) -> io::Result<HttpResponse> {
    update(params, IndvOp::SetIn, data, mstorage).await
}

#[put("/remove_from_individual")]
async fn remove_from_individual(params: web::Query<TicketRequest>, data: web::Json<JSONValue>, mstorage: web::Data<Mutex<MStorageClient>>) -> io::Result<HttpResponse> {
    update(params, IndvOp::RemoveFrom, data, mstorage).await
}
