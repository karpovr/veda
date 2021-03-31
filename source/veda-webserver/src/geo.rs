use actix::prelude::*;
use actix_redis::{Command, Error as ARError, RedisActor};
use actix_web::{web, Error as AWError, HttpResponse};
use futures::future::Future;
use redis::geo::{RadiusOptions, RadiusOrder, RadiusSearchResult, Unit};
use redis::{Commands, Connection, RedisError};
use redis_async::resp::RespValue;
use std::collections::HashSet;
use v_search::*;

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
    query: String,
    ticket: String,
}

pub fn geo_query(info: web::Json<GeoQuery>, db: web::Data<Addr<SyncActor>>) -> impl Future<Item = HttpResponse, Error = AWError> {
    let info = info.into_inner();

    db.send(GeoQuery {
        lon: info.lon,
        lat: info.lat,
        rad: info.rad,
        query: info.query,
        ticket: info.ticket,
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
            error!("failed geo_query, err = {:?}", err);
            Ok(HttpResponse::InternalServerError().finish())
        }
    })
}

pub fn geo_radius(info: web::Json<GeoRadius>, redis: web::Data<Addr<RedisActor>>) -> impl Future<Item = HttpResponse, Error = AWError> {
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
    pub fn new(ft_addr: &str, redis_addr: &str) -> SyncActor {
        info!("connect to search = {}, redis = {} ", &ft_addr, &redis_addr);

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
        info!("started sync");
    }
}

impl Handler<GeoQuery> for SyncActor {
    type Result = Result<Vec<String>, ()>;

    fn handle(&mut self, msg: GeoQuery, _ctx: &mut Self::Context) -> Self::Result {
        let mut res = Vec::new();

        let ft_res = self.ft_client.query(FTQuery::new_with_ticket(&msg.ticket, &msg.query));
        if ft_res.count == 0 {
            return Ok(Vec::new());
        }

        if ft_res.result_code != 200 {
            return Err(());
        }

        let opts = RadiusOptions::default().with_dist().order(RadiusOrder::Asc);
        let result: Result<Vec<RadiusSearchResult>, RedisError> = self.redis_client.geo_radius("my_gis", msg.lon, msg.lat, msg.rad, Unit::Meters, opts);

        let mut geo_res: HashSet<String> = HashSet::new();

        if let Ok(res) = result {
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
