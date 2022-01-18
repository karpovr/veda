#[macro_use]
extern crate log;

use futures::executor::block_on;
use nng::options::{Options, RecvTimeout, SendTimeout};
use nng::{Error, Message, Protocol, Socket};
use serde_json::value::Value as JSONValue;
use std::time::Duration;
use std::{env, str};
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::common::load_onto;
use v_common::module::module::{init_log, Module};
use v_common::module::veda_backend::Backend;
use v_common::onto::onto_index::OntoIndex;
use v_common::search::common::FTQuery;
use v_common::v_api::obj::*;

fn main() {
    init_log("FT_QUERY");

    let mut query_url = Module::get_property("ft_query_service_url").expect("param [search_query_url] not found in veda.properties").to_owned();

    let args: Vec<String> = env::args().collect();
    for el in args.iter() {
        if el.starts_with("--bind") {
            let p: Vec<&str> = el.split('=').collect();
            query_url = p[1].to_owned().trim().to_owned();
            info!("use arg bind = {}", query_url);
        }
    }

    let mut module = Backend::default();

    if let Some(mut xr) = XapianReader::new("russian", &mut module.storage) {
        let mut count = 0;
        loop {
            let server = Socket::new(Protocol::Rep0).unwrap();

            if let Err(e) = server.set_opt::<RecvTimeout>(Some(Duration::from_secs(30))) {
                error!("failed to set recv timeout, url = {}, err = {}", query_url, e);
                return;
            }
            if let Err(e) = server.set_opt::<SendTimeout>(Some(Duration::from_secs(30))) {
                error!("failed to set send timeout, url = {}, err = {}", query_url, e);
                return;
            }

            if let Err(e) = server.listen(&query_url) {
                error!("failed to listen, url = {}, err = {:?}", query_url, e);
                return;
            }

            info!("listen {}", query_url);

            loop {
                match server.recv() {
                    Ok(recv_msg) => {
                        count += 1;
                        let out_msg = if let Ok(s) = str::from_utf8(recv_msg.as_slice()) {
                            if s.len() > 2 {
                                req_prepare(&mut module, s, &mut xr)
                            } else {
                                Message::from("[]".as_bytes())
                            }
                        } else {
                            Message::from("[]".as_bytes())
                        };

                        if let Err(e) = server.send(out_msg) {
                            error!("failed to send answer, err = {:?}", e);
                            break;
                        }
                    }
                    Err(e) => match e {
                        Error::TimedOut => {
                            info!("count requests: {}", count);
                            break;
                        }
                        _ => {
                            error!("failed to get request, err = {:?}", e);
                            break;
                        }
                    },
                }
            }
            server.close();
        }
    } else {
        error!("failed to init ft-query");
    }
}

const TICKET: usize = 0;
const QUERY: usize = 1;
const SORT: usize = 2;
const DATABASES: usize = 3;
//const REOPEN: usize = 4;
const TOP: usize = 5;
const LIMIT: usize = 6;
const FROM: usize = 7;

fn req_prepare(backend: &mut Backend, s: &str, xr: &mut XapianReader) -> Message {
    let v: JSONValue = if let Ok(v) = serde_json::from_slice(s.as_bytes()) {
        v
    } else {
        JSONValue::Null
    };

    if let Some(a) = v.as_array() {
        let ticket_id = a.get(TICKET).unwrap().as_str().unwrap_or_default();
        let mut query = a.get(QUERY).unwrap().as_str().unwrap_or_default().to_string();

        if !(query.find("==").is_some() || query.find("&&").is_some() || query.find("||").is_some()) {
            query = "'*' == '".to_owned() + &query + "'";
        }

        query = query.replace('\n', " ");

        let sort = a.get(SORT).unwrap().as_str().unwrap_or_default().to_string();
        let databases = a.get(DATABASES).unwrap().as_str().unwrap_or_default().to_string();

        let top = a.get(TOP).unwrap().as_i64().unwrap_or_default() as i32;
        let limit = a.get(LIMIT).unwrap().as_i64().unwrap_or_default() as i32;
        let from = a.get(FROM).unwrap().as_i64().unwrap_or_default() as i32;

        let mut user_uri = "cfg:Guest".to_owned();
        if !ticket_id.is_empty() {
            if ticket_id.starts_with("UU=") {
                user_uri = ticket_id.trim_start_matches("UU=").to_owned();
            } else {
                let ticket = backend.get_ticket_from_db(&ticket_id);
                if ticket.result == ResultCode::Ok {
                    user_uri = ticket.user_uri;
                }
            }
        }

        let mut ctx = vec![];
        fn add_out_element(id: &str, ctx: &mut Vec<String>) {
            ctx.push(id.to_owned());
        }

        let request = FTQuery {
            ticket: "".to_string(),
            user: user_uri,
            query,
            sort,
            databases,
            reopen: false,
            top,
            limit,
            from,
        };

        info!(
            "ticket = {}, user = {}, query = {}, sort = {}, db = {}, top = {}, limit = {}, from = {}",
            ticket_id, request.user, request.query, request.sort, request.databases, request.top, request.limit, request.from
        );

        if let Some(t) = OntoIndex::get_modified() {
            if t > xr.onto_modified {
                load_onto(&mut backend.storage, &mut xr.onto);
                xr.onto_modified = t;
            }
        }
        if xr.index_schema.is_empty() {
            xr.load_index_schema(&mut backend.storage);
        }

        if let Ok(mut res) = block_on(xr.query_use_collect_fn(&request, add_out_element, OptAuthorize::YES, &mut ctx)) {
            res.result = ctx;
            info!("count = {}, time: query = {}, authorize = {}, total = {}", res.count, res.query_time, res.authorize_time, res.total_time);
            if let Ok(s) = serde_json::to_string(&res) {
                return Message::from(s.as_bytes());
            }
        }
    }
    Message::from("[]".as_bytes())
}
