use awc::Client;
use std::net::IpAddr;
use v_common::search::common::{FTQuery, QueryResult};

pub struct VQLHttpClient {
    pub(crate) point: String,
    pub(crate) client: Client,
}

impl VQLHttpClient {
    pub fn new(addr: &str) -> VQLHttpClient {
        VQLHttpClient {
            point: format!("{addr}{}", "query"),
            client: Client::default(),
        }
    }

    pub(crate) async fn query(&mut self, ticket: &Option<String>, addr: &Option<IpAddr>, query: FTQuery) -> QueryResult {
        let mut cl = self.client.post(format!("{}?ticket={}", &self.point, ticket.as_ref().unwrap_or(&String::new()))).header("Content-Type", "application/json");

        if let Some(a) = addr {
            cl = cl.header("X-Real-IP", a.to_string());
        }
        let res = cl.send_json(&query).await;

        let mut qres = QueryResult::default();
        if let Ok(mut response) = res {
            match response.json::<QueryResult>().await {
                Ok(j) => {
                    qres = j;
                },
                Err(e) => {
                    error!("{:?}", e);
                },
            }
        }
        qres
    }
}
