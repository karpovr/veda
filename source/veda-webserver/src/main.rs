#[macro_use]
extern crate redis_async;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate log;

use std::io::Write;
use std::collections::HashSet;
use actix::prelude::*;
use actix_redis::{Command, Error as ARError, RedisActor};
use actix_web::{middleware, web, App, Error as AWError, HttpResponse, HttpServer};
use chrono::Local;
use env_logger::Builder;
use futures::future::Future;
use ini::Ini;
use log::LevelFilter;
use redis::geo::{RadiusOptions, RadiusOrder, RadiusSearchResult, Unit};
use redis::{Commands, Connection, RedisError};
use redis_async::resp::RespValue;
use v_search::{FTClient, FTQuery};

#[derive(Deserialize)]
pub struct GeoRadius {
    lon: f64,
    lat: f64,
    rad: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeoQuery {
    lon: f64,
    lat: f64,
    rad: f64,
    #[serde(default)]
    expr: String,
}

fn geo_query(info: web::Json<GeoQuery>, db: web::Data<Addr<SyncActor>>) -> impl Future<Item = HttpResponse, Error = AWError> {
    let info = info.into_inner();

    db.send(GeoQuery {
        lon: info.lon,
        lat: info.lat,
        rad: info.rad,
        expr: info.expr,
    })
    .map_err(AWError::from)
    .and_then(|res| match &res {
        Ok(d) => {
            let mut body = String::new();
            body.push('[');
            for e in d {
                if body.len() > 1 {
                    body.push(',');
                }

                body.push('"');
                body.push_str(&e);
                body.push('"');
            }
            body.push(']');

            Ok(HttpResponse::Ok().content_type("application/json").body(body))
        }
        Err(err) => {
            error!("geo_query {:?}", err);
            Ok(HttpResponse::InternalServerError().finish())
        }
    })
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

pub struct SyncActor {
    ft_client: FTClient,
    redis_client: Connection,
}

impl SyncActor {
    fn new(ft_addr: &str, redis_addr: &str) -> SyncActor {
        info!("connect to search:{}, redis:{} ", &ft_addr, &redis_addr);

        let redis_addr = "redis://".to_owned() + &redis_addr.to_owned() + "/";

        let wgeo_index = match redis::Client::open(redis_addr.as_str()) {
            Ok(c) => c.get_connection(),
            Err(e) => Err(e),
        };

        SyncActor {
            ft_client: FTClient::new(ft_addr.to_owned()),
            redis_client: wgeo_index.unwrap(),
        }
    }
}

impl Message for GeoQuery {
    type Result = Result<Vec<String>, ()>;
}

impl Actor for SyncActor {
    type Context = SyncContext<Self>;

    fn started(&mut self, _ctx: &mut Self::Context) {
        info!("SYNC STARTED");
    }
}

impl Handler<GeoQuery> for SyncActor {
    type Result = Result<Vec<String>, ()>;

    fn handle(&mut self, msg: GeoQuery, _ctx: &mut Self::Context) -> Self::Result {

        let mut res = Vec::new ();

        let ft_res = self.ft_client.query(FTQuery::new("cfg:VedaSystem", &msg.expr));
        if ft_res.count == 0 {
            return Ok(Vec::new ());
        }

        if ft_res.result_code != 200{
            return Err(());
        }

        let opts = RadiusOptions::default().with_dist().order(RadiusOrder::Asc);
        let result: Result <Vec<RadiusSearchResult>, RedisError> = self.redis_client.geo_radius("my_gis", msg.lon, msg.lat, msg.rad, Unit::Meters, opts);

        let mut geo_res: HashSet <String> = HashSet::new();

        if let Ok (res) = result {
            for e in res {
                geo_res.insert(e.name);
            }
        }

        for el in ft_res.result {
            if geo_res.contains(&el) {
                res.push(el);
            }
        }

        Ok(res)
    }
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
    let ft_query_service_url = section.get("ft_query_service_url").expect("param [ft_query_service_url] not found in veda.properties").clone();
    let redis_addr = section.get("redis_addr").expect("param [redis_addr] not found in veda.properties").clone();
    let redis_addr1 = section.get("redis_addr").expect("param [redis_addr] not found in veda.properties").clone();

    info!("WEBSERVER PORT={:?}, redis addr={:?}", webserver_port, &redis_addr);

    let _sys = actix_rt::System::new("example");

    let address: Addr<SyncActor> = SyncArbiter::start(16, move || SyncActor::new(&ft_query_service_url, &redis_addr1));

    HttpServer::new(move || {
        let redis_addr = RedisActor::start(redis_addr.clone());

        App::new()
            .data(address.clone())
            .data(redis_addr)
            .wrap(middleware::Logger::default())
            .service(web::resource("/geo_radius").route(web::post().to_async(geo_radius)))
            .service(web::resource("/geo_radius_query").route(web::post().to_async(geo_query)))
    })
    .bind("[::]:".to_owned() + &webserver_port)?
    .run()
}
