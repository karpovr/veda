use crate::storage::Storage;
use futures::future::Future;
use rusty_tarantool::tarantool::{Client, ClientConfig};
use std::net::SocketAddr;
use tokio::runtime::current_thread::Runtime;
use v_onto::individual::*;
use v_onto::msgpack8individual::msgpack2individual;

pub struct TTStorage {
    rt: Runtime,
    client: Client,
    space_id: i32,
}

impl TTStorage {
    pub fn new(tt_uri: String, login: &str, pass: &str) -> TTStorage {
        let addr: SocketAddr = tt_uri.parse().unwrap();
        TTStorage {
            rt: Runtime::new().unwrap(),
            space_id: 512,
            client: ClientConfig::new(addr, login, pass)
                .set_timeout_time_ms(1000)
                .set_reconnect_time_ms(10000)
                .build(),
        }
    }
}

impl Storage for TTStorage {
    fn set_binobj(&mut self, uri: &str, indv: &mut Individual) -> bool {
        let key = (uri,);

        let resp = self
            .client
            .select(self.space_id, 0, &key, 0, 100, 0)
            .and_then(move |response| Ok(response.data));

        if let Ok(v) = self.rt.block_on(resp) {
            indv.binobj = v[5..].to_vec();

            if msgpack2individual(indv) {
                return true;
            } else {
                error!("fail parse binobj");
            }
        }

        return false;
    }
}
