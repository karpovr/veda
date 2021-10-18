use actix_web::client::Client;
use v_common::search::common::{FTQuery, QueryResult};

pub struct VQLHttpClient {
    pub(crate) point: String,
    pub(crate) client: actix_web::client::Client,
}

impl VQLHttpClient {
    pub fn new(addr: String) -> VQLHttpClient {
        VQLHttpClient {
            point: format!("{}{}", addr, "query").to_string(),
            client: Client::default(),
        }
    }

    pub(crate) async fn query(&mut self, query: FTQuery) -> QueryResult {
        let res = self.client.post(&self.point).header("Content-Type", "application/json").send_json(&query).await;

        let mut qres = QueryResult::default();
        if let Ok(mut response) = res {
            match response.json::<QueryResult>().await {
                Ok(j) => {
                    qres = j;
                }
                Err(e) => {
                    error!("{:?}", e);
                }
            }
        }
        qres
    }
}
