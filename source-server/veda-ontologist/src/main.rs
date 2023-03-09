#[macro_use]
extern crate log;

use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::time::Instant;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_info_of_module, get_inner_binobj_as_individual, init_log, wait_load_ontology, wait_module, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::module::veda_module::VedaQueueModule;
use v_common::onto::individual::Individual;
use v_common::onto::individual2turtle::to_turtle;
use v_common::onto::onto_index::OntoIndex;
use v_common::onto::parser::parse_raw;
use v_common::search::common::FTQuery;
use v_common::storage::common::StorageMode;
use v_common::v_api::api_client::IndvOp;
use v_common::v_api::obj::ResultCode;

struct OntologistModule {
    last_found_changes: Instant,
    query: String,
    ontology_file_path: String,
    onto_types: Vec<String>,
    onto_index: OntoIndex,
    is_need_generate: bool,
    pub xr: XapianReader,
    module_info: ModuleInfo,
    backend: Backend,
}

impl VedaQueueModule for OntologistModule {
    fn before_batch(&mut self, _size_batch: u32) -> Option<u32> {
        None
    }

    fn prepare(&mut self, queue_element: &mut Individual) -> Result<bool, PrepareError> {
        let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();

        if let Some((id, counter, is_deleted)) = test_on_onto(queue_element, &self.onto_types) {
            self.last_found_changes = Instant::now();
            self.is_need_generate = true;
            info!("update ontology index, id = {}, counter = {}, is_deleted = {}", id, counter, is_deleted);

            if is_deleted {
                if let Err(e) = self.onto_index.remove(&id) {
                    error!("failed to remove individual from ontology index, err = {:?}", e);
                }
            } else if let Err(e) = self.onto_index.set(&id, &counter) {
                error!("failed to update ontology index, err = {:?}", e);
            }
        }

        if let Err(e) = self.module_info.put_info(op_id, op_id) {
            error!("failed to write module_info, op_id = {}, err = {:?}", op_id, e);
            return Err(PrepareError::Fatal);
        }

        Ok(true)
    }

    fn after_batch(&mut self, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
        Ok(true)
    }

    fn heartbeat(&mut self) -> Result<(), PrepareError> {
        if !self.onto_index.exists() {
            self.recover_index_from_ft();
            if let Err(e) = self.onto_index.dump() {
                error!("failed to flush onto index, err = {:?}", e);
            }
        }

        if !Path::new(&self.ontology_file_path).exists() {
            self.generate_turtle_file();
            self.generate_json_file();
        } else if self.is_need_generate && Instant::now().duration_since(self.last_found_changes).as_secs() > 5 && self.generate_json_file() {
            self.is_need_generate = false;
        }

        Ok(())
    }

    fn before_start(&mut self) {}

    fn before_exit(&mut self) {}
}

impl OntologistModule {
    fn recover_index_from_ft(&mut self) -> bool {
        info!("recover index from ft");
        info!("query = {}", self.query);

        let res = self.xr.query(FTQuery::new_with_user("cfg:VedaSystem", &self.query), &mut self.backend.storage);
        if res.result_code == ResultCode::Ok && res.count > 0 {
            //        if let Err(e) = ctx.onto_index.drop() {
            //            error!("failed to clean index: {:?}", e);
            //            return false;
            //       }

            for id in &res.result {
                if let Err(e) = self.onto_index.set(id, &0) {
                    error!("failed to create onto index, err = {:?}", e);
                    break;
                }
            }
        } else {
            error!("failed to search individuals, empty set returned, query: {}", &self.query);
        }

        false
    }

    fn generate_turtle_file(&mut self) -> bool {
        info!("generate TURTLE file using ontology index");

        let mut indvs_count = 0;
        let mut indvs = vec![];

        let mut prefixes = HashMap::new();

        for id in self.onto_index.data.keys() {
            let mut rindv: Individual = Individual::default();
            if self.backend.storage.get_individual(id, &mut rindv) {
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
                error!("failed to read individual {}", id);
            }
        }

        if let Ok(buf) = to_turtle(&indvs, &prefixes) {
            let file_path = self.ontology_file_path.clone() + ".ttl";
            if let Ok(mut file) = File::create(&(file_path)) {
                if let Err(e) = file.write_all(buf.as_slice()) {
                    error!("failed to write to file, err = {:?}", e);
                } else {
                    info!("stored: count = {}, bytes = {}", indvs_count, buf.len());
                    return true;
                }
            } else {
                error!("failed to create file {}", file_path);
            }
        }

        false
    }

    fn generate_json_file(&mut self) -> bool {
        info!("generate JSON file using ontology index");

        let mut indvs_count = 0;
        let mut buf = String::new();

        buf.push('[');

        for id in self.onto_index.data.keys() {
            let mut rindv: Individual = Individual::default();
            if self.backend.storage.get_individual(id, &mut rindv) {
                rindv.parse_all();

                if buf.len() > 1 {
                    buf.push(',');
                    buf.push('\n');
                }

                buf.push_str(&rindv.get_obj().as_json_str());
                indvs_count += 1;
            } else {
                error!("failed to read individual, uri = {}", id);
            }
        }

        buf.push(']');

        if let Ok(mut file) = File::create(&self.ontology_file_path) {
            if let Err(e) = file.write_all(buf.as_bytes()) {
                error!("failed to write to file, err = {:?}", e);
            } else {
                info!("stored: count = {}, bytes = {}", indvs_count, buf.len());
                return true;
            }
        } else {
            error!("failed to create file {}", self.ontology_file_path);
        }

        false
    }
}

fn main() -> std::io::Result<()> {
    init_log("ONTOLOGIST");
    let mut module = Module::new_with_name("ontologist");

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
        query.push('\'');
    }

    let ontology_file_path = "data/ontology.json";

    //wait_load_ontology();

    let path = "./data";

    let module_info = ModuleInfo::new(path, "ontologist", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", &module_info.err());
        return Ok(());
    }

    if get_info_of_module("input-onto").unwrap_or((0, 0)).0 == 0 {
        wait_module("fulltext_indexer", wait_load_ontology());
    }

    let mut backend = Backend::create(StorageMode::ReadOnly, false);

    if let Some(xr) = XapianReader::new("russian", &mut backend.storage) {
        let mut my_module = OntologistModule {
            last_found_changes: Instant::now(),
            query,
            ontology_file_path: ontology_file_path.to_owned(),
            onto_types: onto_types.iter().map(|s| String::from(*s)).collect(),
            onto_index: OntoIndex::load(),
            is_need_generate: false,
            xr,
            module_info: module_info.unwrap(),
            backend,
        };

        if my_module.onto_index.is_empty() {
            my_module.recover_index_from_ft();
            if let Err(e) = my_module.onto_index.dump() {
                error!("failed to flush ontology index, err = {:?}", e);
            }
        }

        module.prepare_queue(&mut my_module);
    } else {
        error!("failed to init ft-query");
    }

    Ok(())
}

fn test_on_onto(queue_element: &mut Individual, onto_types: &[String]) -> Option<(String, i64, bool)> {
    if parse_raw(queue_element).is_ok() {
        let cmd = IndvOp::from_i64(queue_element.get_first_integer("cmd")?);

        let mut prev_state = Individual::default();
        get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

        let mut new_state = Individual::default();
        get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

        if cmd != IndvOp::Remove {
            let is_deleted = new_state.is_exists_bool("v-s:deleted", true);
            if new_state.any_exists_v("rdf:type", onto_types) {
                info!("found ontology changes from storage, uri = {}", new_state.get_id());
                return Some((new_state.get_id().to_owned(), new_state.get_first_integer("v-s:updateCounter").unwrap_or_default(), is_deleted));
            }
        } else if prev_state.any_exists_v("rdf:type", onto_types) {
            info!("found ontology changes from storage, uri = {}", prev_state.get_id());
            return Some((prev_state.get_id().to_owned(), prev_state.get_first_integer("v-s:updateCounter").unwrap_or_default(), true));
        }
    }

    None
}
