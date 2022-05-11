#[macro_use]
extern crate log;

mod auth;
mod common;
mod files;
mod get;
mod query;
mod sparql_client;
mod update;
mod vql_query_client;

extern crate serde_derive;
extern crate serde_json;

use crate::auth::{authenticate, get_membership, get_rights, get_rights_origin, get_ticket_trusted, is_ticket_valid};
use crate::common::{PrefixesCache, BASE_PATH};
use crate::files::{load_file, save_file};
use crate::get::{get_individual, get_individuals, get_operation_state};
use crate::query::{query_get, query_post, VQLClient, VQLClientConnectType};
use crate::sparql_client::SparqlClient;
use crate::update::*;
use crate::vql_query_client::VQLHttpClient;
use actix_files::{Files, NamedFile};
use actix_web::{get, head, middleware, web, App, HttpRequest, HttpResponse, HttpServer};
use futures::lock::Mutex;
use futures::{select, FutureExt};
use rusty_tarantool::tarantool::ClientConfig;
use serde_derive::Deserialize;
use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use url::Url;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::module_impl::{init_log_with_params, Module};
use v_common::search::clickhouse_client::CHClient;
use v_common::search::ft_client::FTClient;
use v_common::storage::async_storage::{AStorage, TicketCache};
use v_common::storage::common::StorageMode;
use v_common::storage::lmdb_storage::LMDBStorage;
use v_common::v_api::api_client::{AuthClient, MStorageClient};

#[head("/")]
async fn head() -> std::io::Result<HttpResponse> {
    Ok(HttpResponse::Ok().finish())
}

#[get("/ping")]
async fn ping() -> std::io::Result<HttpResponse> {
    return Ok(HttpResponse::Ok().content_type("text/plain").body("pong"));
}
async fn tests_doc(_req: HttpRequest) -> std::io::Result<NamedFile> {
    NamedFile::open("public/tests.html".parse::<PathBuf>().unwrap())
}
async fn root_doc(_req: HttpRequest) -> std::io::Result<NamedFile> {
    NamedFile::open("public/index.html".parse::<PathBuf>().unwrap())
}
async fn onto_doc(_req: HttpRequest) -> std::io::Result<NamedFile> {
    NamedFile::open("public/ontology.json".parse::<PathBuf>().unwrap())
}
async fn manifest_doc(_req: HttpRequest) -> std::io::Result<NamedFile> {
    NamedFile::open("public/manifest".parse::<PathBuf>().unwrap())
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
                info!("Trying to connect to Tarantool, host: {}, port: {}, user: {}, password: {}", host, port, user, pass);
                tt_config = Some(ClientConfig::new(format!("{}:{}", host, port), user, pass).set_timeout_time_ms(2000).set_reconnect_time_ms(2000));
            },
            Err(e) => {
                error!("fail parse {}, err={}", p, e);
                return Ok(());
            },
        }
    }

    let mut port = "8080".to_owned();
    let mut use_direct_ft_query = false;
    let mut workers = num_cpus::get();

    let args: Vec<String> = env::args().collect();
    for el in args.iter() {
        if el.starts_with("--http_port") {
            port = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned();
        }
        if el.starts_with("--use-direct-ft-query") {
            use_direct_ft_query = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim() == "true";
        }
        if el.starts_with("--workers") {
            workers = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned().parse::<usize>().unwrap();
        }
    }

    info!("LISTEN {}", port);

    let mut server_future = HttpServer::new(move || {
        let db = if let Some(cfg) = &tt_config {
            AStorage {
                tt: Some(cfg.clone().build()),
                lmdb: None,
            }
        } else {
            AStorage {
                tt: None,
                lmdb: Some(Mutex::from(LMDBStorage::new(BASE_PATH, StorageMode::ReadOnly, Some(1000)))),
            }
        };

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
                    ft_client.http_client = Some(VQLHttpClient::new(url.to_string()));
                    ft_client.query_type = VQLClientConnectType::Http;
                }
            }
        }

        let check_ticket_ip = Module::get_property("check_ticket_ip").unwrap_or_default().parse::<bool>().unwrap_or(true);
        info!("PARAM [check_ticket_ip] = {}", check_ticket_ip);
        let (ticket_cache_read, ticket_cache_write) = evmap::new();
        let (prefixes_cache_read, prefixes_cache_write) = evmap::new();

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
            .data(TicketCache {
                read: ticket_cache_read,
                write: Arc::new(Mutex::new(ticket_cache_write)),
                check_ticket_ip,
            })
            .data(PrefixesCache {
                read: prefixes_cache_read,
                write: Arc::new(Mutex::new(prefixes_cache_write)),
            })
            .data(Mutex::new(SparqlClient::default()))
            .data(db)
            .data(Mutex::new(ft_client))
            .data(Mutex::new(ch))
            .data(Mutex::new(LmdbAzContext::new(1000)))
            .data(Mutex::new(AuthClient::new(Module::get_property("auth_url").unwrap_or_default())))
            .data(Mutex::new(MStorageClient::new(Module::get_property("main_module_url").unwrap_or_default())))
            //
            .service(authenticate)
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
            .service(web::resource("/apps/{app_name}").route(web::get().to(apps_doc)))
            .route("/tests", web::get().to(tests_doc))
            .route("/ontology.json", web::get().to(onto_doc))
            .route("/manifest", web::get().to(manifest_doc))
            .route("/", web::get().to(root_doc))
            .service(web::resource("/files").route(web::post().to(save_file)))
            .service(web::resource("/query").route(web::get().to(query_get)).route(web::post().to(query_post)))
            .service(Files::new("/", "./public"))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .workers(workers)
    .run()
    .fuse();

    select! {
        _r = server_future => println!("Server is stopped!"),
    };
    Ok(())
}
