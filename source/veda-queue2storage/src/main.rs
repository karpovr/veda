#[macro_use]
extern crate log;

use std::env;
use url::Url;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_inner_binobj_as_individual, init_log, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::Individual;
use v_common::onto::individual2msgpack::to_msgpack;
use v_common::storage::common::{StorageId, StorageMode, VStorage};
use v_common::v_api::api_client::IndvOp;
use v_common::v_queue::consumer::Consumer;

pub struct Context {
    pub storage: VStorage,
    pub module_info: ModuleInfo,
}

fn main() -> Result<(), i32> {
    init_log("QUEUE2STORAGE");

    let mut module = Module::default();
    let mut backend = Backend::create(StorageMode::ReadOnly, false);

    let module_info = ModuleInfo::new("./data", "queue2storage", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", module_info.err());
        return Err(-1);
    }

    let mut ctx = Context {
        storage: get_storage_use_arg(),
        module_info: module_info.unwrap(),
    };

    let mut queue_consumer = Consumer::new("./data/queue", "queue2storage", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");

    module.listen_queue(
        &mut queue_consumer,
        &mut ctx,
        &mut (before_batch as fn(&mut Backend, &mut Context, batch_size: u32) -> Option<u32>),
        &mut (prepare as fn(&mut Backend, &mut Context, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
        &mut (after_batch as fn(&mut Backend, &mut Context, prepared_batch_size: u32) -> Result<bool, PrepareError>),
        &mut (heartbeat as fn(&mut Backend, &mut Context) -> Result<(), PrepareError>),
        &mut backend,
    );
    Ok(())
}

fn heartbeat(_module: &mut Backend, _ctx: &mut Context) -> Result<(), PrepareError> {
    Ok(())
}

fn before_batch(_module: &mut Backend, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Backend, _ctx: &mut Context, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
    Ok(false)
}

fn prepare(_module: &mut Backend, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("skip queue message: cmd is none");
        return Ok(true);
    }
    let cmd = cmd.unwrap();

    let id = queue_element.get_first_literal("uri").unwrap_or_default();
    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();
    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    if cmd == IndvOp::Remove {
        if ctx.storage.remove(StorageId::Individuals, &id) {
            info!("remove individual, id = {}", id);
        } else {
            error!("failed to remove individual, id = {}", id);
            return Err(PrepareError::Fatal);
        }
    } else {
        let mut raw1: Vec<u8> = Vec::new();
        if let Err(e) = to_msgpack(&queue_element, &mut raw1) {
            error!("failed to update individual, id = {}, error={:?}", new_state.get_id(), e);
            return Err(PrepareError::Fatal);
        }

        if ctx.storage.put_kv_raw(StorageId::Individuals, &new_state.get_id(), raw1) {
            info!("{}, {} id={}", op_id, cmd.as_string(), new_state.get_id());
        } else {
            error!("failed to update individual, id = {}", new_state.get_id());
            return Err(PrepareError::Fatal);
        }
    }

    if let Err(e) = ctx.module_info.put_info(op_id, op_id) {
        error!("failed to write module_info, op_id = {}, err = {:?}", op_id, e);
        return Err(PrepareError::Fatal);
    }

    Ok(true)
}

pub fn get_storage_use_arg() -> VStorage {
    let mut db_connection = "file://data/db_copy1".to_owned();
    let args: Vec<String> = env::args().collect();
    for el in args.iter() {
        if el.starts_with("--db_connection") {
            db_connection = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned();
            break;
        }
    }

    match Url::parse(&db_connection) {
        Ok(url) => {
            if url.scheme() == "file" {
                let path = url.as_str().strip_prefix("file://").unwrap_or_default();
                info!("lmdb={:?}", path);
                let mut storage = VStorage::new_lmdb(url.path(), StorageMode::ReadWrite);
                info!("total count: {}", storage.count(StorageId::Individuals));
                storage
            } else {
                let host = url.host_str().unwrap_or("127.0.0.1");
                let port = url.port().unwrap_or(3309);
                let user = url.username();
                let pass = url.password().unwrap_or("123");
                info!("Trying to connect to Tarantool, host: {}, port: {}, user: {}, password: {}", host, port, user, pass);
                return VStorage::new_tt(format!("{}:{}", host, port), user, pass);
            }
        },
        Err(e) => {
            panic!("fail parse {}, err={}", db_connection, e);
        },
    }
}
