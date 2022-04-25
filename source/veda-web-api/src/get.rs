use crate::common::{get_module_name, GetOperationStateRequest, TicketRequest, TicketUriRequest, Uris, BASE_PATH};
use crate::common::{get_user_info, log};
use actix_web::http::StatusCode;
use actix_web::{get, post};
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::Utc;
use futures::lock::Mutex;
use std::io;
use std::time::Instant;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::info::ModuleInfo;
use v_common::onto::individual::Individual;
use v_common::storage::async_storage::{get_individual_from_db, AStorage, TicketCache};
use v_common::v_api::obj::ResultCode;
use v_common::v_queue::consumer::Consumer;
use v_common::v_queue::record::Mode;

const QUEUE_STATE_PREFIX: &str = "srv:queue-state-";
const MAIN_QUEUE_NAME: &str = "individuals-flow";
const MAIN_QUEUE_PATH: &str = "./data/queue";

#[get("/get_operation_state")]
pub(crate) async fn get_operation_state(params: web::Query<GetOperationStateRequest>) -> io::Result<HttpResponse> {
    if let Ok(mut module_info) = ModuleInfo::new(BASE_PATH, get_module_name(params.module_id), true) {
        if let Some(r) = module_info.read_info() {
            return Ok(HttpResponse::Ok().content_type("text/plain").body(r.1.to_string()));
        }
    }
    return Ok(HttpResponse::Ok().content_type("text/plain").body("-1"));
}

#[post("/get_individuals")]
pub(crate) async fn get_individuals(
    params: web::Query<TicketRequest>,
    ticket_cache: web::Data<TicketCache>,
    payload: web::Json<Uris>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = match get_user_info(params.ticket.to_owned(), &req, &ticket_cache, &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    let mut res = vec![];

    log(Some(&start_time), &uinf, "get_individuals", &format!("{:?}", payload.uris), ResultCode::Ok);

    for uri in &payload.uris {
        let (indv, res_code) = get_individual_from_db(uri, &uinf.user_id, &db, Some(&az)).await?;
        if res_code == ResultCode::Ok {
            res.push(indv.get_obj().as_json());
        }
    }
    Ok(HttpResponse::Ok().json(res))
}

#[get("/get_individual")]
pub(crate) async fn get_individual(
    params: web::Query<TicketUriRequest>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = match get_user_info(params.ticket.to_owned(), &req, &ticket_cache, &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    if params.uri.contains(QUEUE_STATE_PREFIX) {
        if let Some(consumer_name) = &params.uri.strip_prefix(QUEUE_STATE_PREFIX) {
            match Consumer::new_with_mode(MAIN_QUEUE_PATH, consumer_name, MAIN_QUEUE_NAME, Mode::Read) {
                Ok(mut queue_consumer) => {
                    if queue_consumer.get_info() {
                        let now = Utc::now().naive_utc().timestamp();

                        let mut individual = Individual::default();
                        individual.set_id(&params.uri);
                        individual.add_uri("rdf:type", "v-s:AppInfo");
                        individual.add_datetime("v-s:created", now);
                        individual.add_uri("srv:queue", &format!("srv:{}-{}", QUEUE_STATE_PREFIX, consumer_name));
                        individual.add_integer("srv:total_count", queue_consumer.queue.count_pushed as i64);
                        individual.add_integer("srv:current_count", queue_consumer.count_popped as i64);

                        let v = individual.get_obj().as_json();
                        log(Some(&start_time), &uinf, "get_individual", &params.uri, ResultCode::Ok);
                        debug!("Ok, {}", v);
                        return Ok(HttpResponse::Ok().json(v));
                    }
                },
                Err(e) => {
                    log(Some(&start_time), &uinf, "get_individual", &params.uri, ResultCode::InternalServerError);
                    error!("fail open consumer {}, err={:?}", consumer_name, e);
                },
            }
        }
        return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::InternalServerError as u16).unwrap()));
    }

    let (res, res_code) = get_individual_from_db(&params.uri, &uinf.user_id, &db, Some(&az)).await?;
    log(Some(&start_time), &uinf, "get_individual", &params.uri, res_code);
    if res_code == ResultCode::Ok {
        let v = res.get_obj().as_json();
        debug!("Ok {:?} {}", res_code, v);
        return Ok(HttpResponse::Ok().json(v));
    }

    debug!("{:?}", res_code);
    Ok(HttpResponse::new(StatusCode::from_u16(res_code as u16).unwrap()))
}
