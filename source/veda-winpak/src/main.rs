mod common_winpak;
mod from_winpak;
mod insert_to_winpak;
mod update_to_winpak;

#[macro_use]
extern crate log;

use chrono::prelude::*;
//use chrono::{Local, NaiveDateTime};
use env_logger::Builder;
use log::LevelFilter;
use std::io::Write;
use std::{thread, time as std_time};
use v_api::*;
use v_module::module::*;
use v_onto::{individual::*, parser::*};
use v_queue::{consumer::*, record::*};
//use v_search::FTQuery;
use crate::from_winpak::sync_data_from_winpak;
use crate::insert_to_winpak::insert_to_winpak;
use crate::update_to_winpak::update_to_winpak;

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

    let mut module = Module::default();

    let mut conn_str = String::default();

    let systicket;
    if let Ok(t) = module.get_sys_ticket_id() {
        systicket = t;
    } else {
        error!("fail get systicket");
        return Ok(());
    }

    //    while !ft_client.connect() {
    //        thread::sleep(time::Duration::from_millis(3000));
    //    }

    let mut queue_consumer = Consumer::new("./data/queue", "winpak", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
    let mut total_prepared_count: u64 = 0;

    loop {
        if conn_str.is_empty() {
            let conn_str_w = get_conn_string(&mut module);
            if conn_str_w.is_err() {
                error!("fail read connection info: err={:?}", conn_str_w.err());
                error!("sleep and repeate...");
                thread::sleep(std_time::Duration::from_millis(10000));
                continue;
            }
            conn_str = conn_str_w.unwrap();
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
            debug!("queue: batch size={}", size_batch);
        }

        for _it in 0..size_batch {
            // пробуем взять из очереди заголовок сообщения
            if !queue_consumer.pop_header() {
                break;
            }

            let mut raw = RawObj::new(vec![0; (queue_consumer.header.msg_length) as usize]);

            // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
            if let Err(e) = queue_consumer.pop_body(&mut raw.data) {
                if e == ErrorQueue::FailReadTailMessage {
                    break;
                } else {
                    error!("{} get msg from queue: {}", total_prepared_count, e.as_str());
                    break;
                }
            }

            if let Err(e) = prepare_queue_element(&mut module, &systicket, &conn_str, &mut Individual::new_raw(raw)) {
                error!("fail prepare queue element, err={:?}", e);
                if e == ResultCode::ConnectError {
                    error!("sleep and repeate...");
                    thread::sleep(std_time::Duration::from_millis(10000));
                    conn_str.clear();
                    continue;
                }
            }

            queue_consumer.commit_and_next();

            total_prepared_count += 1;

            if total_prepared_count % 1000 == 0 {
                info!("get from queue, count: {}", total_prepared_count);
            }
        }

        thread::sleep(std_time::Duration::from_millis(3000));
    }
}

pub fn get_conn_string(module: &mut Module) -> Result<String, String> {
    let mut conn = Individual::default();
    let conn_winpak_id = "cfg:conn_winpak";
    if module.storage.get_individual(conn_winpak_id, &mut conn) {
        if let Some(t) = conn.get_first_literal("v-s:transport") {
            if t != "mssql" {
                return Err("invalid connect type, expect [mssql]".to_owned());
            }
        }

        let host = if let Some(v) = conn.get_first_literal("v-s:host") {
            v
        } else {
            return Err(("not found param [v-s:host] in ".to_string() + conn_winpak_id).to_owned());
        };

        let port = if let Some(v) = conn.get_first_integer("v-s:port") {
            v
        } else {
            return Err(("not found param [v-s:port] in ".to_string() + conn_winpak_id).to_owned());
        };

        let login = if let Some(v) = conn.get_first_literal("v-s:login") {
            v.replace("\\\\", "\\")
        } else {
            return Err(("not found param [v-s:login] in ".to_string() + conn_winpak_id).to_owned());
        };

        let pass = if let Some(v) = conn.get_first_literal("v-s:password") {
            v
        } else {
            return Err(("not found param [v-s:password] in ".to_string() + conn_winpak_id).to_owned());
        };

        let database = if let Some(v) = conn.get_first_literal("v-s:sql_database") {
            v
        } else {
            return Err(("not found param [v-s:sql_database] in ".to_string() + conn_winpak_id).to_owned());
        };

        Ok(format!("server=tcp:{},{};integratedsecurity=true;database={};user={};password={}", host, port, database, login, pass))
    } else {
        return Err("not found [".to_owned() + conn_winpak_id + "]");
    }
}

fn prepare_queue_element(module: &mut Module, systicket: &str, conn_str: &str, msg: &mut Individual) -> Result<(), ResultCode> {
    if parse_raw(msg).is_ok() {
        let wcmd = msg.get_first_integer("cmd");
        if wcmd.is_none() {
            return Err(ResultCode::UnprocessableEntity);
        }

        let cmd = IndvOp::from_i64(wcmd.unwrap_or_default());

        let new_state = msg.get_first_binobj("new_state");
        if cmd != IndvOp::Remove && new_state.is_none() {
            return Err(ResultCode::UnprocessableEntity);
        }

        let mut new_state_indv = Individual::new_raw(RawObj::new(new_state.unwrap_or_default()));
        if parse_raw(&mut new_state_indv).is_ok() {
            new_state_indv.parse_all();

            if let Some(types) = new_state_indv.get_literals("rdf:type") {
                for itype in types {
                    if itype == "mnd-s:SourceDataRequestForPass" {
                        //v-s:creator", "cfg:VedaSystem"
                        if let Some(v) = new_state_indv.get_first_literal("v-s:lastEditor") {
                            if v == "cfg:VedaSystem" {
                                return Ok(());
                            }
                        }

                        let res = sync_data_from_winpak(module, systicket, conn_str, &mut new_state_indv);
                        if res == ResultCode::ConnectError {
                            return Err(res);
                        }
                    } else if itype == "v-s:ExternalModuleHandler" {
                        //v-s:creator", "cfg:VedaSystem"
                        if let Some(v) = new_state_indv.get_first_literal("v-s:lastEditor") {
                            if v == "cfg:VedaSystem" {
                                return Ok(());
                            }
                        }

                        let module_label = new_state_indv.get_first_literal("v-s:moduleLabel").unwrap_or_default();

                        if module_label == "winpak pe44 create" {
                            let res = insert_to_winpak(module, systicket, conn_str, &mut new_state_indv);
                            if res == ResultCode::ConnectError {
                                return Err(res);
                            }
                        }

                        if module_label == "winpak pe44 update" {
                            let res = update_to_winpak(module, systicket, conn_str, &mut new_state_indv);
                            if res == ResultCode::ConnectError {
                                return Err(res);
                            }
                        }
                    }
                }
            }

            // info! ("{:?}", raw);
        }
    }
    Ok(())
}
