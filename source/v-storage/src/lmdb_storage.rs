use crate::storage::Storage;
use lmdb_rs_m::core::{
    /*Database,*/ EnvCreateNoLock, EnvCreateNoMetaSync, EnvCreateNoSync, EnvCreateReadOnly,
};
use lmdb_rs_m::{DbFlags, DbHandle, EnvBuilder, Environment, MdbError};
use v_onto::individual::*;
use v_onto::msgpack8individual::msgpack2individual;

pub struct LMDBStorage {
    db_handle: Result<DbHandle, MdbError>,
    db_env: Result<Environment, MdbError>,
}

impl LMDBStorage {
    pub fn new(db_path: &str) -> LMDBStorage {
        let db_handle;

        let env_builder = EnvBuilder::new()
            .flags(EnvCreateNoLock | EnvCreateReadOnly | EnvCreateNoMetaSync | EnvCreateNoSync);

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

        LMDBStorage {
            db_env: db_env,
            db_handle: db_handle,
        }
    }
}

impl Storage for LMDBStorage {
    fn set_binobj(&mut self, uri: &str, indv: &mut Individual) -> bool {
        match &self.db_env {
            Ok(env) => match &self.db_handle {
                Ok(handle) => match env.get_reader() {
                    Ok(txn) => {
                        let db = txn.bind(&handle);

                        match db.get::<Vec<u8>>(&uri) {
                            Ok(val) => {
                                indv.binobj = val;

                                if msgpack2individual(indv) {
                                    return true;
                                } else {
                                    error!("fail parse binobj");
                                }

                                return true;
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
                    Err(e) => {
                        error!("fail crate transaction, err={}", e);
                        return false;
                    }
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
    }
}
