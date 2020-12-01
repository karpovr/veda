#[macro_use]
extern crate enum_primitive_derive;
#[macro_use]
extern crate log;
extern crate base64;

pub mod configuration;

use crate::configuration::Configuration;
use base64::{decode, encode};
use num_traits::{FromPrimitive, ToPrimitive};
use serde_json::json;
use serde_json::value::Value as JSONValue;
use std::collections::HashMap;
use std::error::Error;
use std::io::ErrorKind;
use std::{thread, time};
use uuid::*;
use v_api::app::ResultCode;
use v_api::*;
use v_module::module::Module;
use v_onto::datatype::Lang;
use v_onto::individual::{Individual, RawObj};
use v_onto::individual2msgpack::*;
use v_onto::parser::*;
use v_queue::consumer::*;
use v_queue::record::*;

const TRANSMIT_FAILED: i64 = 32;

#[derive(Primitive, PartialEq, Debug, Clone, Serialize, Deserialize)]
#[repr(i64)]
pub enum ExImCode {
    Unknown = 0,
    Ok = 1,
    InvalidMessage = 2,
    InvalidCmd = 4,
    InvalidTarget = 8,
    FailUpdate = 16,
    TransmitFailed = TRANSMIT_FAILED,
    SendFailed = 64 | TRANSMIT_FAILED,
    ReceiveFailed = 128 | TRANSMIT_FAILED,
}

impl From<i64> for ExImCode {
    fn from(value: i64) -> Self {
        if let Some(v) = ExImCode::from_i64(value) {
            v
        } else {
            ExImCode::Unknown
        }
    }
}

impl From<ExImCode> for i64 {
    fn from(value: ExImCode) -> Self {
        if let Some(v) = value.to_i64() {
            v
        } else {
            0
        }
    }
}

impl ExImCode {
    pub fn as_string(&self) -> String {
        match self {
            ExImCode::Ok => "ok",
            ExImCode::InvalidMessage => "invalid message",
            ExImCode::InvalidCmd => "invalid cmd",
            ExImCode::InvalidTarget => "invalid target",
            ExImCode::FailUpdate => "fail update",
            ExImCode::TransmitFailed => "fail transmit",
            ExImCode::SendFailed => "fail send",
            ExImCode::ReceiveFailed => "fail receive",
            // ...
            ExImCode::Unknown => "unknown",
        }
        .to_string()
    }
}

pub fn send_changes_to_node(queue_consumer: &mut Consumer, resp_api: &Configuration, node_id: &str) -> ExImCode {
    let mut size_batch = 0;

    // read queue current part info
    if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
        error!("get_info_of_part {}: {}", queue_consumer.id, e.as_str());
        return ExImCode::InvalidMessage;
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

    // prepare packet and send to slave node
    if size_batch > 0 {
        info!("queue: batch size={}", size_batch);

        for (total_prepared_count, _it) in (0..size_batch).enumerate() {
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

            let mut queue_element = &mut Individual::new_raw(raw);

            for attempt_count in 0..10 {
                let msg = create_export_message(&mut queue_element, node_id);

                match msg {
                    Ok(mut msg) => {
                        if let Err(e) = send_export_message(&mut msg, resp_api) {
                            error!("fail send export message, err={:?}, attempt_count={}", e, attempt_count);

                            if attempt_count == 10 {
                                return ExImCode::SendFailed;
                            }
                        } else {
                            break;
                        }
                    }
                    Err(e) => {
                        if e == ExImCode::Ok {
                            break;
                        }
                        error!("fail create export message, err={:?}", e);
                        return ExImCode::InvalidMessage;
                    }
                }

                thread::sleep(time::Duration::from_millis(attempt_count * 100));
            }

            queue_consumer.commit_and_next();

            if total_prepared_count % 1000 == 0 {
                info!("get from queue, count: {}", total_prepared_count);
            }
        }
    }
    return ExImCode::Ok;
}

pub fn create_export_message(queue_element: &mut Individual, node_id: &str) -> Result<Individual, ExImCode> {
    if parse_raw(queue_element).is_ok() {
        let target_veda = queue_element.get_first_literal("target_veda");
        if target_veda.is_none() {
            return Err(ExImCode::InvalidMessage);
        }

        let target_veda = target_veda.unwrap_or_default();
        if target_veda != "*" && target_veda != node_id {
            return Err(ExImCode::Ok);
        }

        let wcmd = queue_element.get_first_integer("cmd");
        if wcmd.is_none() {
            return Err(ExImCode::InvalidMessage);
        }
        let cmd = IndvOp::from_i64(wcmd.unwrap_or_default());

        let new_state = queue_element.get_first_binobj("new_state");
        if cmd != IndvOp::Remove && new_state.is_none() {
            return Err(ExImCode::InvalidMessage);
        }

        let source_veda = queue_element.get_first_literal("source_veda");
        if source_veda.is_none() {
            return Err(ExImCode::InvalidMessage);
        }

        let date = queue_element.get_first_integer("date");
        if date.is_none() {
            return Err(ExImCode::InvalidMessage);
        }

        let mut indv = Individual::new_raw(RawObj::new(new_state.unwrap_or_default()));
        if parse_raw(&mut indv).is_ok() {
            indv.parse_all();

            let mut raw: Vec<u8> = Vec::new();
            if to_msgpack(&indv, &mut raw).is_ok() {
                let mut new_indv = Individual::default();
                new_indv.set_id(indv.get_id());
                new_indv.add_uri("uri", indv.get_id());
                new_indv.add_binary("new_state", raw);
                new_indv.add_integer("cmd", cmd as i64);
                new_indv.add_integer("date", date.unwrap_or_default());
                new_indv.add_string("source_veda", &source_veda.unwrap_or_default(), Lang::NONE);
                new_indv.add_string("target_veda", &target_veda, Lang::NONE);

                return Ok(new_indv);
            }
            // info! ("{:?}", raw);
        }
    }
    Err(ExImCode::InvalidMessage)
}

pub fn encode_message(out_obj: &mut Individual) -> Result<JSONValue, Box<dyn Error>> {
    out_obj.parse_all();

    let mut raw1: Vec<u8> = Vec::new();
    to_msgpack(&out_obj, &mut raw1)?;
    let msg_base64 = encode(raw1.as_slice());

    Ok(json!({ "msg": &msg_base64 }))
}

pub fn decode_message(src: &JSONValue) -> Result<Individual, Box<dyn Error>> {
    if let Some(props) = src.as_object() {
        if let Some(msg) = props.get("msg") {
            if let Some(m) = msg.as_str() {
                let mut recv_indv = Individual::new_raw(RawObj::new(decode(&m)?));
                if parse_raw(&mut recv_indv).is_ok() {
                    return Ok(recv_indv);
                }
            }
        }
    }

    return Err(Box::new(std::io::Error::new(ErrorKind::Other, format!("fail decode import message"))));
}

fn send_export_message(out_obj: &mut Individual, resp_api: &Configuration) -> Result<IOResult, Box<dyn Error>> {
    let uri_str = format!("{}/import_delta", resp_api.base_path);

    let res = resp_api.client.put(&uri_str).json(&encode_message(out_obj)?).send()?;

    let jj: IOResult = res.json()?;
    info!("sucess send export message: res={:?}, id={}", jj.res_code, out_obj.get_id());

    Ok(jj)
}

pub fn recv_import_message(importer_id: &str, resp_api: &Configuration) -> Result<JSONValue, Box<dyn Error>> {
    let uri_str = format!("{}/export_delta/{}", resp_api.base_path, importer_id);
    let msg: JSONValue = resp_api.client.get(&uri_str).send()?.json()?;
    Ok(msg)
}

#[macro_use]
extern crate serde_derive;

#[derive(Serialize, Deserialize)]
pub struct IOResult {
    pub id: String,
    pub res_code: ExImCode,
}

impl IOResult {
    pub fn new(id: &str, res_code: ExImCode) -> Self {
        IOResult {
            id: id.to_owned(),
            res_code,
        }
    }
}

pub fn processing_imported_message(my_node_id: &str, recv_indv: &mut Individual, systicket: &str, veda_api: &mut APIClient) -> IOResult {
    let wcmd = recv_indv.get_first_integer("cmd");
    if wcmd.is_none() {
        return IOResult::new(recv_indv.get_id(), ExImCode::InvalidCmd);
    }
    let cmd = IndvOp::from_i64(wcmd.unwrap_or_default());

    let source_veda = recv_indv.get_first_literal("source_veda");
    if source_veda.is_none() {
        return IOResult::new(recv_indv.get_id(), ExImCode::InvalidTarget);
    }

    let source_veda = source_veda.unwrap_or_default();
    if source_veda.len() < 32 {
        return IOResult::new(recv_indv.get_id(), ExImCode::InvalidTarget);
    }

    let target_veda = recv_indv.get_first_literal("target_veda");
    if target_veda.is_none() {
        return IOResult::new(recv_indv.get_id(), ExImCode::InvalidTarget);
    }
    let target_veda = target_veda.unwrap();

    if target_veda != "*" && my_node_id != target_veda {
        return IOResult::new(recv_indv.get_id(), ExImCode::InvalidTarget);
    }

    let new_state = recv_indv.get_first_binobj("new_state");
    if cmd != IndvOp::Remove && new_state.is_some() {
        let mut indv = Individual::new_raw(RawObj::new(new_state.unwrap_or_default()));
        if parse_raw(&mut indv).is_ok() {
            indv.parse_all();
            indv.add_uri("sys:source", &source_veda);

            let res = veda_api.update(systicket, cmd, &indv);

            if res.result != ResultCode::Ok {
                error!("fail update, uri={}, result_code={:?}", recv_indv.get_id(), res.result);
                return IOResult::new(recv_indv.get_id(), ExImCode::FailUpdate);
            } else {
                info!("get from {}, success update, uri={}", source_veda, recv_indv.get_id());
                return IOResult::new(recv_indv.get_id(), ExImCode::Ok);
            }
        }
    }

    IOResult::new(recv_indv.get_id(), ExImCode::FailUpdate)
}

pub fn load_linked_nodes(module: &mut Module, node_upd_counter: &mut i64, link_node_addresses: &mut HashMap<String, String>) {
    let mut node = Individual::default();

    if module.storage.get_individual("cfg:standart_node", &mut node) {
        if let Some(c) = node.get_first_integer("v-s:updateCounter") {
            if c > *node_upd_counter {
                link_node_addresses.clear();
                if let Some(v) = node.get_literals("cfg:linked_node") {
                    for el in v {
                        let mut link_node = Individual::default();

                        if module.storage.get_individual(&el, &mut link_node) && !link_node.is_exists("v-s:delete") {
                            if let Some(addr) = link_node.get_first_literal("rdf:value") {
                                link_node_addresses.insert(link_node.get_first_literal("cfg:node_id").unwrap_or_default(), addr);
                            }
                        }
                    }
                    info!("linked nodes: {:?}", link_node_addresses);
                }
                *node_upd_counter = c;
            }
        }
    }
}

pub fn get_db_id(module: &mut Module) -> Option<String> {
    let mut indv = Individual::default();
    if module.storage.get_individual("cfg:system", &mut indv) {
        if let Some(c) = indv.get_first_literal("sys:id") {
            return Some(c);
        }
    }
    None
}

pub fn create_db_id(module: &mut Module) -> Option<String> {
    let systicket;
    if let Ok(t) = module.get_sys_ticket_id() {
        systicket = t;
    } else {
        error!("fail get systicket");
        return None;
    }

    let uuid1 = "sys:".to_owned() + &Uuid::new_v4().to_hyphenated().to_string();
    info!("create new db id = {}", uuid1);

    let mut new_indv = Individual::default();
    new_indv.set_id("cfg:system");
    new_indv.add_string("sys:id", &uuid1, Lang::NONE);

    let res = module.api.update(&systicket, IndvOp::Put, &new_indv);

    if res.result != ResultCode::Ok {
        error!("fail update, uri={}, result_code={:?}", new_indv.get_id(), res.result);
    } else {
        return Some(uuid1);
    }

    None
}
