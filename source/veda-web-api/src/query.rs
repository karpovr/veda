use crate::common::log;
use crate::common::{extract_addr, get_ticket, PrefixesCache, QueryRequest};
use crate::sparql_client::SparqlClient;
use crate::vql_query_client::VQLHttpClient;
use actix_web::http::StatusCode;
use actix_web::{web, HttpRequest, HttpResponse};
use futures::lock::Mutex;
use std::io;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::common::c_load_onto;
use v_common::onto::onto_index::OntoIndex;
use v_common::search::clickhouse_client::CHClient;
use v_common::search::common::{FTQuery, QueryResult};
use v_common::search::ft_client::FTClient;
use v_common::storage::async_storage::{check_ticket, AStorage, TicketCache};
use v_common::v_api::obj::{OptAuthorize, ResultCode};

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

pub(crate) async fn query_post(
    req: HttpRequest,
    params: web::Query<QueryRequest>,
    data: web::Json<QueryRequest>,
    vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    sparql_client: web::Data<Mutex<SparqlClient>>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    prefix_cache: web::Data<PrefixesCache>,
) -> io::Result<HttpResponse> {
    let ticket = get_ticket(&req, &params.ticket);
    query(&ticket, &*data, ticket_cache, vql_client, ch_client, sparql_client, db, prefix_cache, req).await
}

pub(crate) async fn query_get(
    params: web::Query<QueryRequest>,
    vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    sparql_client: web::Data<Mutex<SparqlClient>>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    prefix_cache: web::Data<PrefixesCache>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    query(&params.ticket, &*params, ticket_cache, vql_client, ch_client, sparql_client, db, prefix_cache, req).await
}

async fn query(
    ticket: &Option<String>,
    data: &QueryRequest,
    ticket_cache: web::Data<TicketCache>,
    vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    sparql_client: web::Data<Mutex<SparqlClient>>,
    db: web::Data<AStorage>,
    prefix_cache: web::Data<PrefixesCache>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let addr = extract_addr(&req);
    let user_id = match check_ticket(&ticket, &ticket_cache, &extract_addr(&req), &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    let mut res = QueryResult::default();
    let ticket_id = ticket.clone().unwrap_or_default();

    if data.sparql.is_some() {
        res = sparql_client.lock().await.prepare_query(&user_id, data.sparql.clone().unwrap(), db, prefix_cache).await;
    } else if data.sql.is_some() {
        let req = FTQuery {
            ticket: "".to_owned(),
            user: user_id,
            query: data.sql.clone().unwrap_or_default(),
            sort: "".to_string(),
            databases: "".to_string(),
            reopen: false,
            top: data.top.unwrap_or_default(),
            limit: data.limit.unwrap_or_default(),
            from: data.from.unwrap_or_default(),
        };
        log(Some(&req.user), ticket, &addr, "query", &format!("{}, top = {}, limit = {}, from = {}", &req.query, req.top, req.limit, req.from), ResultCode::Ok);
        res = ch_client.lock().await.select_async(req, OptAuthorize::YES).await?;
    } else {
        let mut req = FTQuery {
            ticket: ticket_id.clone(),
            user: data.user.clone().unwrap_or_default(),
            query: data.query.clone().unwrap_or_default(),
            sort: data.sort.clone().unwrap_or_default(),
            databases: data.databases.clone().unwrap_or_default(),
            reopen: data.reopen.unwrap_or_default(),
            top: data.top.unwrap_or_default(),
            limit: data.limit.unwrap_or_default(),
            from: data.from.unwrap_or_default(),
        };

        let mut res_out_list = vec![];
        fn add_out_element(id: &str, ctx: &mut Vec<String>) {
            ctx.push(id.to_owned());
        }

        req.user = user_id;

        if !(req.query.contains("==") || req.query.contains("&&") || req.query.contains("||")) {
            req.query = "'*' == '".to_owned() + &req.query + "'";
        }

        req.query = req.query.replace('\n', " ");

        log(
            Some(&req.user),
            ticket,
            &addr,
            "query",
            &format!("{}, sort = {}, db = {}, top = {}, limit = {}, from = {}", &req.query, req.sort, req.databases, req.top, req.limit, req.from),
            ResultCode::Ok,
        );

        let mut vc = vql_client.lock().await;

        match vc.query_type {
            VQLClientConnectType::Direct => {
                if let Some(xr) = vc.xr.as_mut() {
                    if let Some(t) = OntoIndex::get_modified() {
                        if t > xr.onto_modified {
                            c_load_onto(&db, &mut xr.onto).await;
                            xr.onto_modified = t;
                        }
                    }
                    if xr.index_schema.is_empty() {
                        xr.c_load_index_schema(&db).await;
                    }

                    res = xr.query_use_collect_fn(&req, add_out_element, OptAuthorize::YES, &mut res_out_list).await.unwrap();
                    res.result = res_out_list;
                }
            },
            VQLClientConnectType::Http => {
                if let Some(n) = vc.http_client.as_mut() {
                    res = n.query(ticket, &addr, req).await;
                }
            },
            VQLClientConnectType::Nng => {
                if let Some(n) = vc.nng_client.as_mut() {
                    res = n.query(req);
                }
            },
            VQLClientConnectType::Unknown => {},
        }
    }

    info!("Ok, count = {}, time: query = {}, authorize = {}, total = {}", res.count, res.query_time, res.authorize_time, res.total_time);
    Ok(HttpResponse::Ok().json(res))
}
