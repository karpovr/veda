extern crate redis;
#[macro_use]
extern crate log;
extern crate env_logger;

use chrono::Local;
use env_logger::Builder;
use log::LevelFilter;
use redis::geo::Coord;
use redis::{Commands, Connection};
use std::io::Write;
use std::{thread, time};
use v_common::module::module_impl::Module;
use v_common::onto::individual::{Individual, RawObj};
use v_common::onto::parser::parse_raw;
use v_common::v_queue::consumer::Consumer;
use v_common::v_queue::record::ErrorQueue;

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

    let redis_addr = if let Some(p) = Module::get_property::<String>("redis_addr") {
        "redis://".to_owned() + &p.to_owned() + "/"
    } else {
        warn!("param [redis_addr] not found in veda.properties");
        "redis://127.0.0.1/".to_owned()
    };
    info!("redis addr = {:?}", &redis_addr);

    let client = redis::Client::open(redis_addr.as_str());

    if let Err(e) = client {
        error!("failed to create client redis {}, err = {:?}", redis_addr.to_string(), e);
        return Err(-1);
    }

    let wgeo_index = client.unwrap().get_connection();

    if let Err(e) = wgeo_index {
        error!("failed to connect to redis {}, err = {:?}", redis_addr.to_string(), e);
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
            info!("queue: batch size = {}", size_batch);
        }

        for _it in 0..size_batch {
            // пробуем взять из очереди заголовок сообщения
            if !queue_consumer.pop_header() {
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

            prepare_queue_element(&mut Individual::new_raw(raw), &mut geo_index)?;

            queue_consumer.commit();
            total_prepared_count += 1;

            if total_prepared_count % 1000 == 0 {
                info!("get from queue, count: {}", total_prepared_count);
            }
        }

        thread::sleep(time::Duration::from_millis(100));
    }
}

fn prepare_queue_element(msg: &mut Individual, geo_index: &mut Connection) -> Result<(), i32> {
    if parse_raw(msg).is_ok() {
        let new_state = msg.get_first_binobj("new_state");
        if new_state.is_none() {
            return Err(-1);
        }

        let mut indv = Individual::new_raw(RawObj::new(new_state.unwrap_or_default()));
        if parse_raw(&mut indv).is_ok() {
            let mut is_found_spatial = false;
            //let is_found_spatial = indv.any_exists(&mut raw, "rdf:type", &spatial_types);

            let lnt = indv.get_first_float(LONGITUDE_PREDICATE).unwrap_or_default();
            let ltt = indv.get_first_float(LATITUDE_PREDICATE).unwrap_or_default();

            if lnt > 0.0 && ltt > 0.0 {
                is_found_spatial = true;
            }

            if is_found_spatial {
                info!("found spatial");

                let label = indv.get_first_literal("rdfs:label");
                if label.is_none() {
                    error!("rdfs:label not found, skip");
                } else {
                    match geo_index.geo_add("my_gis", (Coord::lon_lat(lnt, ltt), indv.get_id())) {
                        Ok(n) => {
                            let nn: i32 = n;
                            info!("index {} {} {}", indv.get_id(), label.unwrap_or_default(), nn);
                        }
                        Err(e) => {
                            error!("failed to index {} {} {:?}", indv.get_id(), label.unwrap_or_default(), e);
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
