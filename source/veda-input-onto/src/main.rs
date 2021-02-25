#[macro_use]
extern crate log;

use md5::{Digest, Md5};
use notify::{DebouncedEvent, RecommendedWatcher, RecursiveMode, Result as NotifyResult, Watcher};
use rio_api::model::Literal::{LanguageTaggedString, Simple, Typed};
use rio_api::model::NamedOrBlankNode;
use rio_api::model::Term::{BlankNode, Literal, NamedNode};
use rio_api::parser::TriplesParser;
use rio_turtle::{TurtleError, TurtleParser};
use ron::de::from_reader;
use ron::ser::{to_string_pretty, PrettyConfig};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fmt::Formatter;
use std::fs::{DirEntry, File};
use std::io::BufReader;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::{fmt, fs, io};
use std::{thread, time as std_time};
use v_module::common::*;
use v_module::info::ModuleInfo;
use v_module::module::*;
use v_module::v_api::app::ResultCode;
use v_module::v_api::*;
use v_module::v_onto::datatype::Lang;
use v_module::v_onto::individual::Individual;
use v_module::v_onto::onto::*;

#[derive(Serialize, Deserialize)]
struct FileHash {
    data: HashMap<String, String>,
}

struct Prefixes {
    namespaces2id: HashMap<String, String>,
    id2orignamespaces: HashMap<String, String>,
    id2namespaces: HashMap<String, String>,
}

impl Default for Prefixes {
    fn default() -> Self {
        Self {
            namespaces2id: HashMap::new(),
            id2orignamespaces: HashMap::new(),
            id2namespaces: HashMap::new(),
        }
    }
}

impl fmt::Display for Prefixes {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{:#?}", self.namespaces2id)
    }
}

fn main() -> NotifyResult<()> {
    init_log("INPUT_ONTO");

    let module_info = ModuleInfo::new("./data", "input-onto", true);
    if module_info.is_err() {
        error!("{:?}", module_info.err());
        return Ok(());
    }
    let mut module_info = module_info.unwrap();

    let mut module = Module::default();

    while !module.api.connect() {
        info!("wait for start of main module ...");
        thread::sleep(std::time::Duration::from_millis(100));
    }

    let onto_path = "ontology".to_owned();

    let mut onto = Onto::default();
    info!("load onto start");
    load_onto(&mut module.storage, &mut onto);
    info!("load onto end");

    info!("start prepare files");

    let systicket;
    if let Ok(t) = module.get_sys_ticket_id() {
        systicket = t;
    } else {
        error!("failed to get systicket");
        return Ok(());
    }

    let mut list_files: Vec<PathBuf> = Vec::new();
    collect_file_paths(&onto_path, &mut list_files);

    let mut new_hashes_set: FileHash = FileHash {
        data: HashMap::new(),
    };
    for el in list_files.iter() {
        if let Some(s) = el.to_str() {
            if let Ok(hash) = get_hash_of_file(s) {
                new_hashes_set.data.insert(s.to_owned(), hash);
            }
        }
    }

    let prev_hashes_set: FileHash;
    let path_files_hashes = onto_path.clone() + "/files_hashes.ron";
    if let Ok(f) = File::open(&path_files_hashes) {
        match from_reader(f) {
            Ok(x) => prev_hashes_set = x,
            Err(e) => {
                error!("failed to load files_hashes: {}", e);
                prev_hashes_set = FileHash {
                    data: HashMap::new(),
                }
            }
        };
    } else {
        prev_hashes_set = FileHash {
            data: HashMap::new(),
        }
    }

    let mut list_candidate_files: Vec<PathBuf> = Vec::new();
    if onto.relations.is_empty() {
        info!("ontology is not found");
        for el in list_files.iter() {
            list_candidate_files.push(el.to_owned());
        }
    } else {
        for el in list_files.iter() {
            if let Some(s) = el.to_str() {
                let new_hash = new_hashes_set.data.get(s);
                let prev_hash = prev_hashes_set.data.get(s);

                if prev_hash.is_none() && new_hash.is_some() {
                    info!("found new file {}", s);
                    list_candidate_files.push(el.to_owned());
                } else if prev_hash.is_some() && new_hash.is_none() {
                    info!("found deleted file {}", s);
                } else if prev_hash.unwrap() != new_hash.unwrap() {
                    info!("found changes in file {}", s);
                    list_candidate_files.push(el.to_owned());
                }
            }
        }
    }

    if !list_candidate_files.is_empty() {
        processing_files(list_candidate_files, &mut new_hashes_set.data, &mut module, &systicket, &mut module_info);
        store_hash_list(&new_hashes_set, &path_files_hashes);
    }

    loop {
        info!("start files watcher");
        let (tx, rx) = channel();
        let mut watcher: RecommendedWatcher = Watcher::new(tx, std_time::Duration::from_secs(5))?;
        watcher.watch(onto_path.clone(), RecursiveMode::Recursive)?;

        let mut prepared_count = 0;

        loop {
            match rx.recv_timeout(std_time::Duration::from_secs(30)) {
                Ok(event) => match event {
                    DebouncedEvent::Create(ref path) | DebouncedEvent::Write(ref path) => {
                        info!("changed: {:?}", event);
                        if processing_files(vec![path.clone()], &mut new_hashes_set.data, &mut module, &systicket, &mut module_info) > 0 {
                            store_hash_list(&new_hashes_set, &path_files_hashes);
                        }
                        prepared_count += 1;
                    }
                    _ => {
                        prepared_count += 1;
                        info!("ignore: {:?}", event);
                    }
                },
                Err(_) => {
                    if prepared_count > 0 {
                        info!("files watcher timeout");
                        std::mem::drop(watcher);
                        break;
                    }
                }
            };
        }
    }
}

fn store_hash_list(new_hashes_set: &FileHash, path_files_hashes: &str) {
    if !new_hashes_set.data.is_empty() {
        if let Ok(mut file) = File::create(path_files_hashes) {
            if let Err(e) = file.write_all(to_string_pretty(&new_hashes_set, PrettyConfig::default()).unwrap_or_default().as_bytes()) {
                error!("failed to write hashes of ttl files, err={}", e);
            }
        } else {
            error!("failed to create hashes of ttl files");
        }
    }
}

fn get_hash_of_file(file_path: &str) -> io::Result<String> {
    let mut rfile = File::open(&file_path)?;
    let mut hasher = Md5::new();
    io::copy(&mut rfile, &mut hasher)?;
    Ok(hex::encode(hasher.result()).to_uppercase())
}

fn extract_path_and_name(path: &PathBuf) -> Option<(&str, &str)> {
    let sfp;
    if let Some(s) = path.to_str() {
        sfp = s;
    } else {
        return None;
    }

    if let Some(s) = path.file_name() {
        if let Some(ss) = s.to_str() {
            return Some((sfp, ss));
        }
    }

    None
}

fn processing_files(files_paths: Vec<PathBuf>, hash_list: &mut HashMap<String, String>, module: &mut Module, systicket: &str, module_info: &mut ModuleInfo) -> i32 {
    let mut committed_op_id = 0;
    let mut cur_op_id = 0;

    if let Some((_op_id, _c_op_id)) = module_info.read_info() {
        committed_op_id = _c_op_id;
        cur_op_id = _op_id;
    }

    if let Err(e) = module_info.put_info(cur_op_id, cur_op_id) {
        info!("failed to write module info, err={}", e);
    }

    let mut count_prepared_ttl_files = 0;
    let mut file2indv: HashMap<String, HashMap<String, Individual>> = HashMap::new();
    let mut priority_list: Vec<(i64, String, String)> = Vec::new();

    let mut prefixes = Prefixes::default();

    for file_path_buf in files_paths {
        let file_path = file_path_buf.to_str().unwrap_or_default().to_string();
        if let Some(ext) = file_path_buf.extension() {
            if let Some(ext) = ext.to_str() {
                if ext != "ttl" {
                    continue;
                }
            }
        }

        let path;
        let name;
        if let Some(w) = extract_path_and_name(&file_path_buf) {
            path = w.0;
            name = w.1;
        } else {
            continue;
        }

        let mut file_need_for_load = true;
        let mut file_info_indv: Individual = Individual::default();
        let new_id = "d:".to_string() + name;

        let new_hash = match get_hash_of_file(path) {
            Ok(new_h) => {
                info!("HASH:{}", new_h);
                hash_list.remove(&file_path);
                hash_list.insert(file_path, new_h.clone());
                count_prepared_ttl_files += 1;
                if module.get_individual(&new_id, &mut file_info_indv).is_some() {
                    if let Some(old_h) = file_info_indv.get_first_literal("v-s:hash") {
                        if old_h == new_h {
                            file_need_for_load = false;
                        }
                    }
                }
                Some(new_h)
            }
            Err(e) => {
                error!("failed to calculate HASH of file {}, err={}", &path, e);
                None
            }
        };
        file_info_indv.set_id(&new_id);

        if file_need_for_load {
            let mut individuals = file2indv.entry(path.to_owned()).or_default();
            if let Some((onto_id, _onto_url, load_priority)) = parse_file(path, &mut individuals, &mut prefixes) {
                //        info!("ontology: {} {} {}", &file, onto_id, load_priority);
                full_file_info_indv(&onto_id, individuals, &mut file_info_indv, new_hash, path, name);
                priority_list.push((load_priority, onto_id, path.to_owned()));
            } else {
                error!("failed to parse");
            }
        }
    }

    info!("load prefixes: {}", prefixes);
    let mut loaded_owl_ontology = HashSet::new();

    priority_list.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    //info!("priority_list: {:?}", priority_list);

    for (load_priority, _onto_id, path) in priority_list {
        if let Some(indvs) = file2indv.get_mut(&path) {
            for indv_file in indvs.values_mut() {
                if !indv_file.is_exists("rdf:type") {
                    error!("{}: [{}] does not contain [rdf:type], ignore it !!!", path, indv_file.get_id());
                    continue;
                }

                let is_need_store = if let Some(indv_db) = module.get_individual(indv_file.get_id(), &mut Individual::default()) {
                    indv_db.parse_all();
                    !indv_db.compare(indv_file, vec!["v-s:updateCounter", "v-s:previousVersion", "v-s:actualVersion", "v-s:fullUrl"])
                } else {
                    true
                };

                if is_need_store {
                    if indv_file.any_exists("rdf:type", &["owl:Ontology"]) {
                        loaded_owl_ontology.insert(indv_file.get_id().to_owned());
                    }

                    let res = module.api.update(systicket, IndvOp::Put, &indv_file);

                    // thread::sleep(std::time::Duration::from_millis(100));

                    if res.result != ResultCode::Ok {
                        error!("failed to update, {}, file={}, uri={}, result_code={:?}", load_priority, path, indv_file.get_id(), res.result);
                    } else {
                        info!("successful update, {}, file={}, uri={}", load_priority, path, indv_file.get_id());
                        cur_op_id = res.op_id;
                        if let Err(e) = module_info.put_info(cur_op_id, committed_op_id) {
                            info!("failed to write module info, err={}", e);
                        }
                    }
                }
            }
        }
    }

    for (prefix, full_url) in prefixes.id2namespaces.iter() {
        if !loaded_owl_ontology.contains(prefix) {
            warn!("prefix not found {}, generate individual", prefix);
            let mut prefix_indv = Individual::default();
            prefix_indv.set_id(prefix);
            prefix_indv.set_uri("rdf:type", "owl:Ontology");
            let mut url = full_url.to_owned();

            if !full_url.ends_with('/') {
                url += "/";
            }

            prefix_indv.set_string("v-s:fullUrl", &url, Lang::NONE);
            let res = module.api.update(systicket, IndvOp::Put, &prefix_indv);
            if res.result != ResultCode::Ok {
                error!("failed to store {}", prefix_indv.get_obj().as_json_str());
            }
        }
    }

    committed_op_id = cur_op_id;
    if let Err(e) = module_info.put_info(committed_op_id, committed_op_id) {
        info!("failed to write module info, err={}", e);
    }

    info!("end prepare {} files", file2indv.len());
    count_prepared_ttl_files
}

fn full_file_info_indv(onto_id: &str, individuals: &mut HashMap<String, Individual>, new_indv: &mut Individual, hash: Option<String>, path: &str, name: &str) {
    if let Some(h) = hash {
        new_indv.set_string("v-s:hash", &h, Lang::NONE);
    }
    new_indv.set_uri("rdf:type", "v-s:TTLFile");
    //    new_indv.obj.set_uri("v-s:created", Resource(DataType.Datetime, Clock.currTime().toUnixTime()));
    new_indv.set_uri("v-s:filePath", path);
    new_indv.set_uri("v-s:fileUri", name);
    new_indv.clear("v-s:resource");

    for indv in individuals.values_mut() {
        new_indv.add_uri("v-s:resource", &indv.get_id());

        if !indv.is_exists("rdfs:isDefinedBy") {
            indv.set_uri("rdfs:isDefinedBy", onto_id);
        }
    }
}

fn parse_file(file_path: &str, individuals: &mut HashMap<String, Individual>, prefixes: &mut Prefixes) -> Option<(String, String, i64)> {
    if let Ok(file) = File::open(file_path) {
        let mut parser = TurtleParser::new(BufReader::new(file), None);

        let mut onto_id = String::default();
        let mut onto_url = String::default();
        let mut load_priority = 999;

        loop {
            for ns in &parser.namespaces {
                if !prefixes.namespaces2id.contains_key(ns.1) {
                    if let Some(s) = ns.1.get(0..ns.1.len() - 1) {
                        prefixes.namespaces2id.insert(s.to_owned(), ns.0.clone());
                        prefixes.id2orignamespaces.insert(ns.0.to_owned() + ":", ns.1.to_owned());
                        prefixes.id2namespaces.insert(ns.0.to_owned() + ":", s.to_string());
                    }
                }
            }

            let mut id = String::default();
            let mut idx = 0;
            let res = parser.parse_step(&mut |t| {
                let subject = match t.subject {
                    NamedOrBlankNode::BlankNode(n) => n.id,
                    NamedOrBlankNode::NamedNode(n) => n.iri,
                };

                let s = to_prefix_form(&subject, &prefixes.namespaces2id);
                if s.is_empty() {
                    error!("invalid subject={:?}", subject);
                }

                let indv = individuals.entry(s.to_owned()).or_default();

                if indv.get_id().is_empty() {
                    id.insert_str(0, &s);
                    indv.set_id(&s);
                }

                let predicate = to_prefix_form(t.predicate.iri, &prefixes.namespaces2id);

                //info!("[{:?}]", predicate);
                match t.object {
                    BlankNode(n) => error!("BlankNode {}", n.id),
                    NamedNode(n) => indv.add_uri(&predicate, &to_prefix_form(n.iri, &prefixes.namespaces2id)),

                    Literal(l) => match l {
                        Simple {
                            value,
                        } => indv.add_string(&predicate, value, Lang::NONE),
                        LanguageTaggedString {
                            value,
                            language,
                        } => indv.add_string(&predicate, value, Lang::new_from_str(language)),
                        Typed {
                            value,
                            datatype,
                        } => match datatype.iri.replace("#", "/").as_str() {
                            "http://www.w3.org/2001/XMLSchema/string" => {
                                indv.add_string(&predicate, value, Lang::NONE);
                            }
                            "http://www.w3.org/2001/XMLSchema/nonNegativeInteger" => {
                                if let Ok(v) = value.parse::<i64>() {
                                    indv.add_integer(&predicate, v);
                                } else {
                                    error!("fail parse [{}] to integer", value);
                                }
                            }
                            "http://www.w3.org/2001/XMLSchema/integer" => {
                                if let Ok(v) = value.trim().parse::<i64>() {
                                    indv.add_integer(&predicate, v);
                                } else {
                                    error!("fail parse [{}] to integer", value);
                                }
                            }
                            "http://www.w3.org/2001/XMLSchema/boolean" => {
                                if let Ok(v) = value.parse::<bool>() {
                                    indv.add_bool(&predicate, v);
                                } else {
                                    error!("fail parse [{}] to bool", value);
                                }
                            }
                            "http://www.w3.org/2001/XMLSchema/decimal" => {
                                indv.add_decimal_from_str(&predicate, value);
                            }
                            "http://www.w3.org/2001/XMLSchema/dateTime" => {
                                indv.add_datetime_from_str(&predicate, value);
                            }
                            _ => {
                                error!("unknown type {}", datatype.iri);
                            }
                        },
                    },
                }

                idx += 1;
                Ok(()) as Result<(), TurtleError>
            });

            if let Err(e) = res {
                error!("fail parse {}, err={}", file_path, e);
                break;
            }

            if !id.is_empty() {
                let indv = individuals.entry(id).or_default();

                if indv.get_id().is_empty() {
                    error!("individual not content uri");
                }

                if indv.any_exists("rdf:type", &["owl:Ontology"]) {
                    if let Some(v) = indv.get_first_integer("v-s:loadPriority") {
                        load_priority = v;
                    }

                    if let Some(s) = prefixes.id2orignamespaces.get(indv.get_id()) {
                        indv.set_string("v-s:fullUrl", &s, Lang::NONE);
                    }

                    if let Some(s) = prefixes.id2namespaces.get(indv.get_id()) {
                        onto_url.insert_str(0, s.as_str());
                    }

                    onto_id.insert_str(0, indv.get_id());
                }
            }

            if parser.is_end() {
                break;
            }
        }

        debug!("{}, load {}", file_path, individuals.len());
        return Some((onto_id, onto_url, load_priority));
    }
    None
}

fn to_prefix_form(iri: &str, namespaces2id: &HashMap<String, String>) -> String {
    let mut res = String::default();

    if let Some(s) = namespaces2id.get(iri) {
        res.push_str(s);
        res.push(':');
        return res;
    }

    let pos = if let Some(pos) = iri.rfind(|c| c == '#' || c == '/') {
        pos
    } else {
        return iri.to_owned();
    };

    if let Some(s) = iri.get(0..pos) {
        if let Some(s) = namespaces2id.get(s) {
            res.push_str(s);
            res.push(':');
            if let Some(s) = iri.get(pos + 1..) {
                res.push_str(s);
            }
        } else {
            return iri.to_owned();
        }
    }

    res
}

fn collect_file_paths(onto_path: &str, res: &mut Vec<PathBuf>) {
    fn prepare_file(d: &DirEntry, res: &mut Vec<PathBuf>) {
        let path = d.path().as_path().to_owned();
        if let Some(ext) = path.extension() {
            if let Some(ext) = ext.to_str() {
                if ext != "ttl" {
                    return;
                }
            }
        } else {
            return;
        }
        if let Ok(p) = path.canonicalize() {
            res.push(p);
        }
    }
    visit_dirs(Path::new(&onto_path), res, &prepare_file).unwrap_or_default();
}

fn visit_dirs(dir: &Path, res: &mut Vec<PathBuf>, cb: &dyn Fn(&DirEntry, &mut Vec<PathBuf>)) -> io::Result<()> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                visit_dirs(&path, res, cb)?;
            } else {
                cb(&entry, res);
            }
        }
    }
    Ok(())
}
