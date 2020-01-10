#[macro_use]
extern crate enum_primitive_derive;
#[macro_use]
extern crate log;

use nng::{Message, Socket};
use num_traits::{FromPrimitive, ToPrimitive};
use std::collections::HashMap;
use std::str::*;
use std::{thread, time};
use uuid::*;
use v_api::*;
use v_api::app::ResultCode;
use v_module::module::Module;
use v_onto::datatype::Lang;
use v_onto::individual::{Individual, RawObj};
use v_onto::individual2msgpack::*;
use v_onto::parser::*;
use v_queue::consumer::*;
use v_queue::record::*;

const TRANSMIT_FAILED: i64 = 32;

#[derive(Primitive, PartialEq, Debug, Clone)]
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

pub fn processing_consumer_of_node(queue_consumer: &mut Consumer, soc: &mut Socket, node_id: &str, node_addr: &str) {
    let mut size_batch = 0;

    // read queue current part info
    if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
        error!("get_info_of_part {}: {}", queue_consumer.id, e.as_str());
        return;
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

            let mut indv = &mut Individual::new_raw(raw);
            while let Err(e) = send_changes(&mut indv, soc, node_id, node_addr) {
                error!("fail prepare queue element, err={}", e.as_string());
                if e != ExImCode::TransmitFailed {
                    break;
                }
                thread::sleep(time::Duration::from_millis(10000));
            }

            queue_consumer.commit_and_next();

            if total_prepared_count % 1000 == 0 {
                info!("get from queue, count: {}", total_prepared_count);
            }
        }
    }
}

fn send_changes(msg: &mut Individual, soc: &mut Socket, node_id: &str, node_addr: &str) -> Result<(), ExImCode> {
    if parse_raw(msg).is_ok() {

        let target_veda = msg.get_first_literal("target_veda");
        if target_veda.is_none() {
            return Err(ExImCode::InvalidMessage);
        }

        let target_veda = target_veda.unwrap_or_default();
        if target_veda != "*" && target_veda != node_id {
            return Ok(());
        }

        let wcmd = msg.get_first_integer("cmd");
        if wcmd.is_none() {
            return Err(ExImCode::InvalidMessage);
        }
        let cmd = IndvOp::from_i64(wcmd.unwrap_or_default());

        let new_state = msg.get_first_binobj("new_state");
        if cmd != IndvOp::Remove && new_state.is_none() {
            return Err(ExImCode::InvalidMessage);
        }

        let source_veda = msg.get_first_literal("source_veda");
        if source_veda.is_none() {
            return Err(ExImCode::InvalidMessage);
        }

        let date = msg.get_first_integer("date");
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

                let mut raw1: Vec<u8> = Vec::new();
                if to_msgpack(&new_indv, &mut raw1).is_ok() {
                    info!("send {} to {}", indv.get_id(), node_addr);
                    let req = Message::from(raw1.as_slice());
                    if let Err(e) = soc.send(req) {
                        error!("fail send to slave node, err={:?}", e);
                        return Err(ExImCode::TransmitFailed);
                    }

                    // Wait for the response from the server (slave).
                    let wmsg = soc.recv();
                    if let Err(e) = wmsg {
                        error!("fail recv from slave node, err={:?}", e);
                        return Err(ExImCode::TransmitFailed);
                    }
                    let msg = wmsg.unwrap();

                    let res = dec_slave_resp(msg.as_ref());
                    if res.0 != indv.get_id() {
                        error!("recv message invalid, expected uri={}, recv uri={}", indv.get_id(), res.0);
                        return Err(ExImCode::TransmitFailed);
                    }

                    if res.1 != ExImCode::Ok {
                        error!("recv error, uri={}, error={}", res.0, res.1.as_string());
                        return Err(ExImCode::TransmitFailed);
                    }

                    //info!("success send {} to {}", uri, node_addr);
                }
            }
            // info! ("{:?}", raw);
        }
    }
    Ok(())
}

pub fn processing_message_contains_changes(recv_msg: Vec<u8>, systicket: &str, module: &mut Module) -> (String, ExImCode) {
    let mut recv_indv = Individual::new_raw(RawObj::new(recv_msg));

    if parse_raw(&mut recv_indv).is_ok() {

        let wcmd = recv_indv.get_first_integer("cmd");
        if wcmd.is_none() {
            return (recv_indv.get_id().to_owned(), ExImCode::InvalidCmd);
        }
        let cmd = IndvOp::from_i64(wcmd.unwrap_or_default());

        let source_veda = recv_indv.get_first_literal("source_veda");
        if source_veda.is_none() {
            return (recv_indv.get_id().to_owned(), ExImCode::InvalidTarget);
        }

        let source_veda = source_veda.unwrap_or_default();
        if source_veda.len() < 32 {
            return (recv_indv.get_id().to_owned(), ExImCode::InvalidTarget);
        }

        let target_veda = recv_indv.get_first_literal("target_veda");
        if target_veda.is_none() {
            return (recv_indv.get_id().to_owned(), ExImCode::InvalidTarget);
        }

        let new_state = recv_indv.get_first_binobj("new_state");
        if cmd != IndvOp::Remove && new_state.is_some() {
            let mut indv = Individual::new_raw(RawObj::new(new_state.unwrap_or_default()));
            if parse_raw(&mut indv).is_ok() {
                indv.parse_all();
                indv.add_uri("sys:source", &source_veda);

                let res = module.api.update(systicket, cmd, &mut indv);

                if res.result != ResultCode::Ok {
                    error!("fail update, uri={}, result_code={:?}", recv_indv.get_id(), res.result);
                    return (recv_indv.get_id().to_owned(), ExImCode::FailUpdate);
                } else {
                    info!("success update, uri={}", recv_indv.get_id());
                    return (recv_indv.get_id().to_owned(), ExImCode::Ok);
                }
            }
        }
    }

    (recv_indv.get_id().to_owned(), ExImCode::FailUpdate)
}

pub fn enc_slave_resp(uri: &str, code: ExImCode) -> String {
    let q: i64 = code.into();
    uri.to_owned() + "," + &q.to_string()
}

pub fn dec_slave_resp(msg: &[u8]) -> (&str, ExImCode) {
    let mut iter = msg.split(|ch| *ch == b',');

    if let Some(wuri) = iter.next() {
        if let Ok(uri) = from_utf8(wuri) {
            if let Some(wcode) = iter.next() {
                if let Ok(s) = from_utf8(wcode) {
                    if let Ok(code) = s.parse::<i64>() {
                        return (uri, code.into());
                    }
                }
            }
        }
    }
    ("?", ExImCode::Unknown)
}

pub fn get_linked_nodes(module: &mut Module, node_upd_counter: &mut i64, link_node_addresses: &mut HashMap<String, String>) {
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
                                link_node_addresses.insert(el, addr);
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

    let res = module.api.update(&systicket, IndvOp::Put, &mut new_indv);

    if res.result != ResultCode::Ok {
        error!("fail update, uri={}, result_code={:?}", new_indv.get_id(), res.result);
    } else {
        return Some(uuid1);
    }

    None
}
