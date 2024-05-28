/*
 This code is a SPARQL data indexer.
 It listens to a queue, retrieves individual data entries, converts them to the Turtle format, and then indexes them into a SPARQL storage system.
 The indexer has a mode activated with the --read-ids-only command-line argument.
 When this mode is enabled, the indexer reads only from the "ids" queue, focusing on processing individual IDs.
 Otherwise, it reads from the "individuals-flow" queue, processing complete individual data entries.
*/
#[macro_use]
extern crate version;

#[macro_use]
extern crate log;

use crate::common::{is_exportable, load_map_of_types, update_prefix};
use crate::update::update_individual_states;
use anyhow::Result;
use reqwest::StatusCode;
use std::collections::HashMap;
use std::env;
use tokio::runtime::Runtime;
use v_common::module::common::load_onto;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_info_of_module, get_inner_binobj_as_individual, init_log, wait_load_ontology, wait_module, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::{Individual, RawObj};
use v_common::onto::individual2turtle::to_turtle_with_counter_refs;
use v_common::onto::onto_impl::Onto;
use v_common::onto::onto_index::OntoIndex;
use v_common::storage::common::StorageMode;
use v_common::v_api::obj::ResultCode;
use v_common::v_queue::consumer::Consumer;
use git_version::git_version;

mod common;
mod update;

// Define the context structure for the application
pub struct Context {
    rt: Runtime,
    pub client: reqwest::Client,
    pub module_info: ModuleInfo,
    pub store_point: String,
    pub update_point: String,
    pub prefixes: HashMap<String, String>,
    pub stored: u64,
    pub skipped: u64,
    pub read_from_ids: bool,
    pub queue_ids_map_types: HashMap<u16, String>,
    pub onto: Onto,
}

// Main function
fn main() -> Result<()> {
    let module_name = "SPARQL_INDEXER";
    // Initialize logging
    init_log(module_name);
    info!("{} {} {}", module_name, version!(), git_version!());

    // Check if the "input-onto" module is loaded
    if get_info_of_module("input-onto").unwrap_or((0, 0)).0 == 0 {
        wait_module("input-onto", wait_load_ontology());
    }

    // Collect command line arguments
    let args: Vec<String> = env::args().collect();
    let read_ids_only = args.contains(&"--read-ids-only".to_string());

    // Initialize module and backend
    let mut module = Module::default();
    let mut backend = Backend::create(StorageMode::ReadOnly, false);

    // Initialize module information
    let module_info = ModuleInfo::new("./data", "sparql_indexer", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", module_info.err());
        return Ok(());
    }

    // Load ontology index and initialize prefixes
    let onto_index = OntoIndex::load();

    // Initialize the application context
    let mut ctx = Context {
        rt: Runtime::new().unwrap(),
        store_point: format!("{}/{}?{}", Module::get_property::<String>("sparql_db").unwrap_or_default(), "store", "default"),
        update_point: format!("{}/{}", Module::get_property::<String>("sparql_db").unwrap_or_default(), "update"),
        client: reqwest::Client::new(),
        module_info: module_info.unwrap(),
        prefixes: HashMap::new(),
        stored: 0,
        skipped: 0,
        read_from_ids: read_ids_only,
        queue_ids_map_types: Default::default(),
        onto: Onto::default(),
    };
    load_onto(&mut backend.storage, &mut ctx.onto);

    for id in onto_index.data.keys() {
        let mut rindv: Individual = Individual::default();
        if backend.storage.get_individual(id, &mut rindv) == ResultCode::Ok {
            rindv.parse_all();

            update_prefix(&mut ctx, &mut rindv);
        } else {
            error!("failed to read individual {}", id);
        }
    }

    // Set up the queue consumer
    let (queue_path, queue_name) = if read_ids_only {
        ("./data/ids", "ids")
    } else {
        ("./data/queue", "individuals-flow")
    };

    let mut queue_consumer = Consumer::new(queue_path, "sparql-indexer", queue_name).expect(&format!("!!!!!!!!! FAIL OPEN QUEUE {}", queue_path));
    info!("open queue {}/{}, part:{}, pos:{}", queue_path, queue_name, queue_consumer.id, queue_consumer.count_popped);

    // Listen to the queue and process messages
    module.max_batch_size = Some(10000);
    if read_ids_only {
        ctx.queue_ids_map_types = load_map_of_types("./data/ids").unwrap_or_default();

        module.listen_queue_raw(
            &mut queue_consumer,
            &mut ctx,
            &mut (before_batch as fn(&mut Backend, &mut Context, batch_size: u32) -> Option<u32>),
            &mut (prepare_element_id as fn(&mut Backend, &mut Context, &RawObj, my_consumer: &Consumer) -> Result<bool, PrepareError>),
            &mut (after_batch as fn(&mut Backend, &mut Context, prepared_batch_size: u32) -> Result<bool, PrepareError>),
            &mut (heartbeat as fn(&mut Backend, &mut Context) -> Result<(), PrepareError>),
            &mut backend,
        );
    } else {
        module.listen_queue(
            &mut queue_consumer,
            &mut ctx,
            &mut (before_batch as fn(&mut Backend, &mut Context, batch_size: u32) -> Option<u32>),
            &mut (prepare_element_indv as fn(&mut Backend, &mut Context, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
            &mut (after_batch as fn(&mut Backend, &mut Context, prepared_batch_size: u32) -> Result<bool, PrepareError>),
            &mut (heartbeat as fn(&mut Backend, &mut Context) -> Result<(), PrepareError>),
            &mut backend,
        );
    }
    Ok(())
}

// Heartbeat function to keep the application alive
fn heartbeat(_module: &mut Backend, _ctx: &mut Context) -> Result<(), PrepareError> {
    Ok(())
}

// Function to be called before processing a batch
fn before_batch(_module: &mut Backend, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

// Function to be called after processing a batch
fn after_batch(_module: &mut Backend, ctx: &mut Context, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
    info!("stored:{}, skipped: {}", ctx.stored, ctx.skipped);
    Ok(false)
}

// Function to prepare and process an element by its ID
fn prepare_element_id(backend: &mut Backend, ctx: &mut Context, queue_element: &RawObj, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let binding = String::from_utf8_lossy(queue_element.data.as_slice());
    let (id, num_indv_types_str) = binding.split_once(',').ok_or_else(|| {
        error!("Failed to extract ID: {}", binding);
        PrepareError::Recoverable
    })?;

    let mut indv = Individual::default();

    // Split the string with numbers into a vector of strings
    let num_indv_types: Vec<&str> = num_indv_types_str.split(',').collect();

    // Convert each string into a number and then look up the corresponding type
    let indv_types_vec: Vec<String> =
        num_indv_types.iter().filter_map(|&num_str| u16::from_str_radix(num_str.trim(), 16).ok().and_then(|n: u16| ctx.queue_ids_map_types.get(&n).cloned())).collect();

    let mut indv_types = if indv_types_vec.is_empty() {
        None
    } else {
        Some(indv_types_vec)
    };

    //info!("num_indv_types_str={}, indv_types={:?}", num_indv_types_str, indv_types);

    if indv_types.is_some() && !is_exportable(indv_types.clone(), ctx) {
        ctx.skipped += 1;
        return Ok(true);
    }

    let res = backend.storage.get_individual(id, &mut indv);
    if res == ResultCode::Ok {
        indv.parse_all();

        if indv_types.is_none() {
            indv_types = indv.get_literals("rdf:type");
            if indv_types.is_some() && !is_exportable(indv_types, ctx) {
                return Ok(true);
            }
        }

        insert_individual_states(&mut indv, ctx)?;
    } else if res == ResultCode::NotReady {
        error!("failed to read individual {}", id);
        return Ok(false);
    }

    Ok(true)
}

// Function to prepare and process an individual element
fn prepare_element_indv(backend: &mut Backend, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("skip queue message: cmd is none");
        return Ok(true);
    }

    let mut new_state = Individual::default();
    if get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state) {
        new_state.parse_all();
    }

    if !is_exportable(new_state.get_literals("rdf:type"), ctx) {
        ctx.skipped += 1;
        return Ok(true);
    }

    if update_prefix(ctx, &mut new_state) {
        load_onto(&mut backend.storage, &mut ctx.onto);
    }

    let mut prev_state = Individual::default();
    if get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state) {
        prev_state.parse_all();
        update_individual_states(&mut prev_state, &mut new_state, ctx)?;
    } else {
        insert_individual_states(&mut new_state, ctx)?;
    }

    Ok(true)
}

fn insert_individual_states(indv: &mut Individual, ctx: &mut Context) -> Result<bool, PrepareError> {
    let id = indv.get_id().to_owned();
    if let Ok(tt) = to_turtle_with_counter_refs(&[indv], &ctx.prefixes) {
        //info!("{}", String::from_utf8_lossy(&tt));

        let url = &ctx.store_point;

        if let Ok(res) = ctx.rt.block_on(ctx.client.post(url).body(tt).header("Content-Type", "text/turtle").send()) {
            if res.status() == StatusCode::CREATED || res.status() == StatusCode::NO_CONTENT {
                info!("insert: {}", indv.get_id());
                ctx.stored += 1;
            } else {
                ctx.skipped += 1;
                let sp = id.find(':').unwrap_or(0);
                if sp > 0 && sp < 5 && !id.contains("//") {
                    error!("Result: {}, {}", res.status(), String::from_utf8_lossy(&to_turtle_with_counter_refs(&[indv], &ctx.prefixes).unwrap()));
                    return Err(PrepareError::Recoverable);
                }
            }
        } else {
            ctx.skipped += 1;
            error!("fail send req to {}", url);
            return Err(PrepareError::Fatal);
        }
    }

    Ok(true)
}
