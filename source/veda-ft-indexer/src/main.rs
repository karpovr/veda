#[macro_use]
extern crate log;

use std::fs::{File, OpenOptions};

mod index_workplace;
mod indexer;

use crate::indexer::{Indexer, BATCH_SIZE_OF_TRANSACTION};
use std::io::{BufRead, BufReader, Write};
use std::process;
use std::time::Instant;
use v_common::ft_xapian::init_db_path;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::common::load_onto;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_info_of_module, get_inner_binobj_as_individual, init_log, wait_load_ontology, wait_module, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::Individual;
use v_common::onto::onto_impl::Onto;
use v_common::storage::common::StorageMode;
use v_common::v_api::api_client::IndvOp;
use v_common::v_queue::consumer::Consumer;
use xapian_rusty::*;

const BASE_PATH: &str = "./data";
const FAILED_LIST_FILE_NAME: &str = "ft-indexer-failed-ids-list.dat";
const TIMEOUT_BETWEEN_COMMITS: u128 = 100;
const MODULE_NAME: &str = "FT_INDEXER";
const MODULE_ID: i64 = 4;

fn main() -> Result<(), XError> {
    init_log(MODULE_NAME);
    let mut batch_size = 0;
    loop {
        let mut backend = Backend::create(StorageMode::ReadOnly, false);
        let mut module = Module::create(Some(MODULE_ID), MODULE_NAME);
        if batch_size == 0 {
            batch_size = module.max_batch_size.unwrap_or_default();
        }
        if batch_size == 0 {
            batch_size = BATCH_SIZE_OF_TRANSACTION as u32;
        }
        info!("batch size = {}", batch_size);

        module.max_batch_size = Some(batch_size);
        if let Err(e) = index(&mut backend, &mut module) {
            error!("failed to index batch, err = {:?}", e);
        }

        batch_size /= 2;

        if batch_size < 1 {
            break;
        }
    }
    Ok(())
}

fn index(backend: &mut Backend, module: &mut Module) -> Result<(), XError> {
    if get_info_of_module("input-onto").unwrap_or((0, 0)).0 == 0 {
        wait_module("input-onto", wait_load_ontology());
    }

    let mut queue_consumer = Consumer::new(&format!("./{}/queue", BASE_PATH), "fulltext_indexer0", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
    let module_info = ModuleInfo::new(BASE_PATH, "fulltext_indexer", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", module_info.err());
        process::exit(101);
    }
    let mut onto = Onto::default();
    load_onto(&mut backend.storage, &mut onto);

    if let Some(xr) = XapianReader::new("russian", &mut backend.storage) {
        let mut ctx = Indexer {
            onto,
            index_dbs: Default::default(),
            tg: TermGenerator::new()?,
            lang: "russian".to_string(),
            key2slot: Default::default(),
            db2path: init_db_path(),
            idx_schema: Default::default(),
            use_db: "".to_string(),
            committed_op_id: 0,
            prepared_op_id: 0,
            committed_time: Instant::now(),
            xr,
            module_info: module_info.unwrap(),
            last_indexed_id: "".to_string(),
            failed_ids: Default::default(),
        };

        info!("started listening to queue");

        if let Err(e) = ctx.init("") {
            match e {
                XError::Xapian(c) => {
                    error!("failed to init index base, err = {}", get_xapian_err_type(c));
                },
                _ => {
                    error!("failed to init index base, err = {:?}", e);
                },
            }
            return Err(e);
        }

        if let Ok(file) = File::open(format!("{}/{}", BASE_PATH, FAILED_LIST_FILE_NAME)) {
            warn!("use {}", FAILED_LIST_FILE_NAME);
            let reader = BufReader::new(file);

            for (_index, line) in reader.lines().enumerate() {
                if let Ok(line) = line {
                    if !line.is_empty() {
                        ctx.failed_ids.insert(line);
                    }
                }
            }
        }

        module.listen_queue(
            &mut queue_consumer,
            &mut ctx,
            &mut (before as fn(&mut Backend, &mut Indexer, u32) -> Option<u32>),
            &mut (process as fn(&mut Backend, &mut Indexer, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
            &mut (after as fn(&mut Backend, &mut Indexer, u32) -> Result<bool, PrepareError>),
            &mut (heartbeat as fn(&mut Backend, &mut Indexer) -> Result<(), PrepareError>),
            backend,
        );
    } else {
        error!("failed to init ft-query");
    }

    info!("stopped listening to queue");
    Ok(())
}

fn heartbeat(_module: &mut Backend, ctx: &mut Indexer) -> Result<(), PrepareError> {
    if ctx.committed_time.elapsed().as_millis() > TIMEOUT_BETWEEN_COMMITS {
        if let Err(e) = ctx.commit_all_db() {
            error!("failed to commit, err = {:?}", e);
            return Err(PrepareError::Fatal);
        }
    }
    Ok(())
}

fn before(_module: &mut Backend, _ctx: &mut Indexer, _batch_size: u32) -> Option<u32> {
    None
}

fn after(_module: &mut Backend, ctx: &mut Indexer, processed_batch_size: u32) -> Result<bool, PrepareError> {
    if let Err(e) = ctx.commit_all_db() {
        error!("failed to commit, err = {:?}", e);

        if processed_batch_size == 1 && !ctx.last_indexed_id.is_empty() {
            if let Ok(mut f) = OpenOptions::new().write(true).append(true).create(true).open(format!("{}/{}", BASE_PATH, FAILED_LIST_FILE_NAME)) {
                if let Err(e) = writeln!(f, "{}", ctx.last_indexed_id) {
                    error!("failed to write, err = {:?}", e);
                }
            } else {
                error!("failed to open file {}", format!("{}/{}", BASE_PATH, FAILED_LIST_FILE_NAME));
            }
        }

        return Err(PrepareError::Fatal);
    }
    Ok(true)
}

fn process(backend: &mut Backend, ctx: &mut Indexer, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("skip queue message: cmd is none");
        return Ok(true);
    }

    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();

    let mut prev_state = Individual::default();
    if cmd != Some(IndvOp::Remove) {
        get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);
    }

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    if !ctx.failed_ids.is_empty() && ctx.failed_ids.contains(new_state.get_id()) {
        warn!("individual is found in failed list, skip: {}", new_state.get_id());
        return Ok(false);
    }

    if let Err(e) = ctx.index_msg(&mut new_state, &mut prev_state, cmd.unwrap(), op_id, backend) {
        error!("failed to index individual, err = {:?}", e);
    }

    ctx.last_indexed_id = new_state.get_id().to_owned();

    Ok(false)
}
