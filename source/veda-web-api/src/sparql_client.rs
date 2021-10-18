use crate::common::{get_short_prefix, PrefixesCache, SparqlResponse};
use actix_web::client::Client;
use actix_web::web;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::module::Module;
use v_common::search::common::QueryResult;
use v_common::storage::async_storage::AStorage;
use v_common::v_api::obj::ResultCode;
use v_common::v_authorization::common::{Access, AuthorizationContext};

pub struct SparqlClient {
    pub(crate) point: String,
    pub(crate) client: actix_web::client::Client,
    pub(crate) az: LmdbAzContext,
}

impl Default for SparqlClient {
    fn default() -> Self {
        SparqlClient {
            point: format!("{}/{}?{}", Module::get_property("sparql_db").unwrap_or_default(), "query", "default").to_string(),
            client: Client::default(),
            az: LmdbAzContext::new(),
        }
    }
}

impl SparqlClient {
    pub(crate) async fn prepare_query(&mut self, user_uri: &str, query: String, db: web::Data<AStorage>, prefix_cache: web::Data<PrefixesCache>) -> QueryResult {
        let res =
            self.client.post(&self.point).header("Content-Type", "application/sparql-query").header("Accept", "application/sparql-results+json").send_body(query).await;

        let mut qres = QueryResult::default();

        if let Ok(mut response) = res {
            match response.json::<SparqlResponse>().await {
                Ok(v) => {
                    if v.head.vars.len() > 1 {
                        qres.result_code = ResultCode::BadRequest;
                        return qres;
                    }
                    let var = &v.head.vars[0];
                    println!("vars:{:?}", var);

                    qres.count = v.results.bindings.len() as i64;
                    for el in v.results.bindings {
                        let r = &el[var];
                        if r["type"] == "uri" {
                            if let Some(v) = r["value"].as_str() {
                                let pos = if let Some(n) = v.rfind('/') {
                                    n
                                } else {
                                    v.rfind('#').unwrap_or_default()
                                };

                                let iri = v.split_at(pos + 1);
                                let prefix = get_short_prefix(&db, iri.0, &prefix_cache).await;

                                let short_iri = format!("{}:{}", prefix, iri.1);

                                if self.az.authorize(&short_iri, user_uri, Access::CanRead as u8, true).unwrap_or(0) != Access::CanRead as u8 {
                                    qres.result.push(short_iri);
                                }
                            }
                        }
                    }
                    qres.processed = qres.result.len() as i64;
                }
                Err(e) => {
                    error!("{:?}", e);
                }
            }
        }

        qres
    }
}
