#[macro_use]
extern crate log;

pub mod app;

use app::*;
use nng::{Message, Protocol, Socket};
use serde_json::json;
use serde_json::Value;
use std::error::Error;
use std::fmt;
use v_onto::individual::Individual;

#[derive(Debug)]
pub struct ApiError {
    result: ResultCode,
    info: String,
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "There is an error: {} {:?}", self.info, self.result)
    }
}

impl Error for ApiError {}

impl Default for ApiError {
    fn default() -> Self {
        ApiError {
            result: ResultCode::Zero,
            info: Default::default(),
        }
    }
}
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
    AddTo = 47,

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
            47 => IndvOp::AddTo,
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
            IndvOp::AddTo => 47,
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
            IndvOp::AddTo => "add_to",
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
        self.update_with_event(ticket, "", "", cmd, indv)
    }

    pub fn update_or_err(&mut self, ticket: &str, event_id: &str, src: &str, cmd: IndvOp, indv: &Individual) -> Result<OpResult, ApiError> {
        let res = self.update_with_event(ticket, event_id, src, cmd, indv);
        if res.result == ResultCode::Ok {
            Ok(res)
        } else {
            Err(ApiError {
                result: res.result,
                info: "update_or_err".to_owned(),
            })
        }
    }

    pub fn update_with_event(&mut self, ticket: &str, event_id: &str, src: &str, cmd: IndvOp, indv: &Individual) -> OpResult {
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
            "event_id" : event_id,
            "src" : src
        });

        debug!("SEND {}", query.to_string());
        let req = Message::from(query.to_string().as_bytes());

        if let Err(e) = self.client.send(req) {
            error!("api:update - fail send to main module, err={:?}", e);
            return OpResult::res(ResultCode::NotReady);
        }

        // Wait for the response from the server.
        let wmsg = self.client.recv();

        if let Err(e) = wmsg {
            error!("api:update - fail recv from main module, err={:?}", e);
            return OpResult::res(ResultCode::NotReady);
        }

        let msg = wmsg.unwrap();

        debug!("recv msg = {}", &String::from_utf8_lossy(&msg));

        let reply = serde_json::from_str(&String::from_utf8_lossy(&msg));

        if let Err(e) = reply {
            error!("api:update - fail parse result operation [put], err={:?}", e);
            return OpResult::res(ResultCode::BadRequest);
        }

        let json: Value = reply.unwrap();

        if let Some(t) = json["type"].as_str() {
            if t != "OpResult" {
                error!("api:update - expecten \"type\" = \"OpResult\", found {}", t);
                return OpResult::res(ResultCode::BadRequest);
            }
        } else {
            error!("api:update - not found \"type\"");
            return OpResult::res(ResultCode::BadRequest);
        }

        if let Some(arr) = json["data"].as_array() {
            if arr.len() != 1 {
                error!("api:update - invalid \"data\" section");
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
                error!("api:update - invalid \"data\" section");
                return OpResult::res(ResultCode::BadRequest);
            }
        } else {
            if let Some(res) = json["result"].as_i64() {
                return OpResult {
                    result: ResultCode::from_i64(res),
                    op_id: 0,
                };
            } else {
                error!("api:update - not found \"data\"");
                return OpResult::res(ResultCode::BadRequest);
            }
        }

        OpResult::res(ResultCode::BadRequest)
    }
}
