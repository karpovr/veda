#[macro_use]
extern crate redis_async;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate log;

use actix::prelude::*;
use actix_redis::{Command, Error as ARError, RedisActor};
use actix_web::{middleware, web, App, Error as AWError, HttpResponse, HttpServer};
use chrono::Local;
use env_logger::Builder;
use futures::future::Future;
use ini::Ini;
use log::LevelFilter;
use redis_async::resp::RespValue;
use std::io::Write;

#[derive(Deserialize)]
pub struct GeoRadius {
    lon: f64,
    lat: f64,
    rad: f64,
}

fn geo_radius(info: web::Json<GeoRadius>, redis: web::Data<Addr<RedisActor>>) -> impl Future<Item = HttpResponse, Error = AWError> {
    let info = info.into_inner();

    redis.send(Command(resp_array!["GEORADIUS", "my_gis", info.lon.to_string(), info.lat.to_string(), info.rad.to_string(), "m"])).map_err(AWError::from).and_then(
        |res: Result<RespValue, ARError>| match &res {
            Ok(RespValue::Array(a)) => {
                let mut body = String::new();
                body.push('[');
                for e in a {
                    if let RespValue::BulkString(v) = e {
                        let s = String::from_utf8_lossy(v).into_owned();

                        if body.len() > 1 {
                            body.push(',');
                        }

                        body.push('"');
                        body.push_str(&s);
                        body.push('"');
                    }
                }
                body.push(']');
                Ok(HttpResponse::Ok().content_type("application/json").body(body))
            }
            _ => {
                println!("---->{:?}", res);
                Ok(HttpResponse::InternalServerError().finish())
            }
        },
    )
}

fn main() -> std::io::Result<()> {
    let env_var = "RUST_LOG";
    match std::env::var_os(env_var) {
        Some(val) => println!("use env var: {}: {:?}", env_var, val.to_str()),
        None => std::env::set_var(env_var, "info,actix_server=info,actix_web=info"),
    }

    Builder::new()
        .format(|buf, record| writeln!(buf, "{} [{}] - {}", Local::now().format("%Y-%m-%dT%H:%M:%S%.3f"), record.level(), record.args()))
        .filter(None, LevelFilter::Info)
        .init();

    let conf = Ini::load_from_file("veda.properties").expect("fail load [veda.properties] file");
    let section = conf.section(None::<String>).expect("fail parse veda.properties");
    let webserver_port = section.get("geo_port").expect("param [geo_port] not found in veda.properties").clone();

    let redis_addr = if let Some(p) = section.get("redis_addr") {
        p.to_owned()
    } else {
        warn!("param [redis_addr] not found in veda.properties");
        "".to_owned()
    };

    info!("WEBSERVER PORT={:?}, redis addr={:?}", webserver_port, redis_addr);

    HttpServer::new(move || {
        let redis_addr = RedisActor::start(redis_addr.clone());

        App::new().data(redis_addr).wrap(middleware::Logger::default()).service(web::resource("/geo_query").route(web::post().to_async(geo_radius)))
    })
    .bind("[::]:".to_owned() + &webserver_port)?
    .run()
}
