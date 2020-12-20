use crate::v_s_email::*;
use crate::v_s_membership::*;
use crate::v_s_membership1::*;
use crate::v_s_membership2::*;
use crate::v_s_permissionstatement::*;
use crate::v_wf_process::*;
use ini::Ini;
use std::collections::HashSet;
use std::fs::{File, OpenOptions};
use std::thread;
use std::time::*;
use v_module::module::Module;
use v_module::onto::load_onto;
use v_module::ticket::Ticket;
use v_onto::onto::Onto;
use v_search::clickhouse_client::*;

pub struct CleanerContext {
    pub(crate) module: Module,
    pub(crate) onto: Onto,
    pub(crate) ch_client: CHClient,
    pub(crate) sys_ticket: Ticket,
    pub(crate) report_type: String,
    pub(crate) report: Option<File>,
    pub(crate) operations: HashSet<String>,
}

pub fn clean(modules: String, operations: String, report: String) {
    let conf = Ini::load_from_file("veda.properties").expect("fail load veda.properties file");
    let section = conf.section(None::<String>).expect("fail parse veda.properties");
    let query_search_db = section.get("query_search_db").expect("param [query_search_db_url] not found in veda.properties");

    let mut module = Module::default();

    let mut onto = Onto::default();
    load_onto(&mut module.storage, &mut onto);

    let mut ctx = CleanerContext {
        module,
        onto,
        ch_client: CHClient::new(query_search_db.to_owned()),
        sys_ticket: Ticket::default(),
        report_type: "".to_owned(),
        report: None,
        operations: Default::default(),
    };

    let mut cleaner_modules = HashSet::new();

    for s in modules.split(',') {
        cleaner_modules.insert(s);
    }

    ctx.report_type = report.to_owned();

    for s in operations.split(',') {
        ctx.operations.insert(s.to_string());
    }

    if !ctx.report_type.is_empty() {
        match OpenOptions::new().read(true).write(true).create(true).open("report.txt") {
            Ok(ff) => {
                ctx.report = Some(ff);
            }
            Err(e) => error!("error={:?}", e),
        }
    }

    info!("use modules: {:?}", cleaner_modules);

    loop {
        if ctx.ch_client.connect() {
            break;
        }
        thread::sleep(Duration::from_millis(10000));
    }

    info!("cleaner started");

    if let Ok(t) = ctx.module.get_sys_ticket_id() {
        ctx.sys_ticket = ctx.module.get_ticket_from_db(&t);
        {
            if cleaner_modules.contains("email") {
                clean_email(&mut ctx);
            } else if cleaner_modules.contains("permissionstatement") {
                clean_invalid_permissionstatement(&mut ctx);
            } else if cleaner_modules.contains("membership") {
                clean_invalid_membership(&mut ctx);
            } else if cleaner_modules.contains("membership1") {
                remove_membership1(&mut ctx);
            } else if cleaner_modules.contains("membership2") {
                remove_membership2(&mut ctx);
            } else if cleaner_modules.contains("process") {
                clean_process(&mut ctx);
            }
            //thread::sleep(Duration::from_millis(1000));
        }
    }
}
