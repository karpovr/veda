#[macro_use]
extern crate log;
extern crate env_logger;

use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::time::Instant;
use v_ft_xapian::xapian_reader::XapianReader;
use v_module::info::ModuleInfo;
use v_module::module::*;
use v_module::v_api::app::ResultCode;
use v_module::v_api::IndvOp;
use v_module::v_onto::individual2turtle::to_turtle;
use v_module::v_onto::onto_index::OntoIndex;
use v_module::v_onto::{individual::*, parser::*};
use v_module::v_search::common::FTQuery;
use v_queue::consumer::*;

fn main() -> std::io::Result<()> {
    init_log("ONTOLOGIST");

    let mut module = Module::default();

    let onto_types = vec![
        "rdfs:Class",
        "owl:Class",
        "rdfs:Datatype",
        "owl:Ontology",
        "rdf:Property",
        "owl:DatatypeProperty",
        "owl:ObjectProperty",
        "owl:OntologyProperty",
        "owl:AnnotationProperty",
        "v-ui:PropertySpecification",
        "v-ui:DatatypePropertySpecification",
        "v-ui:ObjectPropertySpecification",
        "v-ui:TemplateSpecification",
        "v-ui:ClassModel",
    ];

    let mut query = String::new();

    for el in &onto_types {
        if !query.is_empty() {
            query.push_str(" || ");
        }
        query.push_str("'rdf:type' === '");
        query.push_str(el);
        query.push_str("'");
    }

    //    while !ft_client.connect() {
    //        thread::sleep(time::Duration::from_millis(3000));
    //    }

    let ontology_file_path = "public/ontology.json";

    //wait_load_ontology();

    let path = "./data";

    let module_info = ModuleInfo::new(path, "ontologist", true);
    if module_info.is_err() {
        error!("{:?}", &module_info.err());
        return Ok(());
    }

    if get_info_of_module("input-onto").unwrap_or((0, 0)).0 == 0 {
        wait_module("fulltext_indexer", wait_load_ontology());
    }

    if let Some(xr) = XapianReader::new("russian", &mut module.storage) {
        let mut ctx = Context {
            last_found_changes: Instant::now(),
            query,
            ontology_file_path: ontology_file_path.to_owned(),
            onto_types: onto_types.iter().map(|s| String::from(*s)).collect(),
            onto_index: OntoIndex::load(),
            is_need_generate: false,
            xr,
            module_info: module_info.unwrap(),
        };

        if ctx.onto_index.len() == 0 {
            recover_index_from_ft(&mut ctx, &mut module);
            if let Err(e) = ctx.onto_index.dump() {
                error!("fail flush onto index, err={}", e);
            }
        }

        let mut queue_consumer = Consumer::new("./data/queue", "ontologist", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
        module.listen_queue(
            &mut queue_consumer,
            &mut ctx,
            &mut (before_batch as fn(&mut Module, &mut Context, batch_size: u32) -> Option<u32>),
            &mut (prepare as fn(&mut Module, &mut Context, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
            &mut (after_batch as fn(&mut Module, &mut Context, prepared_batch_size: u32) -> Result<bool, PrepareError>),
            &mut (heartbeat as fn(&mut Module, &mut Context) -> Result<(), PrepareError>),
        );
    } else {
        error!("fail init ft-query");
    }
    Ok(())
}

pub struct Context {
    last_found_changes: Instant,
    query: String,
    ontology_file_path: String,
    onto_types: Vec<String>,
    onto_index: OntoIndex,
    is_need_generate: bool,
    pub xr: XapianReader,
    module_info: ModuleInfo,
}

fn heartbeat(module: &mut Module, ctx: &mut Context) -> Result<(), PrepareError> {
    if !ctx.onto_index.exists() {
        recover_index_from_ft(ctx, module);
        if let Err(e) = ctx.onto_index.dump() {
            error!("fail flush onto index, err={}", e);
        }
    }

    if !Path::new(&ctx.ontology_file_path).exists() {
        generate_turtle_file(ctx, module);
        generate_json_file(ctx, module);
    } else {
        if ctx.is_need_generate && Instant::now().duration_since(ctx.last_found_changes).as_secs() > 5 {
            if generate_json_file(ctx, module) {
                ctx.is_need_generate = false;
            }
        }
    }

    Ok(())
}

fn before_batch(_module: &mut Module, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Module, _ctx: &mut Context, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
    Ok(true)
}

fn prepare(_module: &mut Module, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();

    if let Some((id, counter, is_deleted)) = test_on_onto(queue_element, &ctx.onto_types) {
        ctx.last_found_changes = Instant::now();
        ctx.is_need_generate = true;
        info!("update onto index, id={}, counter={}, is_deleted={}", id, counter, is_deleted);

        if is_deleted {
            if let Err(e) = ctx.onto_index.remove(&id) {
                error!("fail remove from onto index, err={}", e);
            }
        } else {
            if let Err(e) = ctx.onto_index.set(&id, &counter) {
                error!("fail update onto index, err={}", e);
            }
        }
    }

    if let Err(e) = ctx.module_info.put_info(op_id, op_id) {
        error!("fail write module_info, op_id={}, err={:?}", op_id, e);
        return Err(PrepareError::Fatal);
    }

    return Ok(true);
}

fn recover_index_from_ft(ctx: &mut Context, module: &mut Module) -> bool {
    info!("recover index from ft");
    info!("query={}", ctx.query);

    let res = ctx.xr.query(FTQuery::new_with_user("cfg:VedaSystem", &ctx.query), &mut module.storage);
    if res.result_code == ResultCode::Ok && res.count > 0 {
        //        if let Err(e) = ctx.onto_index.drop() {
        //            error!("fail clean index, err={}", e);
        //            return false;
        //       }

        for id in &res.result {
            if let Err(e) = ctx.onto_index.set(id, &0) {
                error!("fail create onto index, err={}", e);
                break;
            }
        }
    } else {
        error!("search return empty set, query: {}", &ctx.query);
    }

    false
}

fn generate_turtle_file(ctx: &mut Context, module: &mut Module) -> bool {
    info!("generate TURTLE file use onto index");

    let mut indvs_count = 0;
    let mut indvs = vec![];

    let mut prefixes = HashMap::new();

    for id in ctx.onto_index.data.keys() {
        let mut rindv: Individual = Individual::default();
        if module.storage.get_individual(id, &mut rindv) {
            rindv.parse_all();

            if rindv.any_exists("rdf:type", &["owl:Ontology"]) {
                if let Some(full_url) = rindv.get_first_literal("v-s:fullUrl") {
                    debug!("prefix : {} -> {}", rindv.get_id(), full_url);
                    let short_prefix = rindv.get_id().trim_end_matches(':');
                    prefixes.insert(short_prefix.to_owned(), full_url);
                }
            }

            indvs.push(rindv);
            indvs_count += 1;
        } else {
            error!("fail read, uri={}", id);
        }
    }

    if let Ok(buf) = to_turtle(indvs, &mut prefixes) {
        let file_path = ctx.ontology_file_path.clone() + ".ttl";
        if let Ok(mut file) = File::create(&(file_path)) {
            if let Err(e) = file.write_all(buf.as_slice()) {
                error!("fail write to file {:?}", e);
            } else {
                info!("stored: count:{}, bytes:{}", indvs_count, buf.len());
                return true;
            }
        } else {
            error!("fail create file {}", file_path);
        }
    }

    false
}

fn generate_json_file(ctx: &mut Context, module: &mut Module) -> bool {
    info!("generate JSON file use onto index");

    let mut indvs_count = 0;
    let mut buf = String::new();

    buf.push('[');

    for id in ctx.onto_index.data.keys() {
        let mut rindv: Individual = Individual::default();
        if module.storage.get_individual(id, &mut rindv) {
            rindv.parse_all();

            if buf.len() > 1 {
                buf.push(',');
                buf.push('\n');
            }

            buf.push_str(&rindv.get_obj().as_json_str());
            indvs_count += 1;
        } else {
            error!("fail read, uri={}", id);
        }
    }

    buf.push(']');

    if let Ok(mut file) = File::create(&ctx.ontology_file_path) {
        if let Err(e) = file.write_all(buf.as_bytes()) {
            error!("fail write to file {:?}", e);
        } else {
            info!("stored: count:{}, bytes:{}", indvs_count, buf.len());
            return true;
        }
    } else {
        error!("fail create file {}", ctx.ontology_file_path);
    }

    false
}

fn test_on_onto(queue_element: &mut Individual, onto_types: &Vec<String>) -> Option<(String, i64, bool)> {
    if parse_raw(queue_element).is_ok() {
        let wcmd = queue_element.get_first_integer("cmd");
        if wcmd.is_none() {
            return None;
        }
        let cmd = IndvOp::from_i64(wcmd.unwrap_or_default());

        let mut prev_state = Individual::default();
        get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

        let mut new_state = Individual::default();
        get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

        if cmd != IndvOp::Remove {
            let is_deleted = new_state.is_exists_bool("v-s:deleted", true);
            if new_state.any_exists_v("rdf:type", &onto_types) {
                info!("found onto changes from storage: uri={}", new_state.get_id());
                return Some((new_state.get_id().to_owned(), new_state.get_first_integer("v-s:updateCounter").unwrap_or_default(), is_deleted));
            }
        } else {
            if prev_state.any_exists_v("rdf:type", &onto_types) {
                info!("found onto changes from storage: uri={}", prev_state.get_id());
                return Some((prev_state.get_id().to_owned(), prev_state.get_first_integer("v-s:updateCounter").unwrap_or_default(), true));
            }
        }
    }

    None
}
