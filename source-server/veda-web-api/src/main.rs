#[macro_use]
extern crate log;

mod auth;
mod common;
mod files;
mod get;
mod query;
mod sparql_client;
mod update;
mod user_activity;
mod vql_query_client;

extern crate serde_derive;
extern crate serde_json;

use crate::auth::{authenticate_get, authenticate_post, get_membership, get_rights, get_rights_origin, get_ticket_trusted, is_ticket_valid, logout};
use crate::common::{db_connector, UserContextCache, VQLClient, VQLClientConnectType};
use crate::files::{load_file, save_file};
use crate::get::{get_individual, get_individuals, get_operation_state};
use crate::query::{query_get, query_post, QueryEndpoints};
use crate::sparql_client::SparqlClient;
use crate::update::{add_to_individual, put_individual, put_individuals, remove_from_individual, remove_individual, set_in_individual};
use crate::user_activity::user_activity_manager;
use crate::vql_query_client::VQLHttpClient;
use actix_files::{Files, NamedFile};
use actix_web::rt::System;
use actix_web::{get, head, middleware, web, App, HttpResponse, HttpServer};
use futures::channel::mpsc;
use futures::lock::Mutex;
use futures::{select, FutureExt};
use rusty_tarantool::tarantool::ClientConfig;
use serde_derive::Deserialize;
use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use url::Url;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::module_impl::{init_log_with_params, Module};
use v_common::search::clickhouse_client::CHClient;
use v_common::search::common::PrefixesCache;
use v_common::search::ft_client::FTClient;
use v_common::v_api::api_client::{AuthClient, MStorageClient};

#[head("/")]
async fn head() -> std::io::Result<HttpResponse> {
    Ok(HttpResponse::Ok().finish())
}

#[get("/ping")]
async fn ping() -> std::io::Result<HttpResponse> {
    return Ok(HttpResponse::Ok().content_type("text/plain").body("pong"));
}

#[derive(Deserialize)]
struct Info {
    app_name: String,
    data: Option<String>,
}

async fn apps_doc(info: web::Path<Info>) -> std::io::Result<NamedFile> {
    if let Some(v) = &info.data {
        if v == "manifest" {
            return NamedFile::open(format!("public/{}/{}", info.app_name, &info.data.clone().unwrap()).parse::<PathBuf>().unwrap());
        }
    }
    NamedFile::open("public/index.html".parse::<PathBuf>().unwrap())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    std::env::set_var("RUST_LOG", "actix_server=info,actix_web=info");
    init_log_with_params("WEB_API", None, true);

    let mut tt_config = None;
    if let Some(p) = Module::get_property("db_connection") {
        match Url::parse(&p) {
            Ok(url) => {
                let host = url.host_str().unwrap_or("127.0.0.1");
                let port = url.port().unwrap_or(3309);
                let user = url.username();
                let pass = url.password().unwrap_or("123");
                info!("Trying to connect to Tarantool, host: {host}, port: {port}, user: {user}");
                tt_config = Some(ClientConfig::new(format!("{host}:{port}"), user, pass).set_timeout_time_ms(2000).set_reconnect_time_ms(2000));
            },
            Err(e) => {
                error!("fail parse {p}, err={e}");
                return Ok(());
            },
        }
    }

    let mut port = "8080".to_owned();
    let mut ext_usr_http_port = None;
    let mut are_external_users = false;
    let mut use_direct_ft_query = false;
    let mut workers = num_cpus::get();

    let args: Vec<String> = env::args().collect();
    for el in &args {
        if el.starts_with("--http_port") {
            port = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned();
        }
        if el.starts_with("--use-direct-ft-query") {
            use_direct_ft_query = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim() == "true";
        }
        if el.starts_with("--workers") {
            workers = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned().parse::<usize>().unwrap();
        }
        if el.starts_with("--ext_usr_http_port") {
            ext_usr_http_port = Some(el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned());
        }
    }

    if let Some(p) = ext_usr_http_port {
        if p == port {
            are_external_users = true;
        }
    }

    let (tx, rx) = mpsc::channel(1000);
    let t_config = tt_config.clone();
    thread::spawn(move || {
        System::new("user_activity_manager").block_on(user_activity_manager(rx, t_config));
    });

    info!("LISTEN {port}");

    let mut server_future = HttpServer::new(move || {
        let db = db_connector(&tt_config);

        let mut ch = CHClient::new(Module::get_property("query_search_db").unwrap_or_default());
        ch.connect();

        let mut ft_client = VQLClient::default();

        if use_direct_ft_query {
            info!("use direct-ft-query");
            ft_client.xr = Some(XapianReader::new_without_init("russian").expect("fail init direct-ft-query"));
            ft_client.query_type = VQLClientConnectType::Direct;
        }

        if !use_direct_ft_query {
            info!("use ft-query-service");

            if let Ok(url) = Module::get_property("ft_query_service_url").unwrap_or_default().parse::<Url>() {
                if url.scheme() == "tcp" {
                    ft_client.nng_client = Some(FTClient::new(url.to_string()));
                    ft_client.query_type = VQLClientConnectType::Nng;
                } else {
                    ft_client.http_client = Some(VQLHttpClient::new(url.as_str()));
                    ft_client.query_type = VQLClientConnectType::Http;
                }
            }
        }

        let check_ticket_ip = Module::get_property("check_ticket_ip").unwrap_or_default().parse::<bool>().unwrap_or(true);
        info!("PARAM [check_ticket_ip] = {check_ticket_ip}");
        let (ticket_cache_read, ticket_cache_write) = evmap::new();
        let (f2s_prefixes_cache_read, f2s_prefixes_cache_write) = evmap::new();
        let (s2f_prefixes_cache_read, s2f_prefixes_cache_write) = evmap::new();

        let json_cfg = web::JsonConfig::default().limit(5 * 1024 * 1024);

        App::new()
            .wrap(middleware::Compress::default())
            .wrap(
                middleware::DefaultHeaders::new()
                    .header("Server", "nginx/1.19.6")
                    .header("X-XSS-Protection", "1; mode=block")
                    .header("X-Content-Type-Options", "nosniff")
                    .header("X-Frame-Options", "sameorigin")
                    .header("Cache-Control", "no-cache, no-store, must-revalidate, private"),
            )
            .app_data(json_cfg)
            .data(Arc::new(Mutex::new(tx.clone())))
            .data(UserContextCache {
                read_tickets: ticket_cache_read,
                write_tickets: Arc::new(Mutex::new(ticket_cache_write)),
                check_ticket_ip,
                are_external_users,
            })
            .data(PrefixesCache {
                full2short_r: f2s_prefixes_cache_read,
                full2short_w: Arc::new(Mutex::new(f2s_prefixes_cache_write)),
                short2full_r: s2f_prefixes_cache_read,
                short2full_w: Arc::new(Mutex::new(s2f_prefixes_cache_write)),
            })
            .data(db)
            .data(QueryEndpoints {
                vql_client: Mutex::new(ft_client),
                ch_client: Mutex::new(ch),
                sparql_client: Mutex::new(SparqlClient::default()),
            })
            .data(Mutex::new(LmdbAzContext::new(1000)))
            .data(Mutex::new(AuthClient::new(Module::get_property("auth_url").unwrap_or_default())))
            .data(Mutex::new(MStorageClient::new(Module::get_property("main_module_url").unwrap_or_default())))
            //
            .service(get_ticket_trusted)
            .service(is_ticket_valid)
            .service(get_rights)
            .service(get_rights_origin)
            .service(get_membership)
            //
            .service(get_individual)
            .service(get_individuals)
            .service(get_operation_state)
            .service(remove_individual)
            .service(remove_from_individual)
            .service(put_individual)
            .service(put_individuals)
            .service(add_to_individual)
            .service(set_in_individual)
            .service(load_file)
            .service(ping)
            .service(head)
            .service(logout)
            .service(web::resource("/apps/{app_name}").route(web::get().to(apps_doc)))
            .service(web::resource("/files").route(web::post().to(save_file)))
            .service(web::resource("/query").route(web::get().to(query_get)).route(web::post().to(query_post)))
            .service(web::resource("/authenticate").route(web::get().to(authenticate_get)).route(web::post().to(authenticate_post)))
            .service(Files::new("/", "./public").redirect_to_slash_directory().index_file("index.html"))
    })
    .bind(format!("0.0.0.0:{port}"))?
    .workers(workers)
    .run()
    .fuse();

    select! {
        _r = server_future => println!("Server is stopped!"),
    };
    Ok(())
}
