use crate::common::{
    extract_addr, get_module_name, log_w, GetOperationStateRequest, TicketRequest, TicketUriRequest, Uris, UserContextCache, UserId, UserInfo, BASE_PATH,
    LIMITATA_COGNOSCI,
};
use crate::common::{get_user_info, log};
use actix_web::http::StatusCode;
use actix_web::{get, post};
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::Utc;
use futures::channel::mpsc::Sender;
use futures::lock::Mutex;
use std::io;
use std::sync::Arc;
use std::time::Instant;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::info::ModuleInfo;
use v_common::onto::individual::Individual;
use v_common::storage::async_storage::{check_user_in_group, get_individual_from_db, AStorage};
use v_common::v_api::obj::ResultCode;
use v_common::v_queue::consumer::Consumer;
use v_common::v_queue::record::Mode;

pub const SUPER_USER_GROUP: &str = "cfg:SuperUser";

const QUEUE_STATE_PREFIX: &str = "srv:queue-state-";
const MAIN_QUEUE_NAME: &str = "individuals-flow";
const MAIN_QUEUE_PATH: &str = "./data/queue";

#[get("/get_operation_state")]
pub(crate) async fn get_operation_state(params: web::Query<GetOperationStateRequest>, req: HttpRequest) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = UserInfo {
        ticket: None,
        addr: extract_addr(&req),
        user_id: String::new(),
    };
    let module_name = get_module_name(params.module_id);
    if let Ok(mut module_info) = ModuleInfo::new(BASE_PATH, module_name, true) {
        if let Some(r) = module_info.read_info() {
            log(Some(&start_time), &uinf, "get_operation_state", module_name, ResultCode::Ok);
            return Ok(HttpResponse::Ok().content_type("text/plain").body(r.1.to_string()));
        }
    }
    log(Some(&start_time), &uinf, "get_operation_state", module_name, ResultCode::Ok);
    return Ok(HttpResponse::Ok().content_type("text/plain").body("-1"));
}

#[post("/get_individuals")]
pub(crate) async fn get_individuals(
    params: web::Query<TicketRequest>,
    ticket_cache: web::Data<UserContextCache>,
    payload: web::Json<Uris>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = match get_user_info(params.ticket.to_owned(), &req, &ticket_cache, &db, activity_sender).await {
        Ok(u) => u,
        Err(res) => {
            log_w(Some(&start_time), &params.ticket, &extract_addr(&req), "", "get_individuals", "", res);
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    let mut res = vec![];

    log(Some(&start_time), &uinf, "get_individuals", &format!("{:?}", payload.uris), ResultCode::Ok);

    for uri in &payload.uris {
        let (mut indv, res_code) = get_individual_from_db(uri, &uinf.user_id, &db, Some(&az)).await?;
        if res_code == ResultCode::Ok {
            if !indv.any_exists("rdf:type", LIMITATA_COGNOSCI) {
                res.push(indv.get_obj().as_json());
            } else if let Ok(b) = check_user_in_group(&uinf.user_id, SUPER_USER_GROUP, Some(&az)).await {
                if b {
                    res.push(indv.get_obj().as_json());
                }
            }
        }
    }
    Ok(HttpResponse::Ok().json(res))
}

#[get("/get_individual")]
pub(crate) async fn get_individual(
    params: web::Query<TicketUriRequest>,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = match get_user_info(params.ticket.clone(), &req, &ticket_cache, &db, activity_sender).await {
        Ok(u) => u,
        Err(res) => {
            log_w(Some(&start_time), &params.ticket, &extract_addr(&req), "", "get_individual", "", res);
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    let id = if params.uri.contains('%') {
        if let Ok(v) = urlencoding::decode(&params.uri) {
            v.to_string()
        } else {
            log_w(Some(&start_time), &params.ticket, &extract_addr(&req), "", "get_individual", "", ResultCode::BadRequest);
            return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()));
        }
    } else {
        params.uri.clone()
    };

    if id.contains(QUEUE_STATE_PREFIX) {
        if let Some(consumer_name) = &id.strip_prefix(QUEUE_STATE_PREFIX) {
            match Consumer::new_with_mode(MAIN_QUEUE_PATH, consumer_name, MAIN_QUEUE_NAME, Mode::Read) {
                Ok(mut queue_consumer) => {
                    if queue_consumer.get_info() {
                        let now = Utc::now().naive_utc().timestamp();

                        let mut individual = Individual::default();
                        individual.set_id(&id);
                        individual.add_uri("rdf:type", "v-s:AppInfo");
                        individual.add_datetime("v-s:created", now);
                        individual.add_uri("srv:queue", &format!("srv:{QUEUE_STATE_PREFIX}-{consumer_name}"));
                        individual.add_integer("srv:total_count", queue_consumer.queue.count_pushed as i64);
                        individual.add_integer("srv:current_count", queue_consumer.count_popped as i64);

                        let v = individual.get_obj().as_json();
                        log(Some(&start_time), &uinf, "get_individual", &id, ResultCode::Ok);
                        return Ok(HttpResponse::Ok().json(v));
                    }
                },
                Err(e) => {
                    log(Some(&start_time), &uinf, "get_individual", &id, ResultCode::InternalServerError);
                    error!("fail open consumer {consumer_name}, err={e:?}");
                },
            }
        }
        return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::InternalServerError as u16).unwrap()));
    }

    let (mut res, res_code) = get_individual_from_db(&id, &uinf.user_id, &db, Some(&az)).await?;
    log(Some(&start_time), &uinf, "get_individual", &id, res_code);
    if res_code == ResultCode::Ok {
        return if res.any_exists("rdf:type", LIMITATA_COGNOSCI) {
            if let Ok(b) = check_user_in_group(&uinf.user_id, SUPER_USER_GROUP, Some(&az)).await {
                if b {
                    return Ok(HttpResponse::Ok().json(res.get_obj().as_json()));
                }
            }
            Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::NotAuthorized as u16).unwrap()))
        } else {
            Ok(HttpResponse::Ok().json(res.get_obj().as_json()))
        };
    }

    debug!("{:?}", res_code);
    Ok(HttpResponse::new(StatusCode::from_u16(res_code as u16).unwrap()))
}
