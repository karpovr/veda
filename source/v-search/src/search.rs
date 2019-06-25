#[macro_use]
extern crate log;

use nng::{Message, Protocol, Socket};
use serde_json::Value;

pub struct FTQuery {
    user: String,
    query: String,
    sort: String,
    databases: String,
    reopen: bool,
    top: i32,
    limit: i32,
    from: i32,
}

pub struct FTResult {
    pub result_code: i32,
    pub result: Vec<String>,
    pub count: i64,
    pub estimated: u64,
    pub processed: u64,
    pub cursor: u64,
}

impl Default for FTResult {
    fn default() -> FTResult {
        FTResult {
            result_code: 0,
            result: Vec::new(),
            count: 0,
            estimated: 0,
            processed: 0,
            cursor: 0,
        }
    }
}

impl FTQuery {
    pub fn new(user: &str, query: &str) -> FTQuery {
        FTQuery {
            user: user.to_owned(),
            query: query.to_owned(),
            sort: "".to_owned(),
            databases: "".to_owned(),
            reopen: false,
            top: 10000,
            limit: 10000,
            from: 0,
        }
    }

    pub fn as_string(&self) -> String {
        let mut s = String::new();

        s.push_str("[\"UU=");
        s.push_str(&self.user);
        s.push_str("\",\"");
        s.push_str(&self.query);
        s.push_str("\",\"");
        s.push_str(&self.sort);
        s.push_str("\",\"");
        s.push_str(&self.databases);
        s.push_str("\",");
        s.push_str(&self.reopen.to_string());
        s.push_str(",");
        s.push_str(&self.top.to_string());
        s.push_str(",");
        s.push_str(&self.limit.to_string());
        s.push_str(",");
        s.push_str(&self.from.to_string());
        s.push_str("]");

        s
    }
}

pub struct FTClient {
    client: Socket,
    addr: String,
    is_ready: bool,
}

impl FTClient {
    pub fn new(_ro_client_addr: String) -> FTClient {
        FTClient {
            client: Socket::new(Protocol::Req0).unwrap(),
            addr: _ro_client_addr,
            is_ready: false,
        }
    }

    pub fn connect(&mut self) -> bool {
        if let Err(e) = self.client.dial(self.addr.as_str()) {
            error!("fail dial to ro-storage, [{}], err={}", self.addr, e);
        } else {
            info!("sucess connect to ro-storage, [{}]", self.addr);
            self.is_ready = true;
        }
        self.is_ready
    }

    pub fn query(&mut self, query: FTQuery) -> FTResult {
        let mut res = FTResult::default();

        if !self.is_ready {
            self.connect();
        }

        if !self.is_ready {
            res.result_code = 474;
            return res;
        }

        let req = Message::from(query.as_string().as_bytes());

        self.client.send(req).unwrap();

        // Wait for the response from the server.
        let msg = self.client.recv().unwrap();

        let reply = String::from_utf8_lossy(&msg);

        let v: Value = if let Ok(v) = serde_json::from_str(&reply) {
            v
        } else {
            Value::Null
        };

        res.result_code = v["result_code"].as_i64().unwrap_or_default() as i32;

        if res.result_code == 200 {
            let jarray: &Vec<_> = &v["result"].as_array().expect("array");
            res.result = jarray.iter().map(|v| v.as_str().unwrap_or_default().to_owned()).collect();

            res.count = v["count"].as_i64().unwrap_or_default();
            res.estimated = v["estimated"].as_u64().unwrap_or_default();
            res.processed = v["processed"].as_u64().unwrap_or_default();
            res.cursor = v["cursor"].as_u64().unwrap_or_default();
        }

        //info!("msg={}", v);
        res
    }


}
