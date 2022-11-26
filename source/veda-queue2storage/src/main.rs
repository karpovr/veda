#[macro_use]
extern crate log;

use std::collections::HashSet;
use std::env;
use std::error::Error;
use std::process::exit;
use url::Url;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_inner_binobj_as_individual, init_log, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::Individual;
use v_common::onto::individual2msgpack::to_msgpack;
use v_common::storage::common::{StorageId, StorageMode, VStorage};
use v_common::v_api::api_client::IndvOp;
use v_common::v_queue::consumer::Consumer;

#[derive(Debug, PartialEq)]
enum CheckCmd {
    Compare,
    IsExist,
}

#[derive(Debug, PartialEq)]
enum UpdateCmd {
    IfCheckErr,
    Definitely,
}

pub struct Context {
    storage: VStorage,
    module_info: ModuleInfo,
    check_cmd: Option<CheckCmd>,
    check_err_id: HashSet<String>,
    update_cmd: Option<UpdateCmd>,
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

    let mut db_connection_url = "file://data/db_copy1".to_owned();
    let mut check_cmd = None;
    let mut update_cmd = None;

    let args: Vec<String> = env::args().collect();
    for el in args.iter() {
        if el.starts_with("--db-connection") {
            db_connection_url = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned();
        }
        if el.starts_with("--update") {
            update_cmd = match el.split('=').collect::<Vec<&str>>()[1].to_owned().trim() {
                "if-check-err" => Some(UpdateCmd::IfCheckErr),
                _ => Some(UpdateCmd::Definitely),
            }
        }
        if el.starts_with("--check") {
            check_cmd = match el.split('=').collect::<Vec<&str>>()[1].to_owned().trim() {
                "compare" => Some(CheckCmd::Compare),
                "is-exist" => Some(CheckCmd::IsExist),
                _ => None,
            }
        }
    }

    if update_cmd.is_none() && check_cmd.is_none() {
        info!("use args --update or/and --check");
        exit(0);
    }

    let storage_mode = if update_cmd.is_some() {
        StorageMode::ReadWrite
    } else {
        StorageMode::ReadOnly
    };

    info!("storage mode: {:?}", storage_mode);
    info!("CHECK {:?}", check_cmd);
    info!("UPDATE {:?}", update_cmd);

    let mut ctx = Context {
        storage: get_storage_use_url(&db_connection_url, storage_mode),
        module_info: module_info.unwrap(),
        check_cmd,
        check_err_id: Default::default(),
        update_cmd,
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

    let mut queue_indv_new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut queue_indv_new_state);
    queue_indv_new_state.parse_all();

    let check_result = if cmd != IndvOp::Remove {
        check(op_id, &id, &mut queue_indv_new_state, ctx)
    } else {
        None
    };

    if check_result.is_some() && !check_result.unwrap() && !ctx.check_err_id.contains(&id) {
        info!("ADD TO LIST: {}", id);
        ctx.check_err_id.insert(id.to_owned());
        to_report(&ctx.check_err_id).expect("fail write report file");
    }

    if cmd == IndvOp::Remove {
        info!("REMOVE FROM LIST: {}", id);
        ctx.check_err_id.remove(&id);
        to_report(&ctx.check_err_id).expect("fail write report file");
    }

    if let Some(update_cmd) = &ctx.update_cmd {
        if *update_cmd == UpdateCmd::Definitely
            || *update_cmd == UpdateCmd::IfCheckErr && check_result.is_some() && !check_result.unwrap()
            || *update_cmd == UpdateCmd::IfCheckErr && ctx.check_err_id.contains(&id)
        {
            if cmd == IndvOp::Remove {
                if ctx.storage.remove(StorageId::Individuals, &id) {
                    info!("{}, {} id={}", op_id, cmd.as_string(), id);
                } else {
                    error!("failed to remove individual, id = {}", id);
                    return Err(PrepareError::Fatal);
                }
            } else {
                let mut raw1: Vec<u8> = Vec::new();
                if let Err(e) = to_msgpack(&queue_indv_new_state, &mut raw1) {
                    error!("failed to update individual, id = {}, error={:?}", queue_indv_new_state.get_id(), e);
                    return Err(PrepareError::Fatal);
                }

                if ctx.storage.put_kv_raw(StorageId::Individuals, queue_indv_new_state.get_id(), raw1) {
                    info!("{}, {} id={}", op_id, cmd.as_string(), queue_indv_new_state.get_id());
                } else {
                    error!("failed to update individual, id = {}", queue_indv_new_state.get_id());
                    return Err(PrepareError::Fatal);
                }
            }
        }
    }

    if let Err(e) = ctx.module_info.put_info(op_id, op_id) {
        error!("failed to write module_info, op_id = {}, err = {:?}", op_id, e);
        return Err(PrepareError::Fatal);
    }

    Ok(true)
}

pub fn get_storage_use_url(db_connection_url: &str, storage_mode: StorageMode) -> VStorage {
    match Url::parse(db_connection_url) {
        Ok(url) => {
            if url.scheme() == "file" {
                let path = url.as_str().strip_prefix("file://").unwrap_or_default();
                info!("lmdb={:?}", path);
                let mut storage = VStorage::new_lmdb(path, storage_mode, None);
                info!("total count: {}", storage.count(StorageId::Individuals));
                storage
            } else {
                let host = url.host_str().unwrap_or("127.0.0.1");
                let port = url.port().unwrap_or(3309);
                let user = url.username();
                let pass = url.password().unwrap_or("123");
                info!("Trying to connect to Tarantool, host: {}, port: {}, user: {}, password: {}", host, port, user, pass);
                VStorage::new_tt(format!("{}:{}", host, port), user, pass)
            }
        },
        Err(e) => {
            panic!("fail parse {}, err={}", db_connection_url, e);
        },
    }
}

fn check(op_id: i64, id: &str, queue_indv_new_state: &mut Individual, ctx: &mut Context) -> Option<bool> {
    if let Some(check_cmd) = &ctx.check_cmd {
        let mut storage_indv = Individual::default();

        let exist = ctx.storage.get_individual(&id, &mut storage_indv);

        if *check_cmd == CheckCmd::IsExist && !exist {
            //error!("NOT FOUND, {}", id);
            return Some(false);
        }

        if *check_cmd == CheckCmd::Compare {
            storage_indv.parse_all();

            if storage_indv.compare(queue_indv_new_state, vec![]) {
                info!("EQUALS, {}, id={}", op_id, id);
            } else {
                error!("DIFFERENT, {}, id={}", op_id, id);

                error!("FROM STORAGE = {:?}", storage_indv);
                error!("FROM QUEUE = {:?}", queue_indv_new_state);
                return Some(false);
            }
        }
        return Some(true);
    } else {
        None
    }
}

fn to_report(list: &HashSet<String>) -> Result<(), Box<dyn Error>> {
    list.
    let mut wtr = csv::Writer::from_path("./check-report.csv")?;

    for el in list {
        wtr.write_record(&[el])?;
    }
    wtr.flush()?;
    Ok(())
}
