use crate::storage::Storage;
use lmdb_rs_m::core::{/*Database,*/ EnvCreateNoLock, EnvCreateNoMetaSync, EnvCreateNoSync, EnvCreateReadOnly};
use lmdb_rs_m::{DbFlags, DbHandle, EnvBuilder, Environment, MdbError};
use v_onto::individual::*;
use v_onto::parser::*;

pub struct LMDBStorage {
    db_path: String,
    db_handle: Result<DbHandle, MdbError>,
    db_env: Result<Environment, MdbError>,
}

pub fn open(db_path: &str) -> (Result<DbHandle, MdbError>, Result<Environment, MdbError>) {
    let db_handle;

    let env_builder = EnvBuilder::new().flags(EnvCreateNoLock | EnvCreateReadOnly | EnvCreateNoMetaSync | EnvCreateNoSync);

    let db_env = env_builder.open(db_path, 0o644);

    match &db_env {
        Ok(env) => {
            db_handle = env.get_default_db(DbFlags::empty());
        }
        Err(e) => {
            error!("ERR! Authorize: Err opening environment: {:?}", e);
            db_handle = Err(MdbError::Corrupted);
        }
    }
    (db_handle, db_env)
}

impl LMDBStorage {
    pub fn new(db_path: &str) -> LMDBStorage {
        let res = open(db_path);

        LMDBStorage {
            db_path: db_path.to_owned(),
            db_handle: res.0,
            db_env: res.1,
        }
    }
}

impl Storage for LMDBStorage {
    fn set_binobj(&mut self, uri: &str, raw: &mut RawObj, indv: &mut Individual) -> bool {
        for _it in 0..2 {
            let mut is_need_reopen = false;
            match &self.db_env {
                Ok(env) => match &self.db_handle {
                    Ok(handle) => match env.get_reader() {
                        Ok(txn) => {
                            let db = txn.bind(&handle);

                            match db.get::<Vec<u8>>(&uri) {
                                Ok(val) => {
                                    raw.data = val;

                                    if let Ok(uri) = parse_raw(raw) {
                                        indv.uri = uri;
                                        return true;
                                    } else {
                                        error!("LMDBStorage: fail parse binobj, len={}, uri={}", raw.data.len(), uri);
                                        return false;
                                    }
                                }
                                Err(e) => match e {
                                    MdbError::NotFound => {
                                        return false;
                                    }
                                    _ => {
                                        error!("db.get {:?}, {}", e, uri);
                                        return false;
                                    }
                                },
                            }
                        }
                        Err(e) => match e {
                            MdbError::Other(c, _) => {
                                if c == -30785 {
                                    is_need_reopen = true;
                                } else {
                                    error!("fail crate transaction, err={}", e);
                                    return false;
                                }
                            }
                            _ => {
                                error!("fail crate transaction, err={}", e);
                            }
                        },
                    },
                    Err(e) => {
                        error!("db handle, err={}", e);
                        return false;
                    }
                },
                Err(e) => {
                    error!("db environment, err={}", e);
                    return false;
                }
            }

            if is_need_reopen {
                warn!("db {} reopen", self.db_path);
                let res = open(&self.db_path);

                self.db_handle = res.0;
                self.db_env = res.1;
            }
        }

        false
    }
}
