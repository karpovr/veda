use crate::common::{get_ticket, QueryRequest, UserContextCache, UserId, UserInfo, VQLClientConnectType};
use crate::common::{get_user_info, log};
use crate::sparql_client::SparqlClient;
use crate::VQLClient;
use actix_web::http::StatusCode;
use actix_web::{web, HttpRequest, HttpResponse};
use futures::channel::mpsc::Sender;
use futures::lock::Mutex;
use std::io;
use std::sync::Arc;
use std::time::Instant;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::common::c_load_onto;
use v_common::onto::individual::Individual;
use v_common::onto::json2individual::parse_json_to_individual;
use v_common::onto::onto_index::OntoIndex;
use v_common::search::clickhouse_client::CHClient;
use v_common::search::common::{load_prefixes, FTQuery, PrefixesCache, QueryResult};
use v_common::search::sparql_params::prepare_sparql_params;
use v_common::search::sql_params::prepare_sql_with_params;
use v_common::storage::async_storage::{get_individual_from_db, AStorage};
use v_common::v_api::obj::{OptAuthorize, ResultCode};

pub(crate) struct QueryEndpoints {
    pub vql_client: Mutex<VQLClient>,
    pub ch_client: Mutex<CHClient>,
    pub sparql_client: Mutex<SparqlClient>,
}

pub(crate) async fn query_post(
    req: HttpRequest,
    params: web::Query<QueryRequest>,
    data: web::Json<QueryRequest>,
    query_endpoints: web::Data<QueryEndpoints>,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    prefix_cache: web::Data<PrefixesCache>,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    let uinf = match get_user_info(get_ticket(&req, &params.ticket), &req, &ticket_cache, &db, activity_sender).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };
    match query(uinf, &data, query_endpoints, db, az, prefix_cache).await {
        Ok(res) => Ok(res),
        Err(_) => Ok(HttpResponse::new(StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

pub(crate) async fn query_get(
    data: web::Query<QueryRequest>,
    query_endpoints: web::Data<QueryEndpoints>,
    ticket_cache: web::Data<UserContextCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    prefix_cache: web::Data<PrefixesCache>,
    req: HttpRequest,
    activity_sender: web::Data<Arc<Mutex<Sender<UserId>>>>,
) -> io::Result<HttpResponse> {
    let uinf = match get_user_info(data.ticket.clone(), &req, &ticket_cache, &db, activity_sender).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };
    match query(uinf, &data, query_endpoints, db, az, prefix_cache).await {
        Ok(res) => Ok(res),
        Err(_) => Ok(HttpResponse::new(StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

async fn query(
    uinf: UserInfo,
    data: &QueryRequest,
    query_endpoints: web::Data<QueryEndpoints>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    prefix_cache: web::Data<PrefixesCache>,
) -> io::Result<HttpResponse> {
    if uinf.ticket.is_none() {
        return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::NotAuthorized as u16).unwrap()));
    }
    if data.stored_query.is_some() {
        stored_query(uinf, data, query_endpoints, db, az, prefix_cache).await
    } else {
        direct_query(uinf, data, query_endpoints, db, prefix_cache).await
    }
}

async fn stored_query(
    uinf: UserInfo,
    data: &QueryRequest,
    query_endpoints: web::Data<QueryEndpoints>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    prefix_cache: web::Data<PrefixesCache>,
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
            if let (Some(source), Some(mut query_string)) = (stored_query_indv.get_first_literal("v-s:source"), stored_query_indv.get_first_literal("v-s:queryString")) {
                // replace {paramN} to '{paramN}'
                for pr in &params.get_predicates() {
                    if pr.starts_with("v-s:param") {
                        let pb = "{".to_owned() + pr + "}";
                        query_string = query_string.replace(&pb, &format!("'{}'", &pr));
                    }
                }

                match source.as_str() {
                    "clickhouse" => {
                        if let Ok(sql) = prepare_sql_with_params(&query_string, &mut params, &source) {
                            warn!("{sql}");
                            let res = query_endpoints.ch_client.lock().await.query_select_async(&sql, &format).await?;
                            log(Some(&start_time), &uinf, "stored_query", stored_query_id, ResultCode::Ok);
                            return Ok(HttpResponse::Ok().json(res));
                        }
                    },
                    "oxygraph" => {
                        if prefix_cache.full2short_r.is_empty() {
                            load_prefixes(&db, &prefix_cache).await;
                        }

                        if let Ok(sparql) = prepare_sparql_params(&query_string, &mut params, &prefix_cache) {
                            warn!("{sparql}");
                            let res = query_endpoints.sparql_client.lock().await.query_select(&uinf.user_id, sparql, &format, prefix_cache).await?;
                            log(Some(&start_time), &uinf, "stored_query", stored_query_id, ResultCode::Ok);
                            return Ok(HttpResponse::Ok().json(res));
                        }
                        return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::NotImplemented as u16).unwrap()));
                    },
                    _ => {
                        return Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::NotImplemented as u16).unwrap()));
                    },
                }
            }
        }
    }

    log(Some(&start_time), &uinf, "stored_query", &format!("{data:?}"), ResultCode::BadRequest);
    Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()))
}

fn add_out_element(id: &str, ctx: &mut Vec<String>) {
    ctx.push(id.to_owned());
}

async fn direct_query(
    uinf: UserInfo,
    data: &QueryRequest,
    query_endpoints: web::Data<QueryEndpoints>,
    db: web::Data<AStorage>,
    prefix_cache: web::Data<PrefixesCache>,
) -> io::Result<HttpResponse> {
    let mut res = QueryResult::default();
    let ticket_id = uinf.ticket.clone().unwrap_or_default();

    if data.sparql.is_some() {
        res = query_endpoints.sparql_client.lock().await.query_select_ids(&uinf.user_id, data.sparql.clone().unwrap(), db, prefix_cache).await;
    } else if data.sql.is_some() {
        let mut req = FTQuery {
            ticket: String::new(),
            user: uinf.user_id.clone(),
            query: data.sql.clone().unwrap_or_default(),
            sort: String::new(),
            databases: String::new(),
            reopen: false,
            top: data.top.unwrap_or_default(),
            limit: data.limit.unwrap_or_default(),
            from: data.from.unwrap_or_default(),
        };
        log(None, &uinf, "query", &format!("{}, top = {}, limit = {}, from = {}", &req.query, req.top, req.limit, req.from), ResultCode::Ok);

        match prepare_sql_with_params(&req.query.replace('`', "\""), &mut Individual::default(), "clickhouse") {
            Ok(sql) => {
                info!("{sql}");
                req.query = sql;
                res = query_endpoints.ch_client.lock().await.select_async(req, OptAuthorize::YES).await?;
            },
            Err(e) => {
                error!("{:?}", e);
                return Ok(HttpResponse::new(StatusCode::INTERNAL_SERVER_ERROR));
            },
        }
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

        req.user = uinf.user_id.clone();

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

        let mut vc = query_endpoints.vql_client.lock().await;

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

    if res.result_code == ResultCode::Ok {
        log(
            None,
            &uinf,
            "",
            &format!("result: count = {}, time(ms): query = {}, authorize = {}, total = {}", res.count, res.query_time, res.authorize_time, res.total_time),
            ResultCode::Ok,
        );

        Ok(HttpResponse::Ok().json(res))
    } else {
        log(None, &uinf, "", "", res.result_code);

        Ok(HttpResponse::new(StatusCode::from_u16(res.result_code as u16).unwrap()))
    }
}
