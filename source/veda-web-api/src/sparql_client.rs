use crate::common::SparqlResponse;
use actix_web::web;
use awc::Client;
use serde_json::{json, Value};
use std::io::Error;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::module_impl::Module;
use v_common::onto::{XSD_BOOLEAN, XSD_DATE_TIME, XSD_DECIMAL, XSD_DOUBLE, XSD_FLOAT, XSD_INT, XSD_INTEGER, XSD_LONG, XSD_NORMALIZED_STRING, XSD_STRING};
use v_common::search::common::{get_short_prefix, split_full_prefix, PrefixesCache, QueryResult};
use v_common::storage::async_storage::AStorage;
use v_common::v_api::obj::ResultCode;
use v_common::v_authorization::common::{Access, AuthorizationContext};

pub struct SparqlClient {
    pub(crate) point: String,
    pub(crate) client: Client,
    pub(crate) az: LmdbAzContext,
}

impl Default for SparqlClient {
    fn default() -> Self {
        SparqlClient {
            point: format!("{}/{}?{}", Module::get_property("sparql_db").unwrap_or_default(), "query", "default"),
            client: Client::default(),
            az: LmdbAzContext::new(1000),
        }
    }
}

impl SparqlClient {
    pub(crate) async fn query_select_ids(&mut self, user_uri: &str, query: String, _db: web::Data<AStorage>, prefix_cache: web::Data<PrefixesCache>) -> QueryResult {
        let res_req =
            self.client.post(&self.point).header("Content-Type", "application/sparql-query").header("Accept", "application/sparql-results+json").send_body(query).await;

        let mut qres = QueryResult::default();

        if let Ok(mut response) = res_req {
            match response.json::<SparqlResponse>().await {
                Ok(v) => {
                    if v.head.vars.len() > 1 {
                        qres.result_code = ResultCode::BadRequest;
                        return qres;
                    }
                    let var = &v.head.vars[0];
                    debug!("vars:{var:?}");

                    qres.count = v.results.bindings.len() as i64;
                    for el in v.results.bindings {
                        let r = &el[var];
                        if r["type"] == "uri" {
                            if let Some(v) = r["value"].as_str() {
                                let iri = split_full_prefix(v);
                                let prefix = get_short_prefix(iri.0, &prefix_cache);
                                let short_iri = format!("{prefix}:{}", iri.1);

                                if self.az.authorize(&short_iri, user_uri, Access::CanRead as u8, true).unwrap_or(0) != Access::CanRead as u8 {
                                    qres.result.push(short_iri);
                                }
                            }
                        }
                    }
                    qres.processed = qres.result.len() as i64;
                },
                Err(e) => {
                    error!("{:?}", e);
                },
            }
        }

        qres
    }

    pub(crate) async fn query_select(&mut self, _user_uri: &str, query: String, format: &str, prefix_cache: web::Data<PrefixesCache>) -> Result<Value, Error> {
        let res_req =
            self.client.post(&self.point).header("Content-Type", "application/sparql-query").header("Accept", "application/sparql-results+json").send_body(query).await;

        let mut jres = Value::default();

        match res_req {
            Ok(mut response) => match response.json::<SparqlResponse>().await {
                Ok(v) => {
                    let mut v_cols = vec![];

                    for el in &v.head.vars {
                        v_cols.push(Value::String(el.clone()));
                    }
                    jres["cols"] = Value::Array(v_cols);
                    let mut jrows = vec![];

                    for el in v.results.bindings {
                        let mut jrow = if format == "full" {
                            Value::from(serde_json::Map::new())
                        } else {
                            Value::Array(vec![])
                        };
                        for var in &v.head.vars {
                            let r = &el[var];
                            if let (Some(r_type), Some(r_data), r_datatype) = (r.get("type"), r.get("value"), r.get("datatype")) {
                                match (r_type.as_str(), r_data.as_str()) {
                                    (Some("uri"), Some(data)) => {
                                        let iri = split_full_prefix(data);
                                        let prefix = get_short_prefix(iri.0, &prefix_cache);
                                        let short_iri = format!("{prefix}:{}", iri.1);

                                        jrow[var] = json!(short_iri);
                                    },
                                    (Some("literal"), Some(data)) => {
                                        if let Some(dt) = r_datatype {
                                            match dt.as_str() {
                                                Some(XSD_INTEGER) | Some(XSD_INT) | Some(XSD_LONG) => {
                                                    jrow[var] = json!(data.parse::<i64>().unwrap_or_default());
                                                },
                                                Some(XSD_STRING) | Some(XSD_NORMALIZED_STRING) => {
                                                    jrow[var] = json!(data);
                                                },
                                                Some(XSD_BOOLEAN) => {
                                                    jrow[var] = json!(data.parse::<bool>().unwrap_or_default());
                                                },
                                                Some(XSD_DATE_TIME) => {
                                                    jrow[var] = json!(data);
                                                },
                                                Some(XSD_FLOAT) | Some(XSD_DOUBLE) | Some(XSD_DECIMAL) => {
                                                    jrow[var] = json!(data.parse::<f64>().unwrap_or_default());
                                                },
                                                _ => {},
                                            }
                                        } else {
                                            jrow[var] = json!(data);
                                        }
                                    },
                                    _ => {
                                        error!("unknown type: {:?}", r_type.as_str());
                                    },
                                }
                                warn!("type={r_type:?}, value={r_data}");
                            }
                        }
                        jrows.push(jrow);
                    }

                    jres["rows"] = Value::Array(jrows);
                },
                Err(e) => {
                    error!("{:?}", e);
                },
            },
            Err(e) => {
                error!("{:?}", e);
            },
        }

        Ok(jres)
    }
}
