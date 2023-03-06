#[macro_use]
extern crate log;
#[macro_use]
extern crate lazy_static;

mod auth;
mod common;

use crate::auth::*;
use crate::common::{create_sys_ticket, get_ticket_trusted, logout, read_auth_configuration, AuthConf, UserStat};
use nng::{Message, Protocol, Socket};
use serde_json::json;
use serde_json::value::Value as JSONValue;
use std::collections::HashMap;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::module_impl::{init_log, Module};
use v_common::module::veda_backend::{get_storage_with_prop, Backend};
use v_common::storage::common::{StorageMode, VStorage};

fn main() -> std::io::Result<()> {
    init_log("AUTH");

    let auth_url = Module::get_property("auth_url").expect("param [auth_url] not found in veda.properties");

    let server = Socket::new(Protocol::Rep0)?;
    if let Err(e) = server.listen(&auth_url) {
        error!("failed to listen, err = {:?}", e);
        return Ok(());
    }

    let mut backend = Backend::create(StorageMode::ReadWrite, false);
    let mut backup_storage = get_storage_with_prop(StorageMode::ReadWrite, "backup_db_connection");
    info!("connect to AUTHORIZE DB...");
    let mut auth_data = VStorage::new_lmdb("./data", StorageMode::ReadOnly, None);

    let systicket = if let Ok(t) = backend.get_sys_ticket_id() {
        t
    } else {
        error!("failed to get system ticket, create new");
        create_sys_ticket(&mut backend.storage, &mut backup_storage).id
    };

    let mut suspicious: HashMap<String, UserStat> = HashMap::new();

    let conf = read_auth_configuration(&mut backend);

    if let Some(mut xr) = XapianReader::new("russian", &mut backend.storage) {
        loop {
            if let Ok(recv_msg) = server.recv() {
                let res = req_prepare(&conf, &recv_msg, &systicket, &mut xr, &mut backend, &mut backup_storage, &mut suspicious, &mut auth_data);
                if let Err(e) = server.send(res) {
                    error!("failed to send, err = {:?}", e);
                }
            }
        }
    } else {
        error!("failed to init ft-query");
    }
    Ok(())
}

fn req_prepare(
    conf: &AuthConf,
    request: &Message,
    systicket: &str,
    xr: &mut XapianReader,
    backend: &mut Backend,
    backup_storage: &mut VStorage,
    suspicious: &mut HashMap<String, UserStat>,
    auth_data: &mut VStorage,
) -> Message {
    let v: JSONValue = if let Ok(v) = serde_json::from_slice(request.as_slice()) {
        v
    } else {
        JSONValue::Null
    };

    match v["function"].as_str().unwrap_or_default() {
        "authenticate" => {
            let login = v["login"].as_str().unwrap_or_default();
            let password = v["password"].as_str().unwrap_or_default();
            let secret = v["secret"].as_str().unwrap_or_default();
            let ip = v["addr"].as_str().unwrap_or_default();

            let user_stat = suspicious.entry(login.to_owned()).or_insert_with(UserStat::default);

            let mut ah = AuthWorkPlace {
                conf,
                login,
                password,
                ip,
                secret,
                sys_ticket: systicket,
                xr,
                backend,
                backup_storage,
                auth_data,
                user_stat,
                stored_password: "".to_owned(),
                stored_salt: "".to_string(),
                edited: 0,
                credential: &mut Default::default(),
                is_permanent: false,
            };

            let ticket = ah.authenticate();

            info!("{:?}", ticket);

            let mut res = JSONValue::default();
            res["type"] = json!("ticket");
            res["id"] = json!(ticket.id);
            res["user_uri"] = json!(ticket.user_uri);
            res["user_login"] = json!(ticket.user_login);
            res["result"] = json!(ticket.result as i64);
            res["end_time"] = json!(ticket.end_time);

            return Message::from(res.to_string().as_bytes());
        },
        "get_ticket_trusted" => {
            let ticket = get_ticket_trusted(conf, v["ticket"].as_str(), v["login"].as_str(), v["addr"].as_str(), xr, backend, backup_storage, auth_data);

            let mut res = JSONValue::default();
            res["type"] = json!("ticket");
            res["id"] = json!(ticket.id);
            res["user_uri"] = json!(ticket.user_uri);
            res["user_login"] = json!(ticket.user_login);
            res["result"] = json!(ticket.result as i64);
            res["end_time"] = json!(ticket.end_time);

            return Message::from(res.to_string().as_bytes());
        },
        "logout" => {
            let ticket = logout(conf, v["ticket"].as_str(), v["addr"].as_str(), backend, backup_storage);

            let mut res = JSONValue::default();
            res["type"] = json!("ticket");
            res["id"] = json!(ticket.id);
            res["result"] = json!(ticket.result as i64);
            res["end_time"] = json!(ticket.end_time);

            return Message::from(res.to_string().as_bytes());
        },
        _ => {
            error!("unknown command {:?}", v["function"].as_str());
        },
    }

    Message::default()
}
