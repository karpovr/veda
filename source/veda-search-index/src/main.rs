#[macro_use]
extern crate log;

use clickhouse_rs::{Pool, errors::Error, ClientHandle, Block};
use futures::executor::block_on;
use tokio;

use std::collections::HashMap;
use std::{thread, time, process};
use chrono::NaiveDateTime;

use v_module::info::ModuleInfo;
use v_module::module::*;
use v_module::onto::load_onto;
use v_onto::individual::*;
use v_onto::onto::Onto;
use v_onto::resource::Resource;
use v_onto::resource::Value;
use v_onto::datatype::DataType;
use v_onto::datatype::Lang;
use v_queue::consumer::*;
use v_onto::resource::Value::Int;

pub struct Context {
    onto: Onto,
    pool: Pool,
}

#[tokio::main]
async fn main() ->  Result<(), Error> {
    init_log();

    if get_info_of_module("input-onto").unwrap_or((0, 0)).0 == 0 {
        wait_module("fulltext_indexer", wait_load_ontology());
    }

    let mut queue_consumer = Consumer::new("./data/queue", "search_index", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
    let module_info = ModuleInfo::new("./data", "search_index", true);
    if module_info.is_err() {
        error!("{:?}", module_info.err());
        process::exit(101);
    }
    let mut module = Module::default();

    let mut pool = match connect_to_clickhouse(&mut module) {
        Err(e) => {
            error!("Failed to connect to clickhouse: {}", e);
            process::exit(101)
        },
        Ok(pool) => pool,
    };

    info!("Rusty search-index: init started");

    init_clickhouse(&mut pool).await?;

    info!("Rusty search-index: inited");

    let mut ctx = Context {
        onto: Onto::default(),
        pool,
    };

    load_onto(&mut module.fts, &mut module.storage, &mut ctx.onto);

    info!("Rusty search-index: start listening to queue");

    module.listen_queue(
        &mut queue_consumer,
        &mut module_info.unwrap(),
        &mut ctx,
        &mut (void as fn(&mut Module, &mut Context)),
        &mut (process as fn(&mut Module, &mut ModuleInfo, &mut Context, &mut Individual) -> Result<(), PrepareError>),
        &mut (void as fn(&mut Module, &mut Context)),
    );
    Ok(())
}

fn void(_module: &mut Module, _ctx: &mut Context) {}

fn process(_module: &mut Module, module_info: &mut ModuleInfo, ctx: &mut Context, queue_element: &mut Individual) -> Result<(), PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("Queue element cmd is none. Skip element.");
        return Ok(());
    }

    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();
    if let Err(e) = module_info.put_info(op_id, op_id) {
        error!("Failed to write module_info, op_id={}, err={:?}", op_id, e);
    }

    let mut prev_state = Individual::default();
    let is_new = !get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    return match block_on(export(&mut new_state, &mut prev_state, is_new, &ctx)) {
        Ok(()) => Ok(()),
        Err(e) => {
            error!("Export error: {}", e);
            Err(PrepareError::Recoverable)
        }
    };
}

fn set_column_value(block: Block, predicate: &str, resources: &Vec<Resource>) -> Block {
    let predicate = predicate.replace(":", "__").replace("-", "_");
    match &resources[0].rtype {
        DataType::Integer => {
            let column_value: Vec<i64> = resources.iter().map(|resource| resource.get_int()).collect();
            block.column(&predicate, vec![column_value])
        },
        DataType::String => {
            let column_value: Vec<String> = resources.iter().map(|resource| {
                let str_value = resource.get_str();
                let lang = match resource.get_lang() {
                    Lang::NONE => String::from(""),
                    lang => format!("@{}", lang.to_string()),
                };
                format!("{}{}", str_value.replace("'", "\\'"), lang)
            }).collect();
            block.column(&predicate, vec![column_value])
        },
        DataType::Uri => {
            let column_value: Vec<String> = resources.iter().map(|resource| resource.get_uri().to_string()).collect();
            block.column(&predicate, vec![column_value])
        },
        DataType::Boolean => {
            let column_value: Vec<u8> = resources.iter().map(|resource| {
                match resource.value {
                    Value::Bool(true) => 1,
                    _ => 0
                }
            }).collect();
            block.column(&predicate, vec![column_value])
        },
        DataType::Decimal => {
            let column_value: Vec<f64> = resources.iter().map(|resource| resource.get_float()).collect();
            block.column(&predicate, vec![column_value])
        },
        DataType::Datetime => {
            let column_value: Vec<i64> = resources.iter().map(|resource| resource.get_datetime()).collect();
            block.column(&predicate, vec![column_value])
        },
        _ => {
            error!("Value type is not supported");
            block
        }
    }
}

async fn export(new_state: &mut Individual, prev_state: &mut Individual, is_new: bool, ctx: &Context) -> Result<(), Error> {
    let uri = new_state.get_id().to_owned();
    info!("Export individual: {}", uri);

    let actual_version = new_state.get_first_literal("v-s:actual_version").unwrap_or_default();

    if !actual_version.is_empty() && actual_version != uri {
        info!("Skip not actual version. {}.v-s:actual_version {} != {}", uri, &actual_version, uri);
        return Ok(());
    }

    // Remove previous state from individuals table
    /*if !is_new {
        delete_individual(&uri, ctx).await?
    }*/

    let mut insert_block = Block::new().column("id", vec![uri]);

    for predicate in new_state.get_predicates() {
        if let Some(resources) = new_state.get_resources(&predicate) {
            create_predicate_column(&predicate, &resources[0], &ctx).await?;
            insert_block = set_column_value(insert_block, &predicate, &resources);
        }
    }

    let mut client = ctx.pool.get_handle().await?;

    client.insert("veda.individuals", insert_block).await?;

    info!("Export done: {}", new_state.get_id());

    Ok(())
}

async fn create_predicate_column(predicate: &str, resource: &Resource, ctx: &Context) -> Result<(), Error> {
    if predicate == "rdf:type" || predicate == "v-s:created" {
        return Ok(());
    }
    let mut client = ctx.pool.get_handle().await?;
    let mut column_type= "";
    match &resource.rtype {
        DataType::Boolean => column_type = "UInt8",
        DataType::Datetime => column_type = "DateTime",
        DataType::Decimal => column_type = "Decimal (14,4)",
        DataType::Integer => column_type = "Int64",
        DataType::String => column_type = "String",
        DataType::Uri => column_type = "String",
        _unsupported => error!("Unsupported property value type: {:#?}", _unsupported)
    }
    let query = format!(
        "ALTER TABLE veda.individuals ADD COLUMN IF NOT EXISTS `{}` Array({})",
        predicate.replace(":", "__").replace("-", "_"), column_type
    );
    client.execute(query).await?;
    Ok(())
}

async fn delete_individual(uri: &str, ctx: &Context) -> Result<(), Error> {
    let mut client = ctx.pool.get_handle().await?;
    let query = format!("DELETE FROM veda.individuals WHERE `@` = '{}'", uri);
    client.execute(query).await?;
    Ok(())
}

fn connect_to_clickhouse(module: &mut Module) -> Result<Pool, &'static str> {
    if let Some(node) = module.get_individual("cfg:standart_node", &mut Individual::default()) {
        if let Some(v) = node.get_literals("v-s:push_individual_by_event") {
            for el in v {
                let mut connection = Individual::default();
                if module.storage.get_individual(&el, &mut connection) && !connection.is_exists_bool("v-s:deleted", true) {
                    if let Some(transport) = connection.get_first_literal("v-s:transport") {
                        if transport == "clickhouse" {
                            info!("Found configuration to connect to Clickhouse: {}", connection.get_id());
                            let host = connection.get_first_literal("v-s:host").unwrap_or(String::from("127.0.0.1"));
                            let port = connection.get_first_integer("v-s:port").unwrap_or(9000) as u16;
                            let user = connection.get_first_literal("v-s:login").unwrap_or(String::from("default"));
                            let pass = connection.get_first_literal("v-s:password").unwrap_or(String::from(""));
                            let url = format!("tcp://{}:{}@{}:{}/", user, pass, host, port);
                            info!("Trying to connect to Clickhouse, host: {}, port: {}, user: {}, password: {}", host, port, user, pass);
                            info!("Connection url: {}", url);
                            let pool = Pool::new(url);
                            return Ok(pool);
                        }
                    }
                }
            }
        }
    }
    Err("Configuration to connect to Clickhouse not found")
}

async fn init_clickhouse(pool: &mut Pool) -> Result<(), Error> {
    let init_veda_db = "CREATE DATABASE IF NOT EXISTS veda";
/*
    let init_individuals_table = r"
        CREATE TABLE IF NOT EXISTS veda.individuals (
            id String,
            rdf__type Array(String),
            v_s__created Array(DateTime)
        )
        ENGINE = MergeTree()
        PRIMARY KEY id
        ORDER BY id
        PARTITION BY (arrayElement(rdf__type, 1), arrayElement(v_s__created, 1))
    ";
*/
    let init_individuals_table = r"
        CREATE TABLE IF NOT EXISTS veda.individuals (
            id String,
            rdf__type Nested
            (
                str Nullable(String),
                int Nullable(Int64),
                date Nullable(Datetime),
                num Nullable(Float64),
                lang Nullable(String)
            ),
            v_s__created Nested
            (
                str Nullable(String),
                int Nullable(Int64),
                date Nullable(Datetime),
                num Nullable(Float64),
                lang Nullable(String)
            )
        )
        ENGINE = MergeTree()
        PRIMARY KEY id
        ORDER BY id
        PARTITION BY (rdf__type.str, v_s__created.date)
    ";
    let mut client = pool.get_handle().await?;
    client.execute(init_veda_db).await?;
    client.execute(init_individuals_table).await?;
    Ok(())
}
