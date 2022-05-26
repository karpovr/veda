use crate::common::{get_ticket, PrefixesCache, QueryRequest, UserInfo, VQLClientConnectType};
use crate::common::{get_user_info, log};
use crate::sparql_client::SparqlClient;
use crate::VQLClient;
use actix_web::http::StatusCode;
use actix_web::{web, HttpRequest, HttpResponse};
use futures::lock::Mutex;
use std::io;
use std::time::Instant;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::common::c_load_onto;
use v_common::onto::individual::Individual;
use v_common::onto::json2individual::parse_json_to_individual;
use v_common::onto::onto_index::OntoIndex;
use v_common::search::clickhouse_client::CHClient;
use v_common::search::common::{prepare_sql_params, FTQuery, QueryResult};
use v_common::storage::async_storage::{get_individual_from_db, AStorage, TicketCache};
use v_common::v_api::obj::{OptAuthorize, ResultCode};

pub(crate) async fn query_post(
    req: HttpRequest,
    params: web::Query<QueryRequest>,
    data: web::Json<QueryRequest>,
    vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    sparql_client: web::Data<Mutex<SparqlClient>>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    prefix_cache: web::Data<PrefixesCache>,
) -> io::Result<HttpResponse> {
    let uinf = match get_user_info(get_ticket(&req, &params.ticket), &req, &ticket_cache, &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };
    query(uinf, &*data, vql_client, ch_client, sparql_client, db, az, prefix_cache).await
}

pub(crate) async fn query_get(
    data: web::Query<QueryRequest>,
    vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    sparql_client: web::Data<Mutex<SparqlClient>>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    prefix_cache: web::Data<PrefixesCache>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let uinf = match get_user_info(data.ticket.to_owned(), &req, &ticket_cache, &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };
    query(uinf, &*data, vql_client, ch_client, sparql_client, db, az, prefix_cache).await
}

async fn query(
    uinf: UserInfo,
    data: &QueryRequest,
    vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    sparql_client: web::Data<Mutex<SparqlClient>>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    prefix_cache: web::Data<PrefixesCache>,
) -> io::Result<HttpResponse> {
    if data.stored_query.is_some() {
        stored_query(uinf, data, vql_client, ch_client, sparql_client, db, az, prefix_cache).await
    } else {
        direct_query(uinf, &*data, vql_client, ch_client, sparql_client, db, prefix_cache).await
    }
}

async fn stored_query(
    uinf: UserInfo,
    data: &QueryRequest,
    _vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    _sparql_client: web::Data<Mutex<SparqlClient>>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    _prefix_cache: web::Data<PrefixesCache>,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let mut params = Individual::default();

    if let (Some(stored_query_id), Some(v)) = (&data.stored_query, &data.params) {
        if parse_json_to_individual(v, &mut params) {
            let (mut stored_query_indv, res_code) = get_individual_from_db(stored_query_id, &uinf.user_id, &db, Some(&az)).await?;
            if res_code != ResultCode::Ok {
                return Ok(HttpResponse::new(StatusCode::from_u16(res_code as u16).unwrap()));
            }

            let format = stored_query_indv.get_first_literal("v-s:resultFormat").unwrap_or("full".to_owned());
            if let (Some(source), Some(query_string)) = (stored_query_indv.get_first_literal("v-s:source"), stored_query_indv.get_first_literal("v-s:queryString")) {
                if let Ok(sql) = prepare_sql_params(&query_string, &mut params, &source) {
                    warn!("{}", sql);
                    match source.as_str() {
                        "clickhouse" => {
                            let res = ch_client.lock().await.query_select_async(&sql, &format).await?;
                            log(Some(&start_time), &uinf, "stored_query", &format!("{}", stored_query_id), ResultCode::Ok);
                            return Ok(HttpResponse::Ok().json(res));
                        },
                        "mysql" => {
                            return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::NotImplemented as u16).unwrap()));
                        },
                        _ => {
                            return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::NotImplemented as u16).unwrap()));
                        },
                    }
                }
            }
        }
    }

    log(Some(&start_time), &uinf, "stored_query", &format!("{:?}", data), ResultCode::BadRequest);
    return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()));
}

async fn direct_query(
    uinf: UserInfo,
    data: &QueryRequest,
    vql_client: web::Data<Mutex<VQLClient>>,
    ch_client: web::Data<Mutex<CHClient>>,
    sparql_client: web::Data<Mutex<SparqlClient>>,
    db: web::Data<AStorage>,
    prefix_cache: web::Data<PrefixesCache>,
) -> io::Result<HttpResponse> {
    let mut res = QueryResult::default();
    let ticket_id = uinf.ticket.clone().unwrap_or_default();

    if data.sparql.is_some() {
        res = sparql_client.lock().await.prepare_query(&uinf.user_id, data.sparql.clone().unwrap(), db, prefix_cache).await;
    } else if data.sql.is_some() {
        let req = FTQuery {
            ticket: "".to_owned(),
            user: uinf.user_id.to_owned(),
            query: data.sql.clone().unwrap_or_default(),
            sort: "".to_string(),
            databases: "".to_string(),
            reopen: false,
            top: data.top.unwrap_or_default(),
            limit: data.limit.unwrap_or_default(),
            from: data.from.unwrap_or_default(),
        };
        log(None, &uinf, "query", &format!("{}, top = {}, limit = {}, from = {}", &req.query, req.top, req.limit, req.from), ResultCode::Ok);
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

        req.user = uinf.user_id.to_owned();

        if !(req.query.contains("==") || req.query.contains("&&") || req.query.contains("||")) {
            req.query = "'*' == '".to_owned() + &req.query + "'";
        }

        req.query = req.query.replace('\n', " ");

        log(
            None,
            &uinf,
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
                    res = n.query(&uinf.ticket, &uinf.addr, req).await;
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
