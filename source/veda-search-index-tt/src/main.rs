#[macro_use]
extern crate log;

#[macro_use]
extern crate lazy_static;

use bincode::{deserialize_from, serialize_into};
use chrono::prelude::*;
use chrono_tz::Tz;
use clickhouse_rs::{errors::Error, Block, ClientHandle, Pool};
use futures::executor::block_on;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::io::{BufReader, BufWriter};
use std::time::{Duration, Instant};
use std::{env, fs, process, thread};
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, get_inner_binobj_as_individual, Module, PrepareError};
use v_common::module::veda_module::VedaQueueModule;
use v_common::onto::datatype::DataType;
use v_common::onto::individual::Individual;
use v_common::onto::resource::Value;
use v_common::v_api::api_client::IndvOp;

type TypedBatch = HashMap<String, Batch>;
type Batch = Vec<BatchElement>;
type BatchElement = (i64, Individual, i8);
type CommittedTypesOps = HashMap<String, HashSet<i64>>;

const BATCH_SIZE: u32 = 3_000_000;
const BLOCK_LIMIT: usize = 20_000;
const BATCH_LOG_FILE_NAME: &str = "data/batch-log-index-tt";
const DEFAULT_CONNECTION_URL: &str = "tcp://default:123@127.0.0.1:9000/?connection_timeout=10s";

pub struct Stats {
    total_prepare_duration: usize,
    total_insert_duration: usize,
    total_rows: usize,
    insert_count: usize,
    started: Instant,
    last: Instant,
}

enum ColumnData {
    Str(Vec<Vec<String>>),
    Date(Vec<Vec<DateTime<Tz>>>),
    Int(Vec<Vec<i64>>),
    Dec(Vec<Vec<f64>>),
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct TypeOps {
    type_name: String,
    ops: Vec<i64>,
}

pub struct TTIndexer {
    db_name: String,
    pool: Pool,
    db_type_tables: HashMap<String, HashMap<String, String>>,
    typed_batch: TypedBatch,
    stats: Stats,
    module_info: ModuleInfo,
}

impl TTIndexer {
    fn add_to_typed_batch(&mut self, queue_element: &mut Individual) {
        let cmd = get_cmd(queue_element);

        if cmd.is_none() {
            error!("queue message cmd is none, skip");
            return;
        }

        let mut new_state = Individual::default();
        get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

        let mut prev_state = Individual::default();
        let is_new = !get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);
        if !is_new {
            if let Some(types) = prev_state.get_literals("rdf:type") {
                let id = prev_state.get_id().to_string();
                let is_version = types.contains(&"v-s:Version".to_owned());
                if is_version {
                    info!("skip version, uri = {}", id);
                    return;
                }
                for type_name in types {
                    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();
                    let mut prev_state = Individual::default();
                    get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);
                    if !self.typed_batch.contains_key(&type_name) {
                        let new_batch = Batch::new();
                        self.typed_batch.insert(type_name.clone(), new_batch);
                    }
                    let batch = self.typed_batch.get_mut(&type_name).unwrap();
                    batch.push((op_id, prev_state, -1));
                }
            }
        }

        let is_remove: bool;
        if cmd == Some(IndvOp::Remove) {
            is_remove = true;
        } else {
            is_remove = false;
        }
        if !is_remove {
            if let Some(types) = new_state.get_literals("rdf:type") {
                let id = new_state.get_id().to_string();
                let is_version = types.contains(&"v-s:Version".to_owned());
                if is_version {
                    info!("skip version, uri = {}", id);
                    return;
                }
                if types.contains(&"v-s:Credential".to_owned()) {
                    info!("skip v-s:Credential, uri = {}", id);
                    return;
                }
                for type_name in types {
                    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();
                    let mut new_state = Individual::default();
                    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);
                    if !self.typed_batch.contains_key(&type_name) {
                        let new_batch = Batch::new();
                        self.typed_batch.insert(type_name.clone(), new_batch);
                    }
                    let batch = self.typed_batch.get_mut(&type_name).unwrap();
                    batch.push((op_id, new_state, 1));
                }
            }
        }
    }

    async fn process_typed_batch(&mut self) -> Result<(), Error> {
        if !self.typed_batch.is_empty() {
            let now = Instant::now();
            let client = &mut self.pool.get_handle().await?;
            let db_type_tables = &mut self.db_type_tables;
            let stats = &mut self.stats;

            let f = OpenOptions::new().read(true).write(true).create(true).truncate(false).open(BATCH_LOG_FILE_NAME)?;
            let batch_log_file = f.try_clone()?;
            let mut reader = BufReader::new(f);
            let mut committed_types_ops: CommittedTypesOps = HashMap::new();
            loop {
                let res: Result<TypeOps, _> = deserialize_from(&mut reader);
                match res {
                    Ok(type_ops) => {
                        let type_name = type_ops.type_name;
                        let ops = type_ops.ops;
                        if !committed_types_ops.contains_key(&type_name) {
                            committed_types_ops.insert(type_name.clone(), HashSet::new());
                        }
                        let committed_ops = committed_types_ops.get_mut(&type_name).unwrap();
                        for op in ops {
                            committed_ops.insert(op);
                        }
                    },
                    Err(_) => break,
                }
            }
            if committed_types_ops.len() > 0 {
                info!("found {:#?} committed individuals", committed_types_ops.len());
            }

            for (type_name, batch) in self.typed_batch.iter_mut() {
                while batch.len() > BLOCK_LIMIT {
                    let mut slice = batch.drain(0..BLOCK_LIMIT).collect();
                    TTIndexer::process_batch(&self.db_name, &type_name, &mut slice, client, db_type_tables, stats, &mut committed_types_ops, &batch_log_file).await?;
                }
                TTIndexer::process_batch(&self.db_name, &type_name, batch, client, db_type_tables, stats, &mut committed_types_ops, &batch_log_file).await?;
            }
            fs::remove_file(BATCH_LOG_FILE_NAME)?;
            self.typed_batch.clear();
            stats.last = Instant::now();
            info!("batch processed in {} ms", now.elapsed().as_millis());
        }
        Ok(())
    }

    async fn process_batch(
        db_name: &str,
        type_name: &str,
        batch: &mut Batch,
        client: &mut ClientHandle,
        db_type_tables: &mut HashMap<String, HashMap<String, String>>,
        stats: &mut Stats,
        committed_types_ops: &mut CommittedTypesOps,
        batch_log_file: &File,
    ) -> Result<(), Error> {
        let now = Instant::now();

        info!("---------------------------------------------------------");

        info!("processing class batch: {}, count: {}", type_name, batch.len().clone());

        let mut id_column: Vec<String> = Vec::new();

        let mut sign_column: Vec<i8> = Vec::new();

        let mut version_column: Vec<u32> = Vec::new();

        let mut text_column: Vec<String> = Vec::new();

        let mut columns: HashMap<String, ColumnData> = HashMap::new();

        let mut type_ops = TypeOps {
            type_name: type_name.to_string(),
            ops: Vec::new(),
        };

        if !committed_types_ops.contains_key(type_name) {
            committed_types_ops.insert(type_name.to_string(), HashSet::new());
        }
        let committed_ops = committed_types_ops.get_mut(type_name).unwrap();

        for (op_id, individual, sign) in batch {
            let signed_op = (*op_id) * (*sign as i64);
            if !committed_ops.contains(&signed_op) {
                TTIndexer::add_to_table(individual, *sign, &mut id_column, &mut sign_column, &mut version_column, &mut text_column, &mut columns);
                type_ops.ops.push(signed_op);
                committed_ops.insert(signed_op);
            } else {
                info!("skip already exported individual, uri = {}, type = {}, op_id = {}", individual.get_id(), type_name, signed_op);
            }
        }

        info!("batch prepared in {} us", now.elapsed().as_micros());

        stats.total_prepare_duration += now.elapsed().as_millis() as usize;

        let now = Instant::now();

        let rows = id_column.len();

        let block = TTIndexer::mk_block(db_name, type_name, id_column, sign_column, version_column, (text_column, &mut columns), client, db_type_tables).await?;

        if block.row_count() == 0 {
            info!("block is empty! nothing to insert");
            return Ok(());
        }

        let table = format!("{}.`{}`", db_name, type_name);

        client.insert(table, block).await?;

        stats.insert_count += 1;

        serialize_into(&mut BufWriter::new(batch_log_file), &type_ops).unwrap();

        let mut insert_duration = now.elapsed().as_millis() as usize;
        if insert_duration == 0 {
            insert_duration = 1;
        }

        let cps = (rows * 1000 / insert_duration) as f64;

        info!("block inserted successfully, rows = {}, columns = {}, duration = {} ms, cps = {}", rows, columns.keys().len() + 2, insert_duration, cps);

        stats.total_insert_duration += insert_duration;

        stats.total_rows += rows;

        let total_cps = (stats.total_rows * 1000 / stats.total_insert_duration) as f64;

        let uptime = stats.started.elapsed();
        let uptime_ms = if uptime.as_millis() == 0 {
            1
        } else {
            uptime.as_millis()
        } as usize;

        let uptime_cps = (stats.total_rows * 1000 / uptime_ms) as f64;

        info!(
            "total rows inserted = {}, total prepare duration = {} ms, total insert duration = {} ms, avg. insert cps = {}, uptime = {}h {}m {}s, avg. uptime cps = {}, inserts count = {}",
            stats.total_rows,
            stats.total_prepare_duration,
            stats.total_insert_duration,
            total_cps,
            (uptime_ms / 1000) / 3600,
            (uptime_ms / 1000) % 3600 / 60,
            (uptime_ms / 1000) % 3600 % 60,
            uptime_cps,
            stats.insert_count
        );

        Ok(())
    }

    fn add_to_table(
        individual: &mut Individual,
        sign: i8,
        id_column: &mut Vec<String>,
        sign_column: &mut Vec<i8>,
        version_column: &mut Vec<u32>,
        text_column: &mut Vec<String>,
        columns: &mut HashMap<String, ColumnData>,
    ) {
        let rows = id_column.len();

        let id = individual.get_id().to_owned();

        let version = individual.get_first_integer("v-s:updateCounter").unwrap_or(0) as u32;

        info!("added row: id = {}, version = {}, sign = {}", id.clone(), version, sign);

        id_column.push(id);

        version_column.push(version);

        sign_column.push(sign);

        let mut text_content: Vec<String> = Vec::new();

        for predicate in individual.get_predicates() {
            if let Some(resources) = individual.get_resources(&predicate) {
                lazy_static! {
                    static ref RE: Regex = Regex::new("[^a-zA-Z0-9]").unwrap();
                }
                let mut column_name = RE.replace_all(&predicate, "_").into_owned();
                match &resources[0].rtype {
                    DataType::Integer => {
                        column_name.push_str("_int");
                        let column_value: Vec<i64> = resources.iter().map(|resource| resource.get_int()).collect();

                        if !columns.contains_key(&column_name) {
                            let new_column = ColumnData::Int(Vec::new());
                            columns.insert(column_name.clone(), new_column);
                        }

                        let column_data = columns.get_mut(&column_name).unwrap();
                        if let ColumnData::Int(column) = column_data {
                            let column_size = column.len();
                            let mut empty = vec![vec![0]; rows - column_size];
                            column.append(&mut empty);
                            column.push(column_value);
                        }
                    },
                    DataType::String => {
                        column_name.push_str("_str");
                        let column_value: Vec<String> = resources
                            .iter()
                            .map(|resource| {
                                let str_value = resource.get_str();

                                text_content.push(str_value.trim().to_owned());

                                let lang = match resource.get_lang().is_some() {
                                    false => String::from(""),
                                    true => format!("@{}", resource.get_lang().to_string()),
                                };
                                format!("{}{}", str_value.replace("'", "\\'"), lang)
                            })
                            .collect();

                        if !columns.contains_key(&column_name) {
                            let new_column = ColumnData::Str(Vec::new());
                            columns.insert(column_name.clone(), new_column);
                        }

                        let column_data = columns.get_mut(&column_name).unwrap();
                        if let ColumnData::Str(column) = column_data {
                            let column_size = column.len();
                            let mut empty = vec![vec!["".to_owned()]; rows - column_size];
                            column.append(&mut empty);
                            column.push(column_value);
                        }
                    },
                    DataType::Uri => {
                        column_name.push_str("_str");
                        let column_value: Vec<String> = resources.iter().map(|resource| resource.get_uri().to_string()).collect();

                        if !columns.contains_key(&column_name) {
                            let new_column = ColumnData::Str(Vec::new());
                            columns.insert(column_name.clone(), new_column);
                        }

                        let column_data = columns.get_mut(&column_name).unwrap();
                        if let ColumnData::Str(column) = column_data {
                            let column_size = column.len();
                            let mut empty = vec![vec!["".to_owned()]; rows - column_size];
                            column.append(&mut empty);
                            column.push(column_value);
                        }
                    },
                    DataType::Boolean => {
                        column_name.push_str("_int");
                        let column_value: Vec<i64> = resources
                            .iter()
                            .map(|resource| match resource.value {
                                Value::Bool(true) => 1,
                                _ => 0,
                            })
                            .collect();

                        if !columns.contains_key(&column_name) {
                            let new_column = ColumnData::Int(Vec::new());
                            columns.insert(column_name.clone(), new_column);
                        }

                        let column_data = columns.get_mut(&column_name).unwrap();
                        if let ColumnData::Int(column) = column_data {
                            let column_size = column.len();
                            let mut empty = vec![vec![0]; rows - column_size];
                            column.append(&mut empty);
                            column.push(column_value);
                        }
                    },
                    DataType::Decimal => {
                        column_name.push_str("_dec");
                        let column_value: Vec<f64> = resources.iter().map(|resource| resource.get_float()).collect();

                        if !columns.contains_key(&column_name) {
                            let new_column = ColumnData::Dec(Vec::new());
                            columns.insert(column_name.clone(), new_column);
                        }

                        let column_data = columns.get_mut(&column_name).unwrap();
                        if let ColumnData::Dec(column) = column_data {
                            let column_size = column.len();
                            let mut empty = vec![vec![0 as f64]; rows - column_size];
                            column.append(&mut empty);
                            column.push(column_value);
                        }
                    },
                    DataType::Datetime => {
                        column_name.push_str("_date");
                        let column_value: Vec<DateTime<Tz>> = resources.iter().map(|resource| Tz::UTC.timestamp(resource.get_datetime(), 0)).collect();

                        if !columns.contains_key(&column_name) {
                            let new_column = ColumnData::Date(Vec::new());
                            columns.insert(column_name.clone(), new_column);
                        }

                        let column_data = columns.get_mut(&column_name).unwrap();
                        if let ColumnData::Date(column) = column_data {
                            let column_size = column.len();
                            let mut empty = vec![vec![Tz::UTC.timestamp(0, 0)]; rows - column_size];
                            column.append(&mut empty);
                            column.push(column_value);
                        }
                    },
                    _ => {
                        error!("value type is not supported");
                    },
                }
            }
        }

        text_column.push(text_content.join(" "));
    }

    async fn mk_block(
        db_name: &str,
        type_name: &str,
        id_column: Vec<String>,
        sign_column: Vec<i8>,
        version_column: Vec<u32>,
        c: (Vec<String>, &mut HashMap<String, ColumnData>),
        client: &mut ClientHandle,
        db_type_tables: &mut HashMap<String, HashMap<String, String>>,
    ) -> Result<Block, Error> {
        let (text_column, columns) = c;
        let rows = id_column.len();

        let mut block = Block::new().column("id", id_column).column("sign", sign_column).column("version", version_column).column("text", text_column);

        for (column_name, column_data) in columns.iter_mut() {
            let mut column_type = "Array(String)";
            if let ColumnData::Int(column) = column_data {
                column_type = "Array(Int64)";
                let mut empty = vec![vec![0]; rows - column.len()];
                column.append(&mut empty);
                //info!("column: {}, size: {}, {:?}", column_name, column.len(), column);
                block = block.column(&column_name, column.to_owned());
            }
            if let ColumnData::Str(column) = column_data {
                column_type = "Array(String)";
                let mut empty = vec![vec!["".to_string()]; rows - column.len()];
                column.append(&mut empty);
                //info!("column: {}, size: {}, {:?}", column_name, column.len(), column);
                block = block.column(&column_name, column.to_owned());
            }
            if let ColumnData::Dec(column) = column_data {
                column_type = "Array(Float64)";
                let mut empty = vec![vec![0 as f64]; rows - column.len()];
                column.append(&mut empty);
                //info!("column: {}, size: {}, {:?}", column_name, column.len(), column);
                block = block.column(&column_name, column.to_owned());
            }
            if let ColumnData::Date(column) = column_data {
                column_type = "Array(DateTime)";
                let mut empty = vec![vec![Tz::UTC.timestamp(0, 0)]; rows - column.len()];
                column.append(&mut empty);
                //info!("column: {}, size: {}, {:?}", column_name, column.len(), column);
                block = block.column(&column_name, column.to_owned());
            }
            create_type_predicate_column(db_name, type_name, &column_name, &column_type, client, db_type_tables).await?;
        }
        Ok(block)
    }
}

impl VedaQueueModule for TTIndexer {
    fn before_batch(&mut self, _size_batch: u32) -> Option<u32> {
        Some(BATCH_SIZE)
    }

    fn prepare(&mut self, queue_element: &mut Individual) -> Result<bool, PrepareError> {
        let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();
        if let Err(e) = self.module_info.put_info(op_id, op_id) {
            error!("failed to write module_info, op_id = {}, err = {:?}", op_id, e);
        }
        self.add_to_typed_batch(queue_element);
        Ok(false)
    }

    fn after_batch(&mut self, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
        if let Err(e) = block_on(self.process_typed_batch()) {
            error!("error processing batch, err = {:?}", e);
            process::exit(101);
        }
        Ok(true)
    }

    fn heartbeat(&mut self) -> Result<(), PrepareError> {
        Ok(())
    }

    fn before_start(&mut self) {
        info!("start module TT");
    }

    fn before_exit(&mut self) {
        info!("exit module TT");
    }
}

fn get_value_from_args(param: &str) -> Option<String> {
    let args: Vec<String> = env::args().collect();

    for el in args.iter() {
        if el.starts_with(&("--".to_owned() + param)) {
            let p: Vec<&str> = el.split('=').collect();
            if let Some(v) = p.get(1) {
                return Some(v.to_string());
            }
        }
    }
    None
}

fn main() -> Result<(), Error> {
    let mut module = Module::new_with_name("search_index_tt");

    let module_info = ModuleInfo::new("./data", "search_index_tt", true);
    if module_info.is_err() {
        println!("failed to start, err = {:?}", module_info.err());
        process::exit(101);
    }

    let url = &Module::get_property("query_indexer_db").unwrap_or(String::from(DEFAULT_CONNECTION_URL));
    let mut pool = Pool::new(url.to_string());

    let db_name = get_value_from_args("db_name").unwrap_or("veda_tt".to_owned());

    println!("connecting to clickhouse...");
    loop {
        match block_on(init_clickhouse(&db_name, &mut pool)) {
            Ok(()) => break,
            Err(err) => {
                println!("failed to connect to clickhouse, err = {:?}", err);
                thread::sleep(Duration::from_secs(10));
            },
        }
    }

    let db_type_tables = block_on(read_type_tables(&db_name, &mut pool))?;

    let typed_batch: TypedBatch = HashMap::new();
    let stats = Stats {
        total_prepare_duration: 0,
        total_insert_duration: 0,
        total_rows: 0,
        insert_count: 0,
        started: Instant::now(),
        last: Instant::now(),
    };

    let mut tt_indexer = TTIndexer {
        db_name,
        pool,
        db_type_tables,
        typed_batch,
        stats,
        module_info: module_info.unwrap(),
    };

    module.prepare_queue(&mut tt_indexer);

    Ok(())
}

async fn create_type_predicate_column(
    db_name: &str,
    type_name: &str,
    column_name: &str,
    column_type: &str,
    client: &mut ClientHandle,
    db_type_tables: &mut HashMap<String, HashMap<String, String>>,
) -> Result<(), Error> {
    if None == db_type_tables.get_mut(type_name) {
        create_type_table(db_name, type_name, client, db_type_tables).await?;
    }
    if let Some(table_columns) = db_type_tables.get_mut(type_name) {
        if table_columns.get(column_name).is_some() {
            return Ok(());
        } else {
            let query = format!("ALTER TABLE {}.`{}` ADD COLUMN IF NOT EXISTS `{}` {}", db_name, type_name, column_name, column_type);
            client.execute(query).await?;
            table_columns.insert(column_name.to_string(), column_type.to_string());
        }
    }
    Ok(())
}

async fn create_type_table(
    db_name: &str,
    type_name: &str,
    client: &mut ClientHandle,
    db_type_tables: &mut HashMap<String, HashMap<String, String>>,
) -> Result<(), Error> {
    if db_type_tables.get(type_name).is_some() {
        return Ok(());
    }
    let query = format!(
        r"
        CREATE TABLE IF NOT EXISTS {}.`{}` (
            id String,
            sign Int8 DEFAULT 1,
            version UInt32,
            text String,
            `v_s_created_date` Array(DateTime) DEFAULT [toDateTime(0)],
            `v_s_deleted_int` Array(Int64) DEFAULT [0]
        )
        ENGINE = VersionedCollapsingMergeTree(sign, version)
        ORDER BY (`v_s_created_date`[1], id)
        PARTITION BY (toYear(`v_s_created_date`[1]))
    ",
        db_name, type_name
    );
    client.execute(query).await?;
    let mut table_columns: HashMap<String, String> = HashMap::new();
    table_columns.insert("id".to_owned(), "String".to_owned());
    table_columns.insert("sign".to_owned(), "Int8".to_owned());
    table_columns.insert("version".to_owned(), "UInt32".to_owned());
    table_columns.insert("text".to_owned(), "String".to_owned());
    table_columns.insert("v_s_created_date".to_owned(), "Array(DateTime)".to_owned());
    table_columns.insert("v_s_deleted_int".to_owned(), "Array(Int64)".to_owned());
    db_type_tables.insert(type_name.to_string(), table_columns);
    Ok(())
}

async fn read_type_tables(db_name: &str, pool: &mut Pool) -> Result<HashMap<String, HashMap<String, String>>, Error> {
    let read_tables_query = format!("SELECT name from system.tables where database = '{}'", db_name);
    let mut tables: HashMap<String, HashMap<String, String>> = HashMap::new();
    let mut client = pool.get_handle().await?;
    let tables_block = client.query(read_tables_query).fetch_all().await?;
    for row_table in tables_block.rows() {
        let table_name: String = row_table.get("name")?;
        let read_columns = format!("DESCRIBE {}.`{}`", db_name, table_name);
        let mut table_columns: HashMap<String, String> = HashMap::new();
        let columns_block = client.query(read_columns).fetch_all().await?;
        for row_column in columns_block.rows() {
            let column_name: String = row_column.get("name")?;
            let data_type: String = row_column.get("type")?;
            table_columns.insert(column_name, data_type);
        }
        tables.insert(table_name, table_columns);
    }
    Ok(tables)
}

async fn init_clickhouse(db_name: &str, pool: &mut Pool) -> Result<(), Error> {
    let init_veda_db = format!("CREATE DATABASE IF NOT EXISTS {}", db_name);
    let mut client = pool.get_handle().await?;
    client.execute(init_veda_db).await?;
    Ok(())
}
