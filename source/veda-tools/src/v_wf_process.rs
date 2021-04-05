use crate::common::remove;

use crate::cleaner::CleanerContext;
use chrono::prelude::*;
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::ops::Sub;
use time::Duration;
use v_module::info::ModuleInfo;
use v_module::v_api::app::{OptAuthorize, ResultCode};
use v_module::v_onto::individual::Individual;
use v_module::v_onto::individual2turtle::to_turtle;

const MAX_SIZE_BATCH: i64 = 10000;

struct ProcessElement {
    name: String,
    parent_id: String,
    indv: Option<Individual>,
}

pub fn clean_process(ctx: &mut CleanerContext) {
    let module_info = ModuleInfo::new("./data", "clean_process", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", &module_info.err());
        return;
    }
    let mut module_info = module_info.unwrap();

    if let Some((mut pos, _)) = module_info.read_info() {
        let query = get_query_for_work_item(ctx);
        let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, pos, OptAuthorize::NO);

        if res.result_code == ResultCode::Ok {
            for id in res.result.iter() {
                pos += 1;
                if let Some(rindv) = ctx.backend.get_individual(id, &mut Individual::default()) {
                    if let Some(process) = ctx.backend.get_individual(&rindv.get_first_literal("v-wf:forProcess").unwrap_or_default(), &mut Individual::default()) {
                        let mut process_elements = HashMap::new();

                        if !process.is_exists("v-wf:parentWorkOrder") {
                            if ctx.report_type == "processes" {
                                if let Some(report) = &mut ctx.report {
                                    report.write((process.get_id().to_owned() + "\n").as_bytes()).unwrap_or_default();
                                }
                            } else {
                                collect_process_elements("", process, &mut process_elements, ctx);
                                collect_membership(&mut process_elements, ctx);
                                collect_permission_statement(&mut process_elements, ctx);

                                if ctx.report_type == "full" {
                                    if let Some(report) = &mut ctx.report {
                                        report.write("\n".as_bytes()).unwrap_or_default();
                                        for (id, el) in process_elements.iter() {
                                            report.write(format!("{}; {}; {}\n", id, el.name, el.parent_id).as_bytes()).unwrap_or_default();
                                        }
                                    }
                                }

                                let mut indvs = vec![];
                                let mut indv_ids = vec![];
                                for (id, el) in process_elements {
                                    match el.indv {
                                        Some(mut s) => {
                                            if ctx.operations.contains("to_ttl") {
                                                s.parse_all();
                                            }
                                            indv_ids.push(s.get_id().to_owned());
                                            indvs.push(s);
                                        }
                                        None => {
                                            if let Some(mut s) = ctx.backend.get_individual_h(&id) {
                                                if ctx.operations.contains("to_ttl") {
                                                    s.parse_all();
                                                }
                                                indv_ids.push(s.get_id().to_owned());
                                                indvs.push(*s);
                                            }
                                        }
                                    }
                                }
                                let indvs_count = indvs.len();

                                if ctx.report_type == "ids" {
                                    if let Some(report) = &mut ctx.report {
                                        for id in indv_ids.iter() {
                                            report.write((id.to_string() + "\n").as_bytes()).unwrap_or_default();
                                        }
                                    }
                                }

                                if ctx.operations.contains("remove") {
                                    for s in indvs.iter_mut() {
                                        remove(s, ctx);
                                    }
                                }

                                if ctx.operations.contains("to_ttl") {
                                    if let Ok(buf) = to_turtle(indvs, &mut ctx.onto.prefixes) {
                                        let file_path = format!("./out/{}.ttl", process.get_id());
                                        if let Ok(mut file) = File::create(&(file_path)) {
                                            file.write_all(format!("# count elements: {}\n", indvs_count).as_bytes()).unwrap_or_default();
                                            if let Err(e) = file.write_all(buf.as_slice()) {
                                                error!("failed to write to file, err = {:?}", e);
                                            } else {
                                                info!("stored: count = {}, bytes = {}", indvs_count, buf.len());
                                            }
                                        } else {
                                            error!("failed to create file {}", file_path);
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        error!("invalid workitem {}", id);
                    }
                }
            }
            if let Err(e) = module_info.put_info(pos, pos) {
                error!("err = {:?}", e);
                return;
            }
        }
    }
}

fn get_query_for_work_item(ctx: &mut CleanerContext) -> String {
    let output_conditions_list =
        ctx.ch_client.select(&ctx.sys_ticket.user_uri, "SELECT DISTINCT id FROM veda_tt.`v-wf:OutputCondition`", MAX_SIZE_BATCH, MAX_SIZE_BATCH, 0, OptAuthorize::NO);

    let mut q0 = String::default();
    for el in output_conditions_list.result.iter() {
        if q0.len() > 0 {
            q0.push_str(" OR ");
        }
        q0.push_str("v_wf_forNetElement_str[1] = '");
        q0.push_str(el);
        q0.push_str("'")
    }

    let date_before = Utc::now().naive_utc().sub(Duration::days(0));

    format!(
        "SELECT distinct id
    FROM veda_tt.`v-wf:WorkItem`
    WHERE ({})
    AND v_wf_isCompleted_int[1] = 1
    AND v_s_created_date[1] < toDateTime ({}) ORDER BY v_s_created_date DESC",
        q0,
        date_before.timestamp()
    )
}

fn collect_membership(process_elements: &mut HashMap<String, ProcessElement>, ctx: &mut CleanerContext) {
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

fn collect_permission_statement(process_elements: &mut HashMap<String, ProcessElement>, ctx: &mut CleanerContext) {
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
    info!(
        "{}, created = {}, id = {}",
        process.get_first_literal("rdf:type").unwrap_or_default(),
        NaiveDateTime::from_timestamp(process.get_first_datetime("v-s:created").unwrap_or_default(), 0).format("%d.%m.%Y %H:%M:%S"),
        process.get_id()
    );
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
    if let Some(mut work_item) = ctx.backend.get_individual_h(work_item_id) {
        if let Some(v_ids) = work_item.get_literals("v-wf:inVars") {
            for v_id in v_ids.iter() {
                add_to_collect(v_id, "InVar", work_item.get_id(), process_elements, None);
            }
        }
        for work_order_id in work_item.get_literals("v-wf:workOrderList").unwrap_or_default().iter() {
            if let Some(mut work_order) = ctx.backend.get_individual_h(&work_order_id) {
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
                add_to_collect(work_order_id, "WorkOrder", work_item.get_id(), process_elements, Some(*work_order));
            }
        }
        add_to_collect(work_item_id, "WorkItem", parent_id, process_elements, Some(*work_item));
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
