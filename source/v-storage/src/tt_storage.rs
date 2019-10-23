use crate::storage::*;
use futures::future::Future;
use rusty_tarantool::tarantool::{Client, ClientConfig};
use std::net::SocketAddr;
use std::str;
use tokio::runtime::current_thread::Runtime;
use v_onto::individual::*;
use v_onto::parser::*;

pub struct TTStorage {
    rt: Runtime,
    client: Client,
}

const INDIVIDUALS_SPACE_ID: i32 = 512;
const TICKETS_SPACE_ID: i32 = 513;
const AZ_SPACE_ID: i32 = 514;

impl TTStorage {
    pub fn new(tt_uri: String, login: &str, pass: &str) -> TTStorage {
        let addr: SocketAddr = tt_uri.parse().unwrap();
        TTStorage {
            rt: Runtime::new().unwrap(),
            client: ClientConfig::new(addr, login, pass).set_timeout_time_ms(1000).set_reconnect_time_ms(10000).build(),
        }
    }
}

impl Storage for TTStorage {
    fn get_individual_from_db(&mut self, storage: StorageId, uri: &str, iraw: &mut Individual) -> bool {
        let space = if storage == StorageId::Tickets {
            TICKETS_SPACE_ID
        } else if storage == StorageId::Az {
            AZ_SPACE_ID
        } else {
            INDIVIDUALS_SPACE_ID
        };

        let key = (uri,);
        let resp = self.client.select(space, 0, &key, 0, 100, 0).and_then(move |response| Ok(response.data));

        if let Ok(v) = self.rt.block_on(resp) {
            iraw.set_raw(&v[5..]);

            if parse_raw(iraw).is_ok() {
                return true;
            }
            //else {
            //    error!("TTStorage: fail parse binobj, len={}, uri={}", iraw.raw.data.len(), uri);
            //}
        }

        false
    }

    fn put_kv(&mut self, storage: StorageId, key: &str, val: &str) -> bool {
        let space = if storage == StorageId::Tickets {
            TICKETS_SPACE_ID
        } else if storage == StorageId::Az {
            AZ_SPACE_ID
        } else {
            INDIVIDUALS_SPACE_ID
        };

        let tuple = (key, val);
        let resp = self.client.replace(space, &tuple).and_then(move |response| Ok(response.data));

        if let Ok(v) = self.rt.block_on(resp) {
            info!("tt replace res = {:?}", v);
        }

        false
    }

    fn get_v(&mut self, storage: StorageId, key: &str) -> Option<String> {
        return None;
    }

}
