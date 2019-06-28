#[macro_use]
extern crate log;
extern crate env_logger;

use chrono::Local;
use env_logger::Builder;
use ini::Ini;
use log::LevelFilter;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::{thread, time};
use v_onto::individual::{Individual, RawObj};
use v_onto::parser::*;
use v_queue::consumer::*;
use v_queue::record::*;
use v_search::{FTClient, FTQuery};
use v_storage::storage::VStorage;

fn main() -> std::io::Result<()> {
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

    let tarantool_addr = if let Some(p) = section.get("tarantool_url") {
        p.to_owned()
    } else {
        warn!("param [tarantool_url] not found in veda.properties");
        "".to_owned()
    };

    info!("tarantool addr={:?}", &tarantool_addr);

    let mut storage = if !tarantool_addr.is_empty() {
        VStorage::new_tt(tarantool_addr, "veda6", "123456")
    } else {
        VStorage::new_lmdb("./data/lmdb-individuals/")
    };

    let onto_types = vec![
        "rdfs:Class",
        "owl:Class",
        "rdfs:Datatype",
        "owl:Ontology",
        "rdf:Property",
        "owl:DatatypeProperty",
        "owl:ObjectProperty",
        "owl:OntologyProperty",
        "owl:AnnotationProperty",
        "v-ui:PropertySpecification",
        "v-ui:DatatypePropertySpecification",
        "v-ui:ObjectPropertySpecification",
        "v-ui:ClassModel",
    ];

    let mut query = String::new();

    for el in &onto_types {
        if !query.is_empty() {
            query.push_str(" || ");
        }
        query.push_str("'rdf:type' === '");
        query.push_str(el);
        query.push_str("'");
    }

    let mut ft_client = FTClient::new("tcp://127.0.0.1:23000".to_owned());

    while !ft_client.connect() {
        thread::sleep(time::Duration::from_millis(3000));
    }

    let mut queue_consumer = Consumer::new("./data/queue", "ontologist", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
    let mut total_prepared_count: u64 = 0;

    let ontology_file_path = "public/ontology.json";
    ///////
    let mut is_found_onto_changes = false;

    loop {
        if !Path::new(ontology_file_path).exists() {
            is_found_onto_changes = true;
        }

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

            if !is_found_onto_changes {
                is_found_onto_changes = is_changes(&mut raw, &onto_types);
            }

            queue_consumer.commit_and_next();

            total_prepared_count += 1;

            if total_prepared_count % 1000 == 0 {
                info!("get from queue, count: {}", total_prepared_count);
            }
        }

        if is_found_onto_changes && size_batch == 0 {
            info!("found onto changes from storage");

            if let Ok(mut file) = File::create(ontology_file_path) {
                let res = ft_client.query(FTQuery::new_with_user("cfg:VedaSystem", &query));
                let mut buf = String::new();

                if res.result_code == 200 && res.count > 0 {
                    buf.push('[');
                    for el in &res.result {
                        let mut raw: RawObj = RawObj::new_empty();
                        let mut indv: Individual = Individual::new();
                        if storage.set_binobj(&el, &mut raw, &mut indv) {
                            if buf.len() > 1 {
                                buf.push(',');
                            }
                            indv.parse_all(&mut raw);

                            buf.push_str(&indv.as_json_str());
                        }
                    }
                    buf.push('[');

                    file.write_all(buf.as_bytes())?;
                    info!("count stored {}", res.count);
                    is_found_onto_changes = false;
                }
            } else {
                error!("fail create file {}", ontology_file_path);
            }
        }

        thread::sleep(time::Duration::from_millis(5000));
    }
}

fn is_changes(raw: &mut RawObj, onto_types: &[&str]) -> bool {
    let mut msg: Individual = Individual::new();
    if let Ok(uri) = parse_raw(raw) {
        msg.uri = uri;
        if let Ok(new_state) = msg.get_first_binobj(raw, "new_state") {
            let mut raw = RawObj::new(new_state);
            let mut indv: Individual = Individual::new();
            if let Ok(uri) = parse_raw(&mut raw) {
                indv.uri = uri;
                return indv.any_exists(&mut raw, "rdf:type", &onto_types);
            }
        }
    }
    false
}
