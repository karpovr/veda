use crate::v_s_email::*;
use crate::v_s_membership::*;
use crate::v_s_membership1::*;
use crate::v_s_membership2::*;
use crate::v_s_permissionstatement::*;
use crate::v_wf_process::*;
use chrono::NaiveDateTime;
use diligent_date_parser::parse_date;
use ini::Ini;
use std::collections::{HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::thread;
use std::time::*;
use v_common::module::common::load_onto;
use v_common::module::ticket::Ticket;
use v_common::module::veda_backend::Backend;
use v_common::onto::onto::Onto;
use v_common::search::clickhouse_client::*;
use v_common::storage::common::StorageId;

pub struct CleanerContext {
    pub(crate) backend: Backend,
    pub(crate) onto: Onto,
    pub(crate) ch_client: CHClient,
    pub(crate) sys_ticket: Ticket,
    pub(crate) report_type: String,
    pub(crate) report: Option<File>,
    pub(crate) operations: HashSet<String>,
    pub(crate) date_from: Option<NaiveDateTime>,
    pub(crate) date_to: Option<NaiveDateTime>,
}

pub fn clean(modules: Option<String>, operations: Option<String>, report: Option<String>, date_from: Option<String>, date_to: Option<String>) {
    let mut cleaner_modules = HashSet::new();

    if let Some(m) = modules {
        for s in m.split(',') {
            cleaner_modules.insert(s.to_owned());
        }
    }

    let mut cleaners = HashMap::new();
    cleaners.insert("email", clean_email as for<'r> fn(&'r mut CleanerContext));
    cleaners.insert("permission_statement", clean_invalid_permissionstatement as for<'r> fn(&'r mut CleanerContext));
    cleaners.insert("membership", clean_invalid_membership as for<'r> fn(&'r mut CleanerContext));
    cleaners.insert("membership1", remove_membership1 as for<'r> fn(&'r mut CleanerContext));
    cleaners.insert("membership2", remove_membership2 as for<'r> fn(&'r mut CleanerContext));
    cleaners.insert("process", clean_process as for<'r> fn(&'r mut CleanerContext));

    println!("choose one or more module(s): --module []");
    if cleaner_modules.is_empty() {
        println!("{:?}", cleaners.keys());
        return;
    }

    let conf = Ini::load_from_file("veda.properties").expect("fail load veda.properties file");
    let section = conf.section(None::<String>).expect("fail parse veda.properties");
    let query_search_db = section.get("query_search_db").expect("param [query_search_db_url] not found in veda.properties");

    let mut backend = Backend::default();

    info!("total count individuals: {}", backend.storage.count(StorageId::Individuals));

    let mut onto = Onto::default();
    load_onto(&mut backend.storage, &mut onto);

    let mut ctx = CleanerContext {
        backend,
        onto,
        ch_client: CHClient::new(query_search_db.to_owned()),
        sys_ticket: Ticket::default(),
        report_type: "".to_owned(),
        report: None,
        operations: Default::default(),
        date_from: None,
        date_to: None,
    };

    if let Some(ds) = date_from {
        if let Some(d) = parse_date(&ds) {
            ctx.date_from = Some(d.naive_utc());
        }
    }

    if let Some(ds) = date_to {
        if let Some(d) = parse_date(&ds) {
            ctx.date_to = Some(d.naive_utc());
        }
    }

    ctx.report_type = report.unwrap_or(String::default());

    if let Some(op) = operations {
        for s in op.split(',') {
            ctx.operations.insert(s.to_string());
        }
    }

    if !ctx.report_type.is_empty() {
        match OpenOptions::new().read(true).write(true).create(true).open("report.txt") {
            Ok(ff) => {
                ctx.report = Some(ff);
            }
            Err(e) => error!("err = {:?}", e),
        }
    }

    info!("use modules: {:?}", cleaner_modules);

    loop {
        if ctx.ch_client.connect() {
            break;
        }
        thread::sleep(Duration::from_millis(10000));
    }

    if let Ok(t) = ctx.backend.get_sys_ticket_id() {
        ctx.sys_ticket = ctx.backend.get_ticket_from_db(&t);
        {
            for module in cleaner_modules.iter() {
                if let Some(f) = cleaners.get(module.as_str()) {
                    f(&mut ctx);
                }
            }
        }
    }
}
