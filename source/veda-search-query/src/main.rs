#[macro_use]
extern crate log;

use nng::{Message, Protocol, Socket};
use serde_json::value::Value as JSONValue;
use std::time::*;
use std::{str, thread};
use v_common::module::module_impl::{init_log, Module};
use v_common::module::veda_backend::Backend;
use v_common::search::clickhouse_client::CHClient;
use v_common::search::common::FTQuery;
use v_common::v_api::obj::OptAuthorize;
use v_common::v_api::obj::*;

fn main() {
    init_log("SEARCH_QUERY");

    let query_search_db = Module::get_property("query_search_db").expect("param [query_search_db_url] not found in veda.properties");
    let query_url = Module::get_property("search_query_url").expect("param [search_query_url] not found in veda.properties");

    let mut backend = Backend::default();
    let mut ch_client = CHClient::new(query_search_db);

    loop {
        if ch_client.connect() {
            break;
        }
        thread::sleep(Duration::from_millis(10000));
    }

    let server = Socket::new(Protocol::Rep0).unwrap();
    if let Err(e) = server.listen(&query_url) {
        error!("failed to listen {}, err = {:?}", query_url, e);
        return;
    }

    loop {
        if let Ok(recv_msg) = server.recv() {
            let out_msg = req_prepare(&mut backend, &recv_msg, &mut ch_client);
            if let Err(e) = server.send(out_msg) {
                error!("failed to send answer, err = {:?}", e);
            }
        }
    }
}

const TICKET: usize = 0;
const QUERY: usize = 1;
const TOP: usize = 5;
const LIMIT: usize = 6;
const FROM: usize = 7;

fn req_prepare(backend: &mut Backend, request: &Message, ch_client: &mut CHClient) -> Message {
    if let Ok(s) = str::from_utf8(request.as_slice()) {
        let v: JSONValue = if let Ok(v) = serde_json::from_slice(s.as_bytes()) {
            v
        } else {
            JSONValue::Null
        };

        if let Some(a) = v.as_array() {
            let ticket_id = a.get(TICKET).unwrap().as_str().unwrap_or_default();
            let query = a.get(QUERY).unwrap().as_str().unwrap_or_default();

            let limit = a.get(LIMIT).unwrap().as_i64().unwrap_or_default();
            let top = a.get(TOP).unwrap().as_i64().unwrap_or(limit);
            let from = a.get(FROM).unwrap().as_i64().unwrap_or_default();

            let mut user_uri = "cfg:Guest".to_owned();
            if !ticket_id.is_empty() {
                let ticket = backend.get_ticket_from_db(ticket_id);
                if ticket.result == ResultCode::Ok {
                    user_uri = ticket.user_uri;
                }
            }

            let req = FTQuery {
                ticket: "".to_string(),
                user: user_uri,
                query: query.to_owned(),
                sort: "".to_string(),
                databases: "".to_string(),
                reopen: false,
                top: top as i32,
                limit: limit as i32,
                from: from as i32,
            };
            let res = ch_client.select(req, OptAuthorize::YES);
            info!("found & authorized: {}, query time: {}, authorize time: {}", res.count, res.query_time, res.authorize_time);
            if let Ok(s) = serde_json::to_string(&res) {
                return Message::from(s.as_bytes());
            }
        }
    }
    return Message::from("[]".as_bytes());
}
