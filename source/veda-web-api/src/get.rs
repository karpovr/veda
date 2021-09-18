use crate::auth::TicketCache;
use crate::common::{
    check_ticket, get_individual_from_db, get_module_name, get_ticket, GetOperationStateRequest, QueryRequest, TicketRequest, TicketUriRequest, Uris, BASE_PATH,
};
use crate::Storage;
use actix_web::http::StatusCode;
use actix_web::{get, post};
use actix_web::{web, HttpRequest, HttpResponse};
use futures::lock::Mutex;
use std::io;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::info::ModuleInfo;
use v_common::search::clickhouse_client::CHClient;
use v_common::search::common::FTQuery;
use v_common::search::ft_client::FTClient;
use v_common::v_api::obj::{OptAuthorize, ResultCode};

#[get("/get_operation_state")]
pub(crate) async fn get_operation_state(params: web::Query<GetOperationStateRequest>) -> io::Result<HttpResponse> {
    if let Ok(mut module_info) = ModuleInfo::new(BASE_PATH, get_module_name(params.module_id), true) {
        if let Some(r) = module_info.read_info() {
            return Ok(HttpResponse::Ok().content_type("text/plain").body(r.1.to_string()));
        }
    }
    return Ok(HttpResponse::Ok().content_type("text/plain").body("-1"));
}

pub(crate) async fn query_post(
    req: HttpRequest,
    params: web::Query<QueryRequest>,
    data: web::Json<QueryRequest>,
    ft_client: web::Data<Mutex<FTClient>>,
    ch_client: web::Data<CHClient>,
) -> io::Result<HttpResponse> {
    let ticket = get_ticket(&req, &params.ticket);
    query(&ticket, &*data, ft_client, ch_client).await
}

pub(crate) async fn query_get(params: web::Query<QueryRequest>, ft_client: web::Data<Mutex<FTClient>>, ch_client: web::Data<CHClient>) -> io::Result<HttpResponse> {
    query(&params.ticket, &*params, ft_client, ch_client).await
}

async fn query(ticket: &Option<String>, data: &QueryRequest, ft_client: web::Data<Mutex<FTClient>>, ch_client: web::Data<CHClient>) -> io::Result<HttpResponse> {
    let res = if data.sql.is_some() {
        let user = data.user.clone().unwrap_or_default();
        ch_client
            .select_async(
                &user,
                &data.sql.clone().unwrap_or_default(),
                data.top.unwrap_or_default() as i64,
                data.limit.unwrap_or_default() as i64,
                data.from.unwrap_or_default() as i64,
                OptAuthorize::YES,
            )
            .await?
    } else {
        let ft_req = FTQuery {
            ticket: ticket.clone().unwrap_or_default(),
            user: data.user.clone().unwrap_or_default(),
            query: data.query.clone().unwrap_or_default(),
            sort: data.sort.clone().unwrap_or_default(),
            databases: data.databases.clone().unwrap_or_default(),
            reopen: data.reopen.unwrap_or_default(),
            top: data.top.unwrap_or_default(),
            limit: data.limit.unwrap_or_default(),
            from: data.from.unwrap_or_default(),
        };

        ft_client.lock().await.query(ft_req)
    };
    Ok(HttpResponse::Ok().json(res))
}

#[post("/get_individuals")]
pub(crate) async fn get_individuals(
    params: web::Query<TicketRequest>,
    ticket_cache: web::Data<TicketCache>,
    payload: web::Json<Uris>,
    db: web::Data<Storage>,
    az: web::Data<Mutex<LmdbAzContext>>,
) -> io::Result<HttpResponse> {
    let (res, user_uri) = check_ticket(&Some(params.ticket.clone()), &ticket_cache, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }
    let mut res = vec![];
    let user_uri = user_uri.unwrap_or_default();
    for uri in &payload.uris {
        let (indv, res_code) = get_individual_from_db(uri, &user_uri, &db, Some(&az)).await?;
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
    db: web::Data<Storage>,
    az: web::Data<Mutex<LmdbAzContext>>,
) -> io::Result<HttpResponse> {
    let (res, user_uri) = check_ticket(&params.ticket, &ticket_cache, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

    let (res, res_code) = get_individual_from_db(&params.uri, &user_uri.unwrap_or_default(), &db, Some(&az)).await?;

    if res_code == ResultCode::Ok {
        return Ok(HttpResponse::Ok().json(res.get_obj().as_json()));
    }

    Ok(HttpResponse::new(StatusCode::from_u16(res_code as u16).unwrap()))
}
