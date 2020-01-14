use crate::storage::*;
use lmdb_rs_m::core::{EnvCreateNoLock, EnvCreateNoMetaSync, EnvCreateNoSync, EnvCreateReadOnly};
use lmdb_rs_m::{DbFlags, DbHandle, EnvBuilder, Environment, MdbError};
use v_onto::individual::*;
use v_onto::parser::*;

pub(crate) struct LMDBStorage {
    db_path: String,

    individuals_db_handle: Result<DbHandle, MdbError>,
    individuals_db_env: Result<Environment, MdbError>,

    tickets_db_handle: Result<DbHandle, MdbError>,
    tickets_db_env: Result<Environment, MdbError>,

    az_db_handle: Result<DbHandle, MdbError>,
    az_db_env: Result<Environment, MdbError>,

    mode: StorageMode,
}

impl LMDBStorage {
    pub fn new(db_path: &str, mode: StorageMode) -> LMDBStorage {
        LMDBStorage {
            db_path: db_path.to_owned(),
            individuals_db_handle: Err(MdbError::Panic),
            individuals_db_env: Err(MdbError::Panic),
            tickets_db_handle: Err(MdbError::Panic),
            tickets_db_env: Err(MdbError::Panic),
            az_db_handle: Err(MdbError::Panic),
            az_db_env: Err(MdbError::Panic),
            mode,
        }
    }

    fn open(&mut self, storage: StorageId, mode: StorageMode) {
        let db_handle;

        let db_path = if storage == StorageId::Individuals {
            self.db_path.to_string() + "/lmdb-individuals/"
        } else if storage == StorageId::Tickets {
            self.db_path.to_string() + "/lmdb-tickets/"
        } else if storage == StorageId::Az {
            self.db_path.to_string() + "/acl-indexes/"
        } else {
            String::default()
        };

        let env_builder = if mode == StorageMode::ReadOnly {
            EnvBuilder::new().flags(EnvCreateNoLock | EnvCreateReadOnly | EnvCreateNoMetaSync | EnvCreateNoSync)
        } else {
            EnvBuilder::new().flags(EnvCreateNoLock | EnvCreateNoMetaSync | EnvCreateNoSync)
        };

        let db_env = env_builder.open(db_path, 0o644);

        match &db_env {
            Ok(env) => {
                db_handle = env.get_default_db(DbFlags::empty());
            }
            Err(e) => {
                error!("LMDB:fail opening read only environment, err={:?}", e);
                db_handle = Err(MdbError::Corrupted);
            }
        }

        if storage == StorageId::Individuals {
            self.individuals_db_handle = db_handle;
            self.individuals_db_env = db_env;
        } else if storage == StorageId::Tickets {
            self.tickets_db_handle = db_handle;
            self.tickets_db_env = db_env;
        } else if storage == StorageId::Az {
            self.az_db_handle = db_handle;
            self.az_db_env = db_env;
        }
    }
}

impl Storage for LMDBStorage {
    fn get_individual_from_db(&mut self, storage: StorageId, uri: &str, iraw: &mut Individual) -> bool {
        for _it in 0..2 {
            let db_handle;
            let db_env;

            if storage == StorageId::Individuals {
                db_env = &self.individuals_db_env;
                db_handle = &self.individuals_db_handle;
            } else if storage == StorageId::Tickets {
                db_env = &self.tickets_db_env;
                db_handle = &self.tickets_db_handle;
            } else if storage == StorageId::Az {
                db_env = &self.az_db_env;
                db_handle = &self.az_db_handle;
            } else {
                db_env = &Err(MdbError::Panic);
                db_handle = &Err(MdbError::Panic);
            }

            let mut is_need_reopen = false;

            match db_env {
                Ok(env) => match db_handle {
                    Ok(handle) => match env.get_reader() {
                        Ok(txn) => {
                            let db = txn.bind(&handle);

                            match db.get::<&[u8]>(&uri) {
                                Ok(val) => {
                                    iraw.set_raw(val);

                                    if parse_raw(iraw).is_ok() {
                                        return true;
                                    } else {
                                        error!("LMDB:fail parse binobj, len={}, uri=[{}]", iraw.get_raw_len(), uri);
                                        return false;
                                    }
                                }
                                Err(e) => match e {
                                    MdbError::NotFound => {
                                        return false;
                                    }
                                    _ => {
                                        error!("LMDB:db.get {:?}, uri=[{}]", e, uri);
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
                                    error!("LMDB:fail crate transaction, err={}, uri=[{}]", e, uri);
                                    return false;
                                }
                            }
                            _ => {
                                error!("LMDB:fail crate transaction, err={}, uri=[{}]", e, uri);
                            }
                        },
                    },
                    Err(e) => {
                        error!("LMDB:db handle, err={}, uri=[{}]", e, uri);
                        return false;
                    }
                },
                Err(e) => match e {
                    MdbError::Panic => {
                        is_need_reopen = true;
                    }
                    _ => {
                        error!("LMDB:db environment, err={}, uri=[{}]", e, uri);
                        return false;
                    }
                },
            }

            if is_need_reopen {
                warn!("LMDBStorage: db {} reopen {:?}", self.db_path, storage);

                self.open(storage.clone(), self.mode.clone());
            }
        }

        false
    }

    fn put_kv(&mut self, storage: StorageId, key: &str, val: &str) -> bool {
        if storage == StorageId::Individuals {
            return put_kv_lmdb(&self.individuals_db_env, &self.individuals_db_handle, key, val.as_bytes());
        } else if storage == StorageId::Tickets {
            return put_kv_lmdb(&self.tickets_db_env, &self.tickets_db_handle, key, val.as_bytes());
        } else if storage == StorageId::Az {
            return put_kv_lmdb(&self.az_db_env, &self.az_db_handle, key, val.as_bytes());
        }

        false
    }

    fn put_kv_raw(&mut self, storage: StorageId, key: &str, val: Vec<u8>) -> bool {
        if storage == StorageId::Individuals {
            return put_kv_lmdb(&self.individuals_db_env, &self.individuals_db_handle, key, val.as_slice());
        } else if storage == StorageId::Tickets {
            return put_kv_lmdb(&self.tickets_db_env, &self.tickets_db_handle, key, val.as_slice());
        } else if storage == StorageId::Az {
            return put_kv_lmdb(&self.az_db_env, &self.az_db_handle, key, val.as_slice());
        }

        false
    }

    fn remove(&mut self, storage: StorageId, key: &str) -> bool {
        if storage == StorageId::Individuals {
            return remove_from_lmdb(&self.individuals_db_env, &self.individuals_db_handle, key);
        } else if storage == StorageId::Tickets {
            return remove_from_lmdb(&self.tickets_db_env, &self.tickets_db_handle, key);
        } else if storage == StorageId::Az {
            return remove_from_lmdb(&self.az_db_env, &self.az_db_handle, key);
        }

        false
    }

    fn get_v(&mut self, storage: StorageId, key: &str) -> Option<String> {
        for _it in 0..2 {
            let db_handle;
            let db_env;

            if storage == StorageId::Individuals {
                db_env = &self.individuals_db_env;
                db_handle = &self.individuals_db_handle;
            } else if storage == StorageId::Tickets {
                db_env = &self.tickets_db_env;
                db_handle = &self.tickets_db_handle;
            } else if storage == StorageId::Az {
                db_env = &self.az_db_env;
                db_handle = &self.az_db_handle;
            } else {
                db_env = &Err(MdbError::Panic);
                db_handle = &Err(MdbError::Panic);
            }

            let mut is_need_reopen = false;

            match db_env {
                Ok(env) => match db_handle {
                    Ok(handle) => match env.get_reader() {
                        Ok(txn) => {
                            let db = txn.bind(&handle);

                            match db.get::<String>(&key) {
                                Ok(val) => {
                                    return Some(val);
                                }
                                Err(e) => match e {
                                    MdbError::NotFound => {
                                        return None;
                                    }
                                    _ => {
                                        error!("LMDB:db.get {:?}, key=[{}]", e, key);
                                        return None;
                                    }
                                },
                            }
                        }
                        Err(e) => match e {
                            MdbError::Other(c, _) => {
                                if c == -30785 {
                                    is_need_reopen = true;
                                } else {
                                    error!("LMDB:fail crate transaction, err={}", e);
                                    return None;
                                }
                            }
                            _ => {
                                error!("LMDB:fail crate transaction, err={}", e);
                            }
                        },
                    },
                    Err(e) => {
                        error!("LMDB:db handle, err={}", e);
                        return None;
                    }
                },
                Err(e) => match e {
                    MdbError::Panic => {
                        is_need_reopen = true;
                    }
                    _ => {
                        error!("LMDB:db environment, err={}", e);
                        return None;
                    }
                },
            }

            if is_need_reopen {
                warn!("db {} reopen", self.db_path);

                self.open(storage.clone(), self.mode.clone());
            }
        }

        None
    }

    fn get_raw(&mut self, storage: StorageId, key: &str) -> Vec<u8> {
        for _it in 0..2 {
            let db_handle;
            let db_env;

            if storage == StorageId::Individuals {
                db_env = &self.individuals_db_env;
                db_handle = &self.individuals_db_handle;
            } else if storage == StorageId::Tickets {
                db_env = &self.tickets_db_env;
                db_handle = &self.tickets_db_handle;
            } else if storage == StorageId::Az {
                db_env = &self.az_db_env;
                db_handle = &self.az_db_handle;
            } else {
                db_env = &Err(MdbError::Panic);
                db_handle = &Err(MdbError::Panic);
            }

            let mut is_need_reopen = false;

            match db_env {
                Ok(env) => match db_handle {
                    Ok(handle) => match env.get_reader() {
                        Ok(txn) => {
                            let db = txn.bind(&handle);

                            match db.get::<Vec<u8>>(&key) {
                                Ok(val) => {
                                    return val;
                                }
                                Err(e) => match e {
                                    MdbError::NotFound => {
                                        return Vec::default();
                                    }
                                    _ => {
                                        error!("LMDB:db.get {:?}, {}", e, key);
                                        return Vec::default();
                                    }
                                },
                            }
                        }
                        Err(e) => match e {
                            MdbError::Other(c, _) => {
                                if c == -30785 {
                                    is_need_reopen = true;
                                } else {
                                    error!("LMDB:fail crate transaction, err={}", e);
                                    return Vec::default();
                                }
                            }
                            _ => {
                                error!("LMDB:fail crate transaction, err={}", e);
                            }
                        },
                    },
                    Err(e) => {
                        error!("LMDB:db handle, err={}", e);
                        return Vec::default();
                    }
                },
                Err(e) => match e {
                    MdbError::Panic => {
                        is_need_reopen = true;
                    }
                    _ => {
                        error!("LMDB:db environment, err={}", e);
                        return Vec::default();
                    }
                },
            }

            if is_need_reopen {
                warn!("db {} reopen", self.db_path);

                self.open(storage.clone(), self.mode.clone());
            }
        }

        Vec::default()
    }
}

fn remove_from_lmdb(db_env: &Result<Environment, MdbError>, db_handle: &Result<DbHandle, MdbError>, key: &str) -> bool {
    match db_env {
        Ok(env) => match env.new_transaction() {
            Ok(txn) => match db_handle {
                Ok(handle) => {
                    let db = txn.bind(&handle);
                    if let Err(e) = db.del(&key) {
                        error!("LMDB:failed put, err={}", e);
                        return false;
                    }

                    if let Err(e) = txn.commit() {
                        if let MdbError::Other(c, _) = e {
                            if c == -30792 && grow_db(db_env) {
                                return remove_from_lmdb(db_env, db_handle, key);
                            }
                        }
                        error!("LMDB:failed to commit, err={}", e);
                        return false;
                    }
                    true
                }
                Err(e) => {
                    error!("LMDB:db handle, err={}", e);
                    false
                }
            },
            Err(e) => {
                error!("LMDB:db create transaction, err={}", e);
                false
            }
        },
        Err(e) => {
            error!("LMDB:db environment, err={}", e);
            false
        }
    }
}

fn put_kv_lmdb(db_env: &Result<Environment, MdbError>, db_handle: &Result<DbHandle, MdbError>, key: &str, val: &[u8]) -> bool {
    match db_env {
        Ok(env) => match env.new_transaction() {
            Ok(txn) => match db_handle {
                Ok(handle) => {
                    let db = txn.bind(&handle);
                    if let Err(e) = db.set(&key, &val) {
                        error!("LMDB:failed put, err={}", e);
                        return false;
                    }

                    if let Err(e) = txn.commit() {
                        if let MdbError::Other(c, _) = e {
                            if c == -30792 && grow_db(db_env) {
                                return put_kv_lmdb(db_env, db_handle, key, val);
                            }
                        }
                        error!("LMDB:failed to commit, err={}", e);
                        return false;
                    }
                    true
                }
                Err(e) => {
                    error!("LMDB:db handle, err={}", e);
                    false
                }
            },
            Err(e) => {
                error!("LMDB:db create transaction, err={}", e);
                false
            }
        },
        Err(e) => {
            error!("LMDB:db environment, err={}", e);
            false
        }
    }
}

fn grow_db(db_env: &Result<Environment, MdbError>) -> bool {
    match db_env {
        Ok(env) => {
            if let Ok(stat) = env.info() {
                let new_size = stat.me_mapsize + 100 * 10_048_576;
                if env.set_mapsize(new_size).is_ok() {
                    info!("success grow db, new size = {}", new_size);
                    return true;
                }
            }
        }
        Err(e) => {
            error!("LMDB:db environment, err={}", e);
        }
    }
    false
}
