#[macro_use]
extern crate log;

use clickhouse_rs::{Pool, errors::Error, ClientHandle};
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
        Err(_) => process::exit(101),
        Ok(pool) => pool,
    };

    init_clickhouse(&mut pool).await?;

    let mut ctx = Context {
        onto: Onto::default(),
        pool,
    };

    load_onto(&mut module.fts, &mut module.storage, &mut ctx.onto);

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

async fn export(new_state: &mut Individual, prev_state: &mut Individual, is_new: bool, ctx: &Context) -> Result<(), Error> {
    let uri = new_state.get_id().to_owned();
    info!("Export individual: {}", uri);

    let actual_version = new_state.get_first_literal("v-s:actual_version").unwrap_or_default();

    if !actual_version.is_empty() && actual_version != uri {
        info!("Skip not actual version. {}.v-s:actual_version {} != {}", uri, &actual_version, uri);
        return Ok(());
    }

    // Remove previous state from individuals table
    if !is_new {
        delete_individual(&uri, ctx).await?
    }

    let mut predicates: Vec<String> = vec![String::from("`@`")];

    let mut values: Vec<String> = vec![format!("'{}'", uri)];

    let mut export_error= true;

    let mut predicate_values: Vec<String>;

    for predicate in new_state.get_predicates() {

        predicate_values = vec![];

        predicates.push(format!("`{}`", predicate));

        for resource in new_state.get_resources(&predicate).unwrap_or(vec![]) {
            /*if predicate == "v-s:updateCounter" {
                if let Value::Int(counter) = &resource.value {
                    predicate_values.push(format!("{}", counter));
                } else {
                    predicate_values.push(String::from("0"));
                }
                break;
            } else {*/
                if resource.order == 0 {
                    create_property_column(&predicate, &resource, &ctx).await?
                }
                let value = match &resource.value {
                    Value::Bool(true) => String::from("1"),
                    Value::Bool(_) => String::from("0"),
                    Value::Int(int_value) => int_value.to_string(),
                    Value::Str(str_value, _lang) => {
                        let lang = match &resource.get_lang() {
                            Lang::NONE => String::from(""),
                            lang => format!("@{}", lang.to_string()),
                        };
                        format!("'{}{}'", str_value.replace("'", "\\'"), lang)
                    },
                    Value::Uri(uri_value) => format!("'{}'", uri_value.replace("'", "\\'")),
                    Value::Num(_m, _e) => resource.get_float().to_string(),
                    Value::Datetime(timestamp) => format!("'{}'", NaiveDateTime::from_timestamp(*timestamp, 0)),
                    _ => String::from("NULL"),
                };
                predicate_values.push(value);
            /*}*/
        }

        let predicate_values_joined = predicate_values.join(", ");

        values.push(format!("[{}]", predicate_values_joined));
    }

    let predicates = predicates.join(", ");

    let values = values.join(", ");

    let query = format!("INSERT INTO veda.individuals ({}) VALUES ({})", predicates, values);

    let mut client = ctx.pool.get_handle().await?;
    client.execute(query).await?;

    info!("Export done: {}", new_state.get_id());

    Ok(())
}

async fn create_property_column(property: &str, resource: &Resource, ctx: &Context) -> Result<(), Error> {
    if property == "rdf:type" || property == "v-s:created" {
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
        property, column_type
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
    let init_db = "CREATE DATABASE IF NOT EXISTS veda";
    /*let init_prop_table = r"
        CREATE TABLE IF NOT EXISTS veda.individuals (
            `@` String,
            `sign` Int8,
            `v-s:updateCounter` UInt32
        ) ENGINE = VersionedCollapsingMergeTree(`sign`, `v-s:updateCounter`)";*/
    let init_prop_table = r"
        CREATE TABLE IF NOT EXISTS veda.individuals (
            `@` String,
            `rdf:type` Array(String),
            `v-s:created` Array(DateTime)
        )
        ENGINE = MergeTree()
        PRIMARY KEY `@`
        ORDER BY `@`
        PARTITION BY (arrayElement(`rdf:type`, 1), arrayElement(`v-s:created`, 1))
    ";
    let mut client = pool.get_handle().await?;
    client.execute(init_db).await?;
    client.execute(init_prop_table).await?;
    Ok(())
}
