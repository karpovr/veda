/*
 This code is a SPARQL data indexer.
 It listens to a queue, retrieves individual data entries, converts them to the Turtle format, and then indexes them into a SPARQL storage system.
 The indexer has a mode activated with the --read-ids-only command-line argument.
 When this mode is enabled, the indexer reads only from the "ids" queue, focusing on processing individual IDs.
 Otherwise, it reads from the "individuals-flow" queue, processing complete individual data entries.
*/

#[macro_use]
extern crate log;

use anyhow::Result;
use reqwest::StatusCode;
use std::collections::HashMap;
use std::env;
use tokio::runtime::Runtime;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_info_of_module, get_inner_binobj_as_individual, init_log, wait_load_ontology, wait_module, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::{Individual, RawObj};
use v_common::onto::individual2turtle::to_turtle_refs;
use v_common::onto::onto_index::OntoIndex;
use v_common::storage::common::StorageMode;
use v_common::v_queue::consumer::Consumer;

// Define the context structure for the application
pub struct Context {
    rt: Runtime,
    pub client: reqwest::Client,
    pub module_info: ModuleInfo,
    pub store_point: String,
    pub prefixes: HashMap<String, String>,
    pub stored: u64,
    pub skipped: u64,
    pub read_ids_only: bool,
}

// Main function
fn main() -> Result<()> {
    // Initialize logging
    init_log("SPARQL_INDEXER");

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
        store_point: format!("{}/{}?{}", Module::get_property("sparql_db").unwrap_or_default(), "store", "default"),
        client: reqwest::Client::new(),
        module_info: module_info.unwrap(),
        prefixes: HashMap::new(),
        stored: 0,
        skipped: 0,
        read_ids_only,
    };

    for id in onto_index.data.keys() {
        let mut rindv: Individual = Individual::default();
        if backend.storage.get_individual(id, &mut rindv) {
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

    info!("open queue {}/{}", queue_path, queue_name);

    // Listen to the queue and process messages
    module.max_batch_size = Some(10000);
    if read_ids_only {
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

fn update_prefix(ctx: &mut Context, rindv: &mut Individual) {
    if rindv.any_exists("rdf:type", &["owl:Ontology"]) {
        if let Some(full_url) = rindv.get_first_literal("v-s:fullUrl") {
            debug!("prefix : {} -> {}", rindv.get_id(), full_url);
            let short_prefix = rindv.get_id().trim_end_matches(':');
            ctx.prefixes.insert(short_prefix.to_owned(), full_url);
        }
    }
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
    let (id, _type) = binding.split_once(',').ok_or_else(|| {
        error!("Failed to extract ID: {}", binding);
        PrepareError::Recoverable
    })?;

    let mut indv = Individual::default();
    if backend.storage.get_individual(&id, &mut indv) {
        indv.parse_all();
        update(&mut indv, ctx)?;
    } else {
        error!("failed to read individual {}", id);
    }

    Ok(true)
}

// Function to prepare and process an individual element
fn prepare_element_indv(_backend: &mut Backend, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("skip queue message: cmd is none");
        return Ok(true);
    }

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);
    new_state.parse_all();

    update(&mut new_state, ctx)?;

    Ok(true)
}

// Function to update the state of an individual
fn update(new_state: &mut Individual, ctx: &mut Context) -> Result<bool, PrepareError> {
    update_prefix(ctx, new_state);

    let id = new_state.get_id().to_owned();
    if let Ok(tt) = to_turtle_refs(&[new_state], &ctx.prefixes) {
        //info!("{}", String::from_utf8_lossy(&tt));

        let url = &ctx.store_point;

        if let Ok(res) = ctx.rt.block_on(ctx.client.post(url).body(tt).header("Content-Type", "text/turtle").send()) {
            if res.status() == StatusCode::CREATED || res.status() == StatusCode::NO_CONTENT {
                ctx.stored += 1;
            } else {
                ctx.skipped += 1;
                let sp = id.find(':').unwrap_or(0);
                if sp > 0 && sp < 5 && !id.contains("//") {
                    error!("Result: {}, {}", res.status(), String::from_utf8_lossy(&to_turtle_refs(&[new_state], &ctx.prefixes).unwrap()));
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
