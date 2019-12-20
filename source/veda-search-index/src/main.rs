#[macro_use]
extern crate log;
extern crate mysql;

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

pub struct Context{
    onto: Onto,
    pool: mysql::Pool,
    tables: HashMap<String, bool>,
}

fn main() {
    init_log();

    let mut queue_consumer = Consumer::new("./data/queue", "search_index", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
    let module_info = ModuleInfo::new("./data", "search_index", true);
    if module_info.is_err() {
        error!("{:?}", module_info.err());
        process::exit(101);
    }
    let mut module = Module::default();

    let pool = match connect_to_mysql(&mut module, 5, 20000) {
        Err(_) => process::exit(101),
        Ok(pool) => pool,
    };

    let tables = match read_tables(&pool) {
        Err(_) => process::exit(101),
        Ok(tables) => tables,
    };

    let mut ctx = Context {
        onto: Onto::default(),
        pool,
        tables,
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

    if let Some(classes) = new_state.get_literals("rdf:type") {
        for class in &classes {
            if ctx.onto.is_some_entered(&class, &["v-s:Exportable"]) {
                return export(&mut new_state, &mut prev_state, &classes, is_new, ctx);
            }
        }
    }
    Ok(())
}

fn export(new_state: &mut Individual, prev_state: &mut Individual, classes: &Vec<String>, is_new: bool, ctx: &mut Context) -> Result<(), PrepareError> {
    let uri = new_state.get_id().to_string();

    let is_deleted = new_state.is_exists_bool("v-s:deleted", true);

    let actual_version = new_state.get_first_literal("v-s:actual_version").unwrap_or_default();

    if !actual_version.is_empty() && actual_version != uri {
        info!("Skip not actual version. {}.v-s:actual_version {} != {}", uri, &actual_version, uri);
        return Ok(());
    }

    let mut conn = match ctx.pool.get_conn() {
        Err(e) => {
            error!("Get connection failed. {:?}", e);
            return Err(PrepareError::Recoverable);
        },
        Ok(conn) => conn,
    };

    let mut transaction = match conn.start_transaction(true, Some(mysql::IsolationLevel::ReadCommitted), None) {
        Err(e) => {
            error!("Transaction start failed. {:?}", e);
            return Err(PrepareError::Recoverable);
        },
        Ok(transaction) => transaction,
    };

    let mut tr_error = false;

    // Remove previous item from DB
    if !is_new {
        prev_state.get_predicates().iter().for_each(|predicate| {
            prev_state.get_resources(&predicate).unwrap().iter().for_each(|resource| {
                if resource.order == 0 {
                    // Check or create table before delete
                    if let Err(_) = check_create_property_table(&mut ctx.tables, &predicate, &resource, &mut transaction) {
                        error!("Unable to create table for property: `{}`, export aborted for individual: `{}`.", predicate, uri);
                        tr_error = true;
                    }
                    let query = format!("DELETE FROM `{}` WHERE doc_id = '{}'", predicate, uri);
                    if let Err(e) = transaction.query(query) {
                        error!("Delete individual `{}` from property table `{}` failed. {:?}", uri, predicate, e);
                        tr_error = true;
                    }
                }
            });
        });
    }

    let created = match new_state.get_first_datetime("v-s:created") {
        Some(timestamp) => format!("'{}'", NaiveDateTime::from_timestamp(timestamp, 0).to_string()),
        None => String::from("NULL"),
    };
    let deleted = match is_deleted { true => "1", _ => "NULL" };

    classes.iter().for_each(|class| {
        new_state.get_predicates().iter().for_each(|predicate| {
            new_state.get_resources(predicate).unwrap().iter().for_each(|resource| {
                // Check or create table before insert
                if resource.order == 0 {
                    if let Err(_) = check_create_property_table(&mut ctx.tables, &predicate, &resource, &mut transaction) {
                        error!("Unable to create table for property: `{}`, export aborted for individual: `{}`.", predicate, uri);
                        tr_error = true;
                    }
                }
                let uri = new_state.get_id();
                let value = match &resource.value {
                    Value::Bool(true) => String::from("1"),
                    Value::Bool(_) => String::from("0"),
                    Value::Int(int_value) => int_value.to_string(),
                    Value::Str(str_value, _lang) => format!("'{}'", str_value.replace("'", "\\'")),
                    Value::Uri(uri_value) => format!("'{}'", uri_value.replace("'", "\\'")),
                    Value::Num(_m, _e) => resource.get_float().to_string(),
                    Value::Datetime(timestamp) => format!("'{}'", NaiveDateTime::from_timestamp(*timestamp, 0)),
                    _ => String::from("NULL"),
                };
                let lang = match &resource.get_lang() {
                    Lang::NONE => String::from("NULL"),
                    lang=> format!("'{}'", lang.to_string()),
                };
                let query = format!("INSERT INTO `{}` (doc_id, doc_type, created, value, lang, deleted) VALUES ('{}', '{}', {}, {}, {}, {})",
                                    predicate, uri, class, created, value, lang, deleted
                );
                //info!("Query: {}", query);
                if let Err(e) = transaction.query(query) {
                    error!("Insert individual `{}` to property table `{}` failed. {:?}", uri, predicate, e);
                    tr_error = true;
                }
            });
        });
    });

    if tr_error {
        match transaction.rollback() {
            Ok(_) => info!("Transaction rolled back for `{}`", uri),
            Err(e) => error!("Transaction rolled back failed for `{}`. {:?}", uri, e),
        }
        return Err(PrepareError::Fatal);
    }
    return match transaction.commit() {
        Ok(_) => {
            info!("`{}` Ok", uri);
            Ok(())
        },
        Err(e) => {
            error!("Transaction commit failed for `{}`. {:?}", uri, e);
            Err(PrepareError::Fatal)
        },
    };
}

fn check_create_property_table(tables: &mut HashMap<String, bool>, property: &str, resource: &Resource, transaction: &mut mysql::Transaction) -> Result<(), &'static str> {
    if let Some(true) = tables.get(property) {
        return Ok(());
    }
    let mut sql_type = "";
    let mut sql_value_index = ", INDEX civ(`value`)";
    match &resource.rtype {
        DataType::Boolean => sql_type = "BOOL",
        DataType::Datetime => sql_type = "DATETIME",
        DataType::Decimal => sql_type = "DECIMAL (14,4)",
        DataType::Integer => sql_type = "INTEGER",
        DataType::String => {
            sql_type = "TEXT";
            sql_value_index = "";
        },
        DataType::Uri => sql_type = "CHAR(128)",
        _unsupported => error!("Unsupported property value type: {:#?}", _unsupported),
    }
    let query = format!(
        "CREATE TABLE `{}` ( \
            `ID` BIGINT NOT NULL AUTO_INCREMENT, \
            `doc_id` CHAR(128) NOT NULL, \
            `doc_type` CHAR(128) NOT NULL, \
            `created` DATETIME NULL, \
            `value` {} NULL, \
            `lang` CHAR(2) NULL, \
            `deleted` BOOL NULL, \
             PRIMARY KEY (`ID`), \
             INDEX c1(`doc_id`), INDEX c2(`doc_type`), INDEX c3 (`created`), INDEX c4(`lang`) {} \
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_bin;",
        property, sql_type, sql_value_index
    );
    return match transaction.query(query) {
        Ok(_) => {
            tables.insert(property.to_owned(), true);
            Ok(())
        },
        Err(_) => Err("Unable to create table"),
    };
}

fn read_tables(pool: &mysql::Pool) -> Result<HashMap<String, bool>, &'static str> {
    let mut tables: HashMap<String, bool> = HashMap::new();
    if let Ok(result) = pool.prep_exec("SELECT TABLE_NAME FROM information_schema.tables;", ()) {
        result.for_each(|row| {
            if let Some(name) = row.unwrap().get(0) {
                tables.insert(name, true);
            }
        });
        return Ok(tables);
    }
    Err("Read existing tables error")
}

fn connect_to_mysql(module: &mut Module, tries: i64, timeout: u64) -> Result<mysql::Pool, &'static str> {
    if let Some(node) = module.get_individual("cfg:standart_node", &mut Individual::default()) {
        if let Some(v) = node.get_literals("v-s:push_individual_by_event") {
            for el in v {
                let mut connection = Individual::default();
                if module.storage.get_individual(&el, &mut connection) && !connection.is_exists_bool("v-s:deleted", true) {
                    if let Some(transport) = connection.get_first_literal("v-s:transport") {
                        if transport == "mysql" {
                            info!("Found configuration to connect to MySQL: {}", connection.get_id());
                            let host = connection.get_first_literal("v-s:host").unwrap_or_default();
                            let port = connection.get_first_integer("v-s:port").unwrap_or(3306) as u16;
                            let login = connection.get_first_literal("v-s:login").unwrap();
                            let pass = connection.get_first_literal("v-s:password").unwrap();
                            let db = connection.get_first_literal("v-s:sql_database").unwrap();
                            info!("Trying to connect to mysql, host: {}, port: {}, login: {}, pass: {}, db: {}", host, port, login, pass, db);
                            let mut builder = mysql::OptsBuilder::new();
                            builder.ip_or_hostname(Some(host))
                                .tcp_port(port)
                                .user(Some(login))
                                .pass(Some(pass))
                                .db_name(Some(db));
                            let opts: mysql::Opts = builder.into();
                            match mysql::Pool::new(opts.clone()) {
                                Ok(pool) => {
                                    info!("Connection to MySQL established successfully");
                                    return Ok(pool);
                                },
                                Err(e) => {
                                    error!("Connection to MySQL failed. {:?}", e);
                                    return Err("Connection to MySQL failed");
                                },
                            }
                        }
                    }
                }
            }
        }
    }
    if tries != 0 {
        let tries = tries - 1;
        thread::sleep(time::Duration::from_millis(timeout));
        error!("Configuration not found yet, retry.");
        connect_to_mysql(module, tries, timeout)
    } else {
        error!("Configuration to connect to mysql not found");
        Err("Configuration to connect to mysql not found")
    }
}
