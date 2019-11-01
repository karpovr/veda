#[macro_use]
extern crate lazy_static;

use lmdb_rs_m::core::{Database, EnvCreateNoLock, EnvCreateNoMetaSync, EnvCreateNoSync, EnvCreateReadOnly};
use lmdb_rs_m::{DbFlags, EnvBuilder, Environment, MdbError};

use std::cell::RefCell;
use std::sync::Mutex;
use std::thread;
use std::time;
use std::time::SystemTime;
use v_authorization::*;

const DB_PATH: &str = "./data/acl-indexes/";
const MODULE_INFO_PATH: &str = "./data/module-info/acl_preparer_info";

lazy_static! {

#[derive(Debug)]
    static ref LAST_MODIFIED_INFO : Mutex<RefCell<SystemTime>> = Mutex::new(RefCell::new (SystemTime:: now()));

    static ref ENV : Mutex<RefCell<Environment>> = Mutex::new(RefCell::new ({
    let env_builder = EnvBuilder::new().flags(EnvCreateNoLock | EnvCreateReadOnly | EnvCreateNoMetaSync | EnvCreateNoSync);

    let env1;
    loop {
        match env_builder.open(DB_PATH, 0o644) {
            Ok(env_res) => {
                env1 = env_res;
                break
            },
            Err(e) => {
                eprintln! ("ERR! Authorize: Err opening environment: {:?}", e);
                thread::sleep(time::Duration::from_secs(3));
                eprintln! ("Retry");
            }
        }
    }
    eprintln! ("LIB_AZ: Opened environment ./data/acl-indexes");
    env1
    }));

}

fn check_for_reload() -> std::io::Result<bool> {
    use std::fs::File;
    let f = File::open(MODULE_INFO_PATH)?;

    let metadata = f.metadata()?;

    if let Ok(new_time) = metadata.modified() {
        let prev_time = *LAST_MODIFIED_INFO.lock().unwrap().get_mut();

        if new_time != prev_time {
            LAST_MODIFIED_INFO.lock().unwrap().replace(new_time);
            //eprintln!("LAST_MODIFIED_INFO={:?}", new_time);
            return Ok(true);
        }
    }

    Ok(false)
}

pub struct LMDBStorage<'a> {
    db: &'a Database<'a>,
}

impl<'a> Storage for LMDBStorage<'a> {
    fn get(&self, key: &str) -> Result<String, i64> {
        match self.db.get::<String>(&key) {
            Ok(val) => Ok(val),
            Err(e) => match e {
                MdbError::NotFound => Err(0),
                _ => {
                    eprintln!("ERR! Authorize: db.get {:?}, {}", e, key);
                    Err(-1)
                }
            },
        }
    }

    fn fiber_yield(&self) {}
}

pub fn _authorize(uri: &str, user_uri: &str, request_access: u8, _is_check_for_reload: bool, trace: &mut Trace) -> Result<u8, i64> {
    if _is_check_for_reload {
        if let Ok(true) = check_for_reload() {
            //eprintln!("INFO: Authorize: reopen db");

            let env_builder = EnvBuilder::new().flags(EnvCreateNoLock | EnvCreateReadOnly | EnvCreateNoMetaSync | EnvCreateNoSync);

            match env_builder.open(DB_PATH, 0o644) {
                Ok(env_res) => {
                    ENV.lock().unwrap().replace(env_res);
                }
                Err(e) => {
                    eprintln!("ERR! Authorize: Err opening environment: {:?}", e);
                }
            }
        }
    }

    let env = ENV.lock().unwrap().get_mut().clone();

    let db_handle;
    loop {
        match env.get_default_db(DbFlags::empty()) {
            Ok(db_handle_res) => {
                db_handle = db_handle_res;
                break;
            }
            Err(e) => {
                eprintln!("ERR! Authorize: Err opening db handle: {:?}", e);
                thread::sleep(time::Duration::from_secs(3));
                eprintln!("Retry");
            }
        }
    }

    let txn;
    match env.get_reader() {
        Ok(txn1) => {
            txn = txn1;
        }
        Err(e) => {
            eprintln!("ERR! Authorize:CREATING TRANSACTION {:?}", e);
            eprintln!("reopen db");

            let env_builder = EnvBuilder::new().flags(EnvCreateNoLock | EnvCreateReadOnly | EnvCreateNoMetaSync | EnvCreateNoSync);

            match env_builder.open(DB_PATH, 0o644) {
                Ok(env_res) => {
                    ENV.lock().unwrap().replace(env_res);
                }
                Err(e) => {
                    eprintln!("ERR! Authorize: Err opening environment: {:?}", e);
                }
            }

            return _authorize(uri, user_uri, request_access, _is_check_for_reload, trace);
        }
    }

    let db = txn.bind(&db_handle);
    let storage = LMDBStorage {
        db: &db,
    };

    // 0. читаем фильтр прав у object (uri)
    let mut filter_value;
    let mut filter_allow_access_to_other = 0;
    match storage.get(&(FILTER_PREFIX.to_owned() + uri)) {
        Ok(data) => {
            filter_value = data;
            if filter_value.len() < 3 {
                filter_value.clear();
            } else {
                let filters_set: &mut Vec<Right> = &mut Vec::new();
                get_elements_from_index(&filter_value, filters_set);

                if !filters_set.is_empty() {
                    let el = &mut filters_set[0];

                    filter_value = el.id.clone();
                    filter_allow_access_to_other = el.access;
                }
            }
            //eprintln!("Authorize:uri=[{}], filter_value=[{}]", uri, filter_value);
        }
        Err(e) => {
            if e == 0 {
                filter_value = String::new();
            } else {
                eprintln!("ERR! Authorize: _authorize {:?}", uri);
                return Err(e);
            }
        }
    }

    authorize(uri, user_uri, request_access, &filter_value, filter_allow_access_to_other, &storage, trace)
}