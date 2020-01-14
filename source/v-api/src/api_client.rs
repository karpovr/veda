#[macro_use]
extern crate log;

pub mod app;

use app::*;
use nng::{Message, Protocol, Socket};
use serde_json::json;
use serde_json::Value;
use v_onto::individual::Individual;

#[derive(PartialEq, Debug, Clone)]
#[repr(u16)]
pub enum IndvOp {
    /// Сохранить
    Put = 1,

    /// Сохранить
    Get = 2,

    /// Получить тикет
    GetTicket = 3,

    /// Авторизовать
    Authorize = 8,

    /// Установить в
    SetIn = 45,

    /// Добавить в
    AddIn = 47,

    /// Убрать из
    RemoveFrom = 48,

    /// Убрать
    Remove = 51,

    None = 52,
}

impl IndvOp {
    pub fn from_i64(value: i64) -> IndvOp {
        match value {
            1 => IndvOp::Put,
            2 => IndvOp::Get,
            51 => IndvOp::Remove,
            47 => IndvOp::AddIn,
            45 => IndvOp::SetIn,
            48 => IndvOp::RemoveFrom,
            8 => IndvOp::Authorize,
            3 => IndvOp::GetTicket,
            // ...
            _ => IndvOp::None,
        }
    }

    pub fn to_i64(&self) -> i64 {
        match self {
            IndvOp::Put => 1,
            IndvOp::Get => 2,
            IndvOp::Remove => 51,
            IndvOp::AddIn => 47,
            IndvOp::SetIn => 45,
            IndvOp::RemoveFrom => 48,
            IndvOp::Authorize => 8,
            IndvOp::GetTicket => 3,
            // ...
            IndvOp::None => 52,
        }
    }

    pub fn as_string(&self) -> String {
        match self {
            IndvOp::Get => "get",
            IndvOp::Put => "put",
            IndvOp::Remove => "remove",
            IndvOp::AddIn => "add_in",
            IndvOp::SetIn => "set_in",
            IndvOp::RemoveFrom => "remove_from",
            IndvOp::Authorize => "authorize",
            IndvOp::GetTicket => "get_ticket",
            // ...
            IndvOp::None => "none",
        }
        .to_string()
    }
}

#[derive(Debug)]
pub struct OpResult {
    pub result: ResultCode,
    pub op_id: i64,
}

impl OpResult {
    pub fn res(r: ResultCode) -> Self {
        OpResult {
            result: r,
            op_id: -1,
        }
    }
}

pub struct APIClient {
    client: Socket,
    addr: String,
    is_ready: bool,
}

impl APIClient {
    pub fn new(_addr: String) -> APIClient {
        APIClient {
            client: Socket::new(Protocol::Req0).unwrap(),
            addr: _addr,
            is_ready: false,
        }
    }

    pub fn connect(&mut self) -> bool {
        if self.addr.is_empty() {
            error!("api-client:invalid addr: [{}]", self.addr);
            return self.is_ready;
        }

        if let Err(e) = self.client.dial(self.addr.as_str()) {
            error!("api-client:fail dial to main module, [{}], err={}", self.addr, e);
        } else {
            info!("success connect to main module, [{}]", self.addr);
            self.is_ready = true;
        }
        self.is_ready
    }

    pub fn update(&mut self, ticket: &str, cmd: IndvOp, indv: &Individual) -> OpResult {
        if !self.is_ready {
            self.connect();
        }

        if !self.is_ready {
            return OpResult::res(ResultCode::NotReady);
        }

        let query = json!({
            "function": cmd.as_string(),
            "ticket": ticket,
            "individuals": [ indv.get_obj().as_json() ],
            "assigned_subsystems": 0,
            "event_id" : ""
        });

        debug!("SEND {}", query.to_string());
        let req = Message::from(query.to_string().as_bytes());

        if let Err(e) = self.client.send(req) {
            error!("fail send to main module, err={:?}", e);
            return OpResult::res(ResultCode::NotReady);
        }

        // Wait for the response from the server.
        let wmsg = self.client.recv();

        if let Err(e) = wmsg {
            error!("fail recv from main module, err={:?}", e);
            return OpResult::res(ResultCode::NotReady);
        }

        let msg = wmsg.unwrap();

        let reply = serde_json::from_str(&String::from_utf8_lossy(&msg));

        if let Err(e) = reply {
            error!("fail parse result operation [put], err={:?}", e);
            return OpResult::res(ResultCode::BadRequest);
        }

        let json: Value = reply.unwrap();

        if let Some(t) = json["type"].as_str() {
            if t != "OpResult" {
                error!("expecten \"type\" = \"OpResult\", found {}", t);
                return OpResult::res(ResultCode::BadRequest);
            }
        } else {
            error!("not found \"type\"");
            return OpResult::res(ResultCode::BadRequest);
        }

        if let Some(arr) = json["data"].as_array() {
            if arr.len() != 1 {
                error!("invalid \"data\" section");
                return OpResult::res(ResultCode::BadRequest);
            }

            if let Some(res) = arr[0]["result"].as_i64() {
                if let Some(op_id) = arr[0]["op_id"].as_i64() {
                    return OpResult {
                        result: ResultCode::from_i64(res),
                        op_id,
                    };
                }
            } else {
                error!("invalid \"data\" section");
                return OpResult::res(ResultCode::BadRequest);
            }
        } else {
            error!("not found \"data\"");
            return OpResult::res(ResultCode::BadRequest);
        }

        OpResult::res(ResultCode::BadRequest)
    }
}
