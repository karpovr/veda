#[macro_use]
extern crate log;

use chrono::{TimeZone, Utc};
use scan_fmt::scan_fmt;
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::process::exit;
use std::{env, io};
use url::Url;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_inner_binobj_as_individual, init_log, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::Individual;
use v_common::onto::individual2msgpack::to_msgpack;
use v_common::storage::common::{StorageId, StorageMode, VStorage};
use v_common::v_api::api_client::IndvOp;
use v_common::v_api::obj::ResultCode;
use v_common::v_queue::consumer::Consumer;

#[derive(Debug, PartialEq, Clone)]
enum CheckCmd {
    Compare,
    IsExist,
}

#[derive(Debug, PartialEq)]
enum UpdateCmd {
    IfCheckErr,
    Definitely,
    ComparePrevState,
}

pub struct Context {
    storage: VStorage,
    module_info: ModuleInfo,
    check_cmd: Option<CheckCmd>,
    check_err_id: HashSet<String>,
    update_cmd: Option<UpdateCmd>,
    exclude_list: HashMap<i64, String>,
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

    let mut db_connection_url = String::new();
    let mut check_cmd = None;
    let mut update_cmd = None;

    let args: Vec<String> = env::args().collect();
    for el in &args {
        if el.starts_with("--dest-db-connection") {
            db_connection_url = el.split('=').collect::<Vec<&str>>()[1].to_owned().trim().to_owned();
        }
        if el.starts_with("--update") {
            update_cmd = match el.split('=').collect::<Vec<&str>>()[1].to_owned().trim() {
                "if-check-err" => Some(UpdateCmd::IfCheckErr),
                "compare-prev-state" => Some(UpdateCmd::ComparePrevState),
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
        storage: get_storage_with_url(&db_connection_url, storage_mode),
        module_info: module_info.unwrap(),
        check_cmd,
        check_err_id: std::collections::HashSet::default(),
        update_cmd,
        exclude_list: load_exclude_list().expect("fail load exclude list"),
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

fn prepare(_module: &mut Backend, ctx: &mut Context, queue_element: &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError> {
    if let Some(assigned_subsystems) = queue_element.get_first_integer("assigned_subsystems") {
        if assigned_subsystems != 0 {
            warn!("skip queue message: assigned_subsystems != 0");
            return Ok(true);
        }
    }

    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("skip queue message: cmd is none");
        return Ok(true);
    }
    let cmd = cmd.unwrap();

    let id = queue_element.get_first_literal("uri").unwrap_or_default();
    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();
    let date = queue_element.get_first_datetime("date").unwrap_or_default();

    let mut queue_indv_new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut queue_indv_new_state);
    queue_indv_new_state.parse_all();

    let check_result = if cmd != IndvOp::Remove {
        check(op_id, &id, &mut queue_indv_new_state, &ctx.check_cmd.clone(), ctx)
    } else {
        None
    };

    if check_result.is_some() && !check_result.unwrap() && !ctx.check_err_id.contains(&id) && queue_indv_new_state.is_exists("rdf:type") {
        info!("{}/{}, ADD TO LIST: {}", my_consumer.id, op_id, id);
        ctx.check_err_id.insert(id.clone());
        to_report(&ctx.check_err_id).expect("fail write report file");
    }

    if cmd == IndvOp::Remove && ctx.check_err_id.contains(&id) {
        info!("{}/{}, REMOVE FROM LIST: {}", my_consumer.id, op_id, id);
        ctx.check_err_id.remove(&id);
        to_report(&ctx.check_err_id).expect("fail write report file");
    }

    if let Some(update_cmd) = &ctx.update_cmd {
        if *update_cmd == UpdateCmd::Definitely
            || *update_cmd == UpdateCmd::ComparePrevState
            || *update_cmd == UpdateCmd::IfCheckErr && check_result.is_some() && !check_result.unwrap()
            || *update_cmd == UpdateCmd::IfCheckErr && ctx.check_err_id.contains(&id)
        {
            let exclude = if let Some(v) = ctx.exclude_list.get(&op_id) {
                if *v == id {
                    true
                } else {
                    false
                }
            } else {
                false
            };

            if exclude {
                warn!("exclude {op_id} {id}");
            }

            if *update_cmd == UpdateCmd::ComparePrevState && cmd != IndvOp::Remove && !exclude {
                let mut queue_indv_prev_state = Individual::default();
                get_inner_binobj_as_individual(queue_element, "prev_state", &mut queue_indv_prev_state);
                queue_indv_prev_state.parse_all();

                if !queue_indv_prev_state.is_empty() {
                    if let Some(res) = check(op_id, &id, &mut queue_indv_prev_state, &Some(CheckCmd::Compare), ctx) {
                        if !res {
                            error!("prev state no equal, id = {id}, cmd={:?}, op_id={op_id}, new_state={}", cmd, queue_indv_new_state.get_obj().as_json_str());
                            return Err(PrepareError::Fatal);
                        }
                    }
                } else {
                    warn!("prev-state is empty {op_id} {id}");
                }
            }

            if cmd == IndvOp::Remove {
                if ctx.storage.remove(StorageId::Individuals, &id) {
                    info!("{}, {} id={}", op_id, cmd.as_string(), id);
                } else {
                    error!("failed to remove individual, id = {id}, op_id={op_id}");
                    return Err(PrepareError::Fatal);
                }
            } else {
                let mut raw1: Vec<u8> = Vec::new();
                if let Err(e) = to_msgpack(&queue_indv_new_state, &mut raw1) {
                    error!("failed to update individual, id = {}, error={:?}", queue_indv_new_state.get_id(), e);
                    return Err(PrepareError::Fatal);
                }

                let new_counter = queue_indv_new_state.get_first_integer("v-s:updateCounter").unwrap_or(-1);

                if ctx.storage.put_kv_raw(StorageId::Individuals, queue_indv_new_state.get_id(), raw1) {
                    info!("op_id={op_id}, {} id={}, counter={new_counter}, date={}", cmd.as_string(), queue_indv_new_state.get_id(), &Utc.timestamp(date, 0));
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

fn get_storage_with_url(db_connection_url: &str, storage_mode: StorageMode) -> VStorage {
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
                VStorage::new_tt(format!("{host}:{port}"), user, pass)
            }
        },
        Err(e) => {
            let et = format!("fail parse {db_connection_url}, err={e}");
            error!("{et}");
            panic!("{et}");
        },
    }
}

fn check(op_id: i64, id: &str, queue_indv: &mut Individual, check_cmd: &Option<CheckCmd>, ctx: &mut Context) -> Option<bool> {
    if let Some(check_cmd) = &check_cmd {
        let mut storage_indv = Individual::default();

        let exist = ctx.storage.get_individual(id, &mut storage_indv) == ResultCode::Ok;

        if *check_cmd == CheckCmd::IsExist && !exist {
            //error!("NOT FOUND, {}", id);
            return Some(false);
        }

        if *check_cmd == CheckCmd::Compare {
            storage_indv.parse_all();

            if storage_indv.compare(queue_indv, vec![]) {
                info!("EQUALS, {}, id={}", op_id, id);
            } else {
                error!("DIFFERENT, {}, id={}", op_id, id);

                error!("FROM STORAGE = {}", storage_indv.get_obj().as_json_str());
                error!("FROM QUEUE = {}", queue_indv.get_obj().as_json_str());
                return Some(false);
            }
        }
        Some(true)
    } else {
        None
    }
}

fn to_report(list: &HashSet<String>) -> Result<(), Box<dyn Error>> {
    let mut wtr = csv::Writer::from_path("./check-report.csv")?;

    for el in list {
        wtr.write_record([el])?;
    }
    wtr.flush()?;
    Ok(())
}

fn load_exclude_list() -> io::Result<HashMap<i64, String>> {
    let mut out_data = HashMap::new();
    let fname = "./queue2storage-exclude-list.txt";
    if let Ok(mut ff) = OpenOptions::new().read(true).open(fname) {
        ff.seek(SeekFrom::Start(0))?;

        for line in BufReader::new(ff).lines().flatten() {
            if let (Some(op_id), Some(individual_id)) = scan_fmt!(&line, "{},\"{}\"", i64, String) {
                info!("EXCLUDE: {op_id} {individual_id}");
                out_data.insert(op_id, individual_id);
            } else {
                error!("fail parse {}, line={}", fname, line);
            }
        }
    } else {
        warn!("not load {}", fname);
    }
    Ok(out_data)
}
