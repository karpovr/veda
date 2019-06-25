extern crate redis;
#[macro_use]
extern crate log;
extern crate env_logger;

use chrono::Local;
use env_logger::Builder;
use ini::Ini;
use log::LevelFilter;
use redis::geo::Coord;
use redis::{Commands, Connection};
use std::io::Write;
use std::{thread, time};
use v_onto::individual::*;
use v_onto::parser::*;
use v_queue::consumer::*;
use v_queue::record::*;

//const SPATIAL_CLASS: &str = "v-s:Spatial";
const LONGITUDE_PREDICATE: &str = "v-s:longitude";
const LATITUDE_PREDICATE: &str = "v-s:latitude";

fn main() -> Result<(), i32> {
    let env_var = "RUST_LOG";
    match std::env::var_os(env_var) {
        Some(val) => println!("use env var: {}: {:?}", env_var, val.to_str()),
        None => std::env::set_var(env_var, "info"),
    }

    Builder::new()
        .format(|buf, record| writeln!(buf, "{} [{}] - {}", Local::now().format("%Y-%m-%dT%H:%M:%S%.3f"), record.level(), record.args()))
        .filter(None, LevelFilter::Info)
        .init();

    let conf = Ini::load_from_file("veda.properties").expect("fail load veda.properties file");

    let section = conf.section(None::<String>).expect("fail parse veda.properties");

    let redis_addr = if let Some(p) = section.get("redis_addr") {
        "redis://".to_owned() + &p.to_owned() + "/"
    } else {
        warn!("param [redis_addr] not found in veda.properties");
        "redis://127.0.0.1/".to_owned()
    };
    info!("redis addr={:?}", &redis_addr);

    let client = redis::Client::open(redis_addr.as_str());

    if let Err(e) = client {
        error!("fail create client redis {}, err={:?}", redis_addr.to_string(), e);
        return Err(-1);
    }

    let wgeo_index = client.unwrap().get_connection();

    if let Err(e) = wgeo_index {
        error!("fail connect to redis {}, err={:?}", redis_addr.to_string(), e);
        return Err(-1);
    }

    let mut geo_index = wgeo_index.unwrap();

    let mut queue_consumer = Consumer::new("./data/queue", "geo-indexer", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
    let mut total_prepared_count: u64 = 0;

    loop {
        let mut size_batch = 0;

        // read queue current part info
        if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
            error!("{} get_info_of_part {}: {}", total_prepared_count, queue_consumer.id, e.as_str());
            continue;
        }

        if queue_consumer.queue.count_pushed - queue_consumer.count_popped == 0 {
            // if not new messages, read queue info
            queue_consumer.queue.get_info_queue();

            if queue_consumer.queue.id > queue_consumer.id {
                size_batch = 1;
            }
        } else if queue_consumer.queue.count_pushed - queue_consumer.count_popped > 0 {
            if queue_consumer.queue.id != queue_consumer.id {
                size_batch = 1;
            } else {
                size_batch = queue_consumer.queue.count_pushed - queue_consumer.count_popped;
            }
        }

        if size_batch > 0 {
            info!("queue: batch size={}", size_batch);
        }

        for _it in 0..size_batch {
            // пробуем взять из очереди заголовок сообщения
            if queue_consumer.pop_header() == false {
                break;
            }

            let mut raw = RawObj::new(vec![0; (queue_consumer.header.msg_length) as usize]);
            //let mut msg = Individual::new(vec![0; (queue_consumer.header.msg_length) as usize]);

            // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
            if let Err(e) = queue_consumer.pop_body(&mut raw.data) {
                if e == ErrorQueue::FailReadTailMessage {
                    break;
                } else {
                    error!("{} get msg from queue: {}", total_prepared_count, e.as_str());
                    break;
                }
            }

            prepare_queue_element(&mut raw, &mut geo_index)?;

            queue_consumer.commit_and_next();
            total_prepared_count += 1;

            if total_prepared_count % 1000 == 0 {
                info!("get from queue, count: {}", total_prepared_count);
            }
        }

        thread::sleep(time::Duration::from_millis(10));
    }
}

fn prepare_queue_element(raw: &mut RawObj, geo_index: &mut Connection) -> Result<(), i32> {
    if let Ok(uri) = parse_raw(raw) {
        let mut msg: Individual = Individual::new();
        msg.uri = uri;

        let new_state = msg.get_first_binobj(raw, "new_state");
        if let Err(_) = new_state {
            return Err(-1);
        }

        let mut raw = RawObj::new(new_state.unwrap_or_default());
        let mut indv: Individual = Individual::new();
        if let Ok(uri) = parse_raw(&mut raw) {
            indv.uri = uri;
            let mut is_found_spatial = false;
            //let is_found_spatial = indv.any_exists(&mut raw, "rdf:type", &spatial_types);

            let lnt = indv.get_first_float(&mut raw, LONGITUDE_PREDICATE).unwrap_or_default();
            let ltt = indv.get_first_float(&mut raw, LATITUDE_PREDICATE).unwrap_or_default();

            if lnt > 0.0 && ltt > 0.0 {
                is_found_spatial = true;
            }

            if is_found_spatial {
                info!("found spatial");

                let label = indv.get_first_literal(&mut raw, "rdfs:label");
                if let Err(_) = label {
                    return Err(-1);
                }

                let r1: () = geo_index.geo_add("my_gis", (Coord::lon_lat(lnt, ltt), &indv.uri)).unwrap();

                info!("index {} {} {:?}", indv.uri, label.unwrap_or_default(), r1);
            }
        }
    }
    Ok(())
}
