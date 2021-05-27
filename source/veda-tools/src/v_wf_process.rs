use crate::common::remove;

use crate::cleaner::CleanerContext;
use chrono::prelude::*;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::thread;
use std::time::Duration as std_Duration;
use stopwatch::Stopwatch;
use systemstat::{Platform, System};
use v_module::info::ModuleInfo;
use v_module::v_api::app::{OptAuthorize, ResultCode};
use v_module::v_onto::individual::Individual;
use v_module::v_onto::individual2turtle::to_turtle;

const MAX_SIZE_BATCH: i64 = 100000;

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
        let query = get_query_for_work_item_in_output_condition(ctx);
        let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, pos, OptAuthorize::NO);

        if res.result_code == ResultCode::Ok {
            for id in res.result.iter() {
                let sw = Stopwatch::start_new();

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
                                //collect_membership(&mut process_elements, ctx);
                                //collect_permission_statement(&mut process_elements, ctx);

                                if ctx.report_type == "full" {
                                    if let Some(report) = &mut ctx.report {
                                        report.write("\n\n".as_bytes()).unwrap_or_default();
                                        let mut sorted: Vec<_> = process_elements.iter().collect();
                                        sorted.sort_by_key(|a| &a.1.name);
                                        for (id, el) in sorted.iter() {
                                            report.write(format!("{};\t{};\t\t{}\n", id, el.name, el.parent_id).as_bytes()).unwrap_or_default();
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
                                            if let Some(mut s) = ctx.backend.get_individual_s(&id) {
                                                if ctx.operations.contains("to_ttl") {
                                                    s.parse_all();
                                                }
                                                indv_ids.push(s.get_id().to_owned());
                                                indvs.push(s);
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

                                total_count += indvs.len();

                                if ctx.operations.contains("to_ttl") {
                                    indvs.push(Individual::new_from_obj(header.get_obj()));
                                    if let Ok(buf) = to_turtle(indvs, &mut ctx.onto.prefixes) {
                                        let mut ze = GzEncoder::new(Vec::new(), Compression::default());

                                        ze.write_all(format!("# count elements: {}\n", indvs_count).as_bytes()).unwrap_or_default();
                                        if let Err(e) = ze.write_all(buf.as_slice()) {
                                            error!("failed compress, err = {:?}", e);
                                            return;
                                        } else {
                                            if let Ok(compressed_bytes) = ze.finish() {
                                                let file_path = format!("./out/{}.ttl.gz", process.get_id().replace(':', "_"));
                                                if let Ok(mut file) = File::create(&(file_path)) {
                                                    if let Err(e) = file.write_all(&compressed_bytes) {
                                                        error!("failed to write to file {}, {:?}", file_path, e);
                                                        return;
                                                    }
                                                    info!("stored: count = {}, bytes = {}", indvs_count, buf.len());
                                                } else {
                                                    error!("failed to create file {}", file_path);
                                                    return;
                                                }
                                            } else {
                                                error!("failed compress");
                                                return;
                                            }
                                        }
                                    }
                                }

                                info!("total_count : {}", total_count);
                            }
                        }
                    } else {
                        error!("invalid workitem {}", id);
                    }
                }
                if sw.elapsed_ms() > 1000 {
                    match sys.load_average() {
                        Ok(loadavg) => {
                            println!("\nLoad average: {} {} {}", loadavg.one, loadavg.five, loadavg.fifteen);
                            if loadavg.one > max_load as f32 {
                                thread::sleep(std_Duration::from_millis(10000));
                            }
                        }
                        Err(x) => println!("\nLoad average: error: {}", x),
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

fn get_query_for_work_item_in_output_condition(ctx: &mut CleanerContext) -> String {
    let output_conditions_list = ctx.ch_client.select(
        &ctx.sys_ticket.user_uri,
        "SELECT DISTINCT id FROM veda_tt.`v-wf:OutputCondition` ORDER BY v_s_created_date ASC",
        MAX_SIZE_BATCH,
        MAX_SIZE_BATCH,
        0,
        OptAuthorize::NO,
    );

    let mut q0 = String::default();
    for el in output_conditions_list.result.iter() {
        if q0.len() > 0 {
            q0.push_str(" OR ");
        }
        q0.push_str("v_wf_forNetElement_str[1] = '");
        q0.push_str(el);
        q0.push_str("'")
    }

    let df = if let Some(d) = &ctx.date_from {
        format!(" AND v_s_created_date[1] >= toDateTime ({}) ", d.timestamp())
    } else {
        "".to_owned()
    };

    let dt = if let Some(d) = &ctx.date_to {
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
