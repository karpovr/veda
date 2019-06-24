#[macro_use]
extern crate redis_async;
#[macro_use]
extern crate serde_derive;

use actix::prelude::*;
use actix_redis::{Command, Error as ARError, RedisActor};
use actix_web::{middleware, web, App, Error as AWError, HttpResponse, HttpServer};
use futures::future::Future;
use redis_async::resp::RespValue;

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
                for e in a {
                    if let RespValue::BulkString(v) = e {
                        let s = String::from_utf8_lossy(v).into_owned();

                        if !body.is_empty() {
                            body.push(',');
                        }

                        body.push_str(&s);
                    }
                }
                Ok(HttpResponse::Ok().body(body))
            }
            _ => {
                println!("---->{:?}", res);
                Ok(HttpResponse::InternalServerError().finish())
            }
        },
    )
}

fn main() -> std::io::Result<()> {
    std::env::set_var("RUST_LOG", "actix_web=info,actix_redis=info");
    env_logger::init();

    HttpServer::new(|| {
        let redis_addr = RedisActor::start("127.0.0.1:6379");

        App::new().data(redis_addr).wrap(middleware::Logger::default()).service(web::resource("/geo_query").route(web::post().to_async(geo_radius)))
    })
    .bind("0.0.0.0:8070")?
    .run()
}
