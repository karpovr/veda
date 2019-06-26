use crate::lmdb_storage::LMDBStorage;
use crate::tt_storage::TTStorage;
use v_onto::individual::*;

pub enum StorageError {
    None,
    NotReady,
}

pub enum EStorage {
    LMDB(LMDBStorage),
    TT(TTStorage),
}

pub trait Storage {
    fn set_binobj(&mut self, uri: &str, raw: &mut RawObj, indv: &mut Individual) -> bool;
}

pub struct VStorage {
    storage: EStorage,
}

impl VStorage {
    pub fn new_tt(tt_uri: String, login: &str, pass: &str) -> VStorage {
        VStorage {
            storage: EStorage::TT(TTStorage::new(tt_uri, login, pass)),
        }
    }

    pub fn new_lmdb(db_path: &str) -> VStorage {
        VStorage {
            storage: EStorage::LMDB(LMDBStorage::new(db_path)),
        }
    }

    pub fn set_binobj(&mut self, uri: &str, raw: &mut RawObj, indv: &mut Individual) -> bool {
        match &mut self.storage {
            EStorage::TT(s) => s.set_binobj(uri, raw, indv),
            EStorage::LMDB(s) => s.set_binobj(uri, raw, indv),
        }
    }
}
