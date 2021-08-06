use crate::geo::*;
use crate::individuals::*;
use actix_web::{middleware, web, App, HttpServer};
use chrono::Local;
use env_logger::Builder;
use ini::Ini;
use log::LevelFilter;
use rusty_tarantool::tarantool;
use std::io::Write;

pub fn start_server() -> std::io::Result<()> {
    let env_var = "RUST_LOG";
    match std::env::var_os(env_var) {
        Some(val) => println!("use env var: {}: {:?}", env_var, val.to_str()),
        None => std::env::set_var(env_var, "none,actix_server=none,actix_web=none"),
    }

    Builder::new()
        .format(|buf, record| writeln!(buf, "{} [{}] - {}", Local::now().format("%Y-%m-%dT%H:%M:%S%.3f"), record.level(), record.args()))
        .filter(None, LevelFilter::Info)
        .init();

    HttpServer::new(|| {
        let conf = Ini::load_from_file("veda.properties").expect("fail load [veda.properties] file");
        let section = conf.section(None::<String>).expect("fail parse veda.properties");
        //let ft_query_service_url = section.get("ft_query_service_url").expect("param [ft_query_service_url] not found in veda.properties").clone();
        let tarantool_url = section.get("tarantool_url").expect("param [tarantool_url] not found in veda.properties").clone();
        //let redis_addr = section.get("redis_addr").expect("param [redis_addr] not found in veda.properties").clone();
        //let redis_addr1 = section.get("redis_addr").expect("param [redis_addr] not found in veda.properties").clone();

        let tarantool = tarantool::ClientConfig::new(tarantool_url.parse().unwrap(), "rust", "rust").build();

        //let address: Addr<SyncActor> = SyncArbiter::start(16, move || SyncActor::new(&ft_query_service_url, &redis_addr1));
        //let redis_addr = RedisActor::start(redis_addr.clone());

        App::new()
            //  .data(address.clone())
            //  .data(redis_addr)
            .data(tarantool)
            .wrap(middleware::Logger::default())
            .service(web::resource("/get_individual").route(web::to_async(get_individual_handler)))
            .service(web::resource("/geo_radius").route(web::post().to_async(geo_radius)))
            .service(web::resource("/geo_radius_query").route(web::post().to_async(geo_query)))
    })
    .bind("127.0.0.1:8888")
    .unwrap()
    .run()
}
