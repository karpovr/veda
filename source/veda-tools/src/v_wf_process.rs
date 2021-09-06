use crate::cleaner::CleanerContext;
use crate::common::{pause_if_overload, remove, store_to_ttl};
use chrono::prelude::*;
use chrono::Duration;
use std::collections::HashMap;
use std::io::Write;
use std::ops::Sub;
use stopwatch::Stopwatch;
use systemstat::{Platform, System};
use v_common::module::info::ModuleInfo;
use v_common::onto::individual::Individual;
use v_common::v_api::obj::OptAuthorize;
use v_common::v_api::obj::ResultCode;

const MAX_SIZE_BATCH: i64 = 100000;
const BEFORE_DAYS: i64 = 100;

struct ProcessElement {
    name: String,
    parent_id: String,
    indv: Option<Individual>,
}

pub fn clean_process(ctx: &mut CleanerContext) {
    if ctx.operations.is_empty() {
        println!("choose one of these operations: remove, to_ttl");
    }

    let module_info = ModuleInfo::new("./data", "clean_process", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", &module_info.err());
        return;
    }
    let mut module_info = module_info.unwrap();

    let mut header = Individual::default();
    header.set_id("<http://semantic-machines.com/veda/data>");
    header.set_uri("rdf:type", "owl:Ontology");

    let mut total_count = 0;

    let sys = System::new();
    let max_load = num_cpus::get() / 2;

    if let Some((mut pos, _)) = module_info.read_info() {
        info!("start pos {}", pos);
        let mut date_from = NaiveDate::from_ymd(2010, 1, 1).and_hms_milli(0, 0, 0, 0);
        let mut date_to = Utc::now().naive_utc();

        if let Some(df) = ctx.date_to {
            date_to = df;
        }

        let output_condition_list = get_list_of_output_condition(ctx);

        loop {
            if let Some(df) = ctx.date_from {
                if let Some(r) = df.checked_add_signed(Duration::days(pos)) {
                    date_from = r;
                }
            }

            if date_from >= date_to {
                break;
            }

            info!("current pos {}", date_from);

            let query = get_query_for_work_item_in_output_condition(&output_condition_list, Some(date_from), date_from.checked_add_signed(Duration::days(1)));
            let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, 0, OptAuthorize::NO);

            if res.result_code == ResultCode::Ok {
                let mut sw = Stopwatch::start_new();
                for id in res.result.iter() {
                    if let Some(rindv) = ctx.backend.get_individual(id, &mut Individual::default()) {
                        let f_for_process = &rindv.get_first_literal("v-wf:forProcess").unwrap_or_default();
                        if let Some(process) = ctx.backend.get_individual(f_for_process, &mut Individual::default()) {
                            let mut collect_elements = HashMap::new();

                            if !process.is_exists("v-wf:parentWorkOrder") {
                                if ctx.report_type == "processes" {
                                    if let Some(report) = &mut ctx.report {
                                        report.write((process.get_id().to_owned() + "\n").as_bytes()).unwrap_or_default();
                                    }
                                } else {
                                    collect_process_elements("", process, &mut collect_elements, ctx);
                                    //collect_membership(&mut process_elements, ctx);
                                    //collect_permission_statement(&mut process_elements, ctx);

                                    if ctx.report_type == "full" {
                                        if let Some(report) = &mut ctx.report {
                                            report.write("\n\n".as_bytes()).unwrap_or_default();
                                            let mut sorted: Vec<_> = collect_elements.iter().collect();
                                            sorted.sort_by_key(|a| &a.1.name);
                                            for (id, el) in sorted.iter() {
                                                report.write(format!("{};\t{};\t\t{}\n", id, el.name, el.parent_id).as_bytes()).unwrap_or_default();
                                            }
                                        }
                                    }

                                    let mut collected = vec![];
                                    let mut collected_ids = vec![];

                                    for (id, el) in collect_elements {
                                        match el.indv {
                                            Some(mut s) => {
                                                if ctx.operations.contains("to_ttl") {
                                                    s.parse_all();
                                                }

                                                collected_ids.push(s.get_id().to_owned());
                                                collected.push(s);
                                            }
                                            None => {
                                                if let Some(mut s) = ctx.backend.get_individual_s(&id) {
                                                    if ctx.operations.contains("to_ttl") {
                                                        s.parse_all();
                                                    }
                                                    collected_ids.push(s.get_id().to_owned());
                                                    collected.push(s);
                                                }
                                            }
                                        }
                                    }

                                    if !check_subprocesses(&mut collected, &output_condition_list) {
                                        warn!("process {} content not pass subprocesses", process.get_id());
                                        continue;
                                    }

                                    if ctx.report_type == "ids" {
                                        if let Some(report) = &mut ctx.report {
                                            for id in collected_ids.iter() {
                                                report.write((id.to_string() + "\n").as_bytes()).unwrap_or_default();
                                            }
                                        }
                                    }

                                    if ctx.operations.contains("to_ttl") {
                                        collected.push(Individual::new_from_obj(header.get_obj()));
                                        store_to_ttl(&mut collected, &mut ctx.onto.prefixes, &process.get_id().replace(':', "_"));
                                    }

                                    if ctx.operations.contains("remove") {
                                        for s in collected.iter_mut() {
                                            remove(s, ctx);
                                        }
                                    }

                                    total_count += collected.len();

                                    info!("total_count : {}", total_count);
                                }
                            }
                        } else {
                            error!("not found {}[{}={}]", id, "v-wf:forProcess", f_for_process);
                        }
                    }
                    if sw.elapsed_ms() > 1000 {
                        pause_if_overload(&sys, max_load);
                        sw = Stopwatch::start_new();
                    }
                }
                if let Err(e) = module_info.put_info(pos, pos) {
                    error!("err = {:?}", e);
                    return;
                }
            }

            pos += 1;
        }
    }
}

fn get_list_of_output_condition(ctx: &mut CleanerContext) -> Vec<String> {
    let mut res = vec![];
    let output_conditions_list = ctx.ch_client.select(
        &ctx.sys_ticket.user_uri,
        "SELECT DISTINCT id FROM veda_tt.`v-wf:OutputCondition` ORDER BY v_s_created_date ASC",
        MAX_SIZE_BATCH,
        MAX_SIZE_BATCH,
        0,
        OptAuthorize::NO,
    );
    for el in output_conditions_list.result.iter() {
        res.push(el.to_string());
    }
    res
}

fn get_query_for_work_item_in_output_condition(output_conditions_list: &[String], date_from: Option<NaiveDateTime>, date_to: Option<NaiveDateTime>) -> String {
    let mut q0 = String::default();
    for el in output_conditions_list.iter() {
        if q0.len() > 0 {
            q0.push_str(" OR ");
        }
        q0.push_str("v_wf_forNetElement_str[1] = '");
        q0.push_str(el);
        q0.push_str("'")
    }

    let df = if let Some(d) = date_from {
        format!(" AND v_s_created_date[1] >= toDateTime ({}) ", d.timestamp())
    } else {
        "".to_owned()
    };

    let dt = if let Some(d) = date_to {
        format!(" AND v_s_created_date[1] < toDateTime ({}) ", d.timestamp())
    } else {
        "".to_owned()
    };

    format!(
        "SELECT distinct id
    FROM veda_tt.`v-wf:WorkItem`
    WHERE ({})
    AND v_wf_isCompleted_int[1] = 1
    {} {} ORDER BY v_s_created_date ASC",
        q0, dt, df
    )
}

fn _collect_membership(process_elements: &mut HashMap<String, ProcessElement>, ctx: &mut CleanerContext) {
    let mut where_ids = String::new();
    for id in process_elements.keys() {
        if !where_ids.is_empty() {
            where_ids += " OR ";
        }
        where_ids += &format!("has(v_s_memberOf_str, '{}') = 1 OR has(v_s_resource_str, '{}') = 1", id, id);
    }

    let query = format!("SELECT DISTINCT id FROM veda_tt.`v-s:Membership` FINAL WHERE {}", where_ids);
    for id in ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, 1000000, 1000000, 0, OptAuthorize::NO).result.iter() {
        add_to_collect(id, "Membership", "", process_elements, None);
    }
}

fn _collect_permission_statement(process_elements: &mut HashMap<String, ProcessElement>, ctx: &mut CleanerContext) {
    let mut where_ids = String::new();
    for id in process_elements.keys() {
        if !where_ids.is_empty() {
            where_ids += " OR ";
        }
        where_ids += &format!("has(v_s_permissionSubject_str, '{}') = 1 OR has(v_s_permissionObject_str, '{}') = 1", id, id);
    }

    let query = format!("SELECT DISTINCT id FROM veda_tt.`v-s:PermissionStatement` FINAL WHERE {}", where_ids);
    for id in ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, 1000000, 1000000, 0, OptAuthorize::NO).result.iter() {
        add_to_collect(id, "PermissionStatement", "", process_elements, None);
    }
}

fn collect_process_elements(parent_id: &str, process: &mut Individual, process_elements: &mut HashMap<String, ProcessElement>, ctx: &mut CleanerContext) {
    //info!(
    //    "{}, created = {}, id = {}",
    //    process.get_first_literal("rdf:type").unwrap_or_default(),
    //    NaiveDateTime::from_timestamp(process.get_first_datetime("v-s:created").unwrap_or_default(), 0).format("%d.%m.%Y %H:%M:%S"),
    //    process.get_id()
    //);
    process.parse_all();
    add_to_collect(process.get_id(), "Process", parent_id, process_elements, Some(Individual::new_from_obj(process.get_obj())));
    collect_work_items(process, process_elements, ctx);
}

fn collect_work_items(process: &mut Individual, process_elements: &mut HashMap<String, ProcessElement>, ctx: &mut CleanerContext) {
    let query = format!("SELECT DISTINCT id FROM veda_tt.`v-wf:WorkItem` WHERE v_wf_forProcess_str[1] = '{}'", process.get_id());
    for w_id in ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, 1000000, 1000000, 0, OptAuthorize::NO).result.iter() {
        collect_work_orders_and_vars(w_id, process_elements, process.get_id(), ctx);
    }
}

fn collect_work_orders_and_vars(work_item_id: &str, process_elements: &mut HashMap<String, ProcessElement>, parent_id: &str, ctx: &mut CleanerContext) {
    if let Some(mut work_item) = ctx.backend.get_individual_s(work_item_id) {
        if let Some(v_ids) = work_item.get_literals("v-wf:inVars") {
            for v_id in v_ids.iter() {
                add_to_collect(v_id, "InVar", work_item.get_id(), process_elements, None);
            }
        }
        for work_order_id in work_item.get_literals("v-wf:workOrderList").unwrap_or_default().iter() {
            if let Some(mut work_order) = ctx.backend.get_individual_s(&work_order_id) {
                if let Some(v_ids) = work_order.get_literals("v-wf:outVars") {
                    for var_id in v_ids.iter() {
                        add_to_collect(var_id, "OutVar", work_order.get_id(), process_elements, None);
                    }
                }

                if let Some(inner_process_id) = work_order.get_first_literal("v-wf:isProcess") {
                    if let Some(process) = ctx.backend.get_individual(&inner_process_id, &mut Individual::default()) {
                        collect_process_elements(work_order.get_id(), process, process_elements, ctx);
                    }
                }
                add_to_collect(work_order_id, "WorkOrder", work_item.get_id(), process_elements, Some(work_order));
            }
        }
        add_to_collect(work_item_id, "WorkItem", parent_id, process_elements, Some(work_item));
    }
}

fn add_to_collect(id: &str, name: &str, parent_id: &str, process_elements: &mut HashMap<String, ProcessElement>, indv: Option<Individual>) {
    if id.starts_with("d:") {
        process_elements.insert(
            id.to_owned(),
            ProcessElement {
                name: name.to_owned(),
                parent_id: parent_id.to_owned(),
                indv,
            },
        );
    }
}

fn check_subprocesses(indvs: &mut Vec<Individual>, output_conditions_list: &[String]) -> bool {
    let date_before = Utc::now().naive_utc().sub(Duration::days(BEFORE_DAYS));

    let mut wp = HashMap::new();

    for el in indvs {
        let date_created = el.get_first_datetime("v-s:created").unwrap_or_default();
        if date_created > date_before.timestamp() {
            warn!("{} date created {} > {}", el.get_id(), NaiveDateTime::from_timestamp(date_created, 0), date_before);
            return false;
        }

        match el.get_first_literal("rdf:type").unwrap_or_default().as_str() {
            "v-wf:Process" => {
                if !wp.contains_key(el.get_id()) {
                    wp.insert(el.get_id().to_owned(), false);
                }
            }
            "v-wf:WorkItem" => {
                let date_created = el.get_first_datetime("v-s:created").unwrap_or_default();
                if date_created < date_before.timestamp() {
                } else {
                }

                if let Some(ne) = el.get_first_literal("v-wf:forNetElement") {
                    if output_conditions_list.contains(&ne) {
                        if let Some(p) = el.get_first_literal("v-wf:forProcess") {
                            wp.insert(p, true);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    for (_process_id, is_complete) in wp {
        if !is_complete {
            return false;
        }
    }
    true
}
