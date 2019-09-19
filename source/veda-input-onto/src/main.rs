#[macro_use]
extern crate log;

use chrono::Local;
use chrono::NaiveDateTime;
use crossbeam_channel::unbounded;
use env_logger::Builder;
use log::LevelFilter;
use notify::{RecommendedWatcher, RecursiveMode, Result as NotifyResult, Watcher};
use rio_api::model::Literal::{LanguageTaggedString, Simple, Typed};
use rio_api::model::NamedOrBlankNode;
use rio_api::model::Term::{BlankNode, Literal, NamedNode};
use rio_api::parser::TriplesParser;
use rio_turtle::{TurtleError, TurtleParser};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::fs::{DirEntry, File};
use std::io::BufReader;
use std::io::Write;
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;
use std::{fs, io};
use v_module::module::*;
use v_module::onto::*;
use v_onto::datatype::Lang;
use v_onto::individual::Individual;
use v_onto::onto::*;

fn main() -> NotifyResult<()> {
    let env_var = "RUST_LOG";
    match std::env::var_os(env_var) {
        Some(val) => println!("use env var: {}: {:?}", env_var, val.to_str()),
        None => std::env::set_var(env_var, "info"),
    }

    Builder::new()
        .format(|buf, record| writeln!(buf, "{} [{}] - {}", Local::now().format("%Y-%m-%dT%H:%M:%S%.3f"), record.level(), record.args()))
        .filter(None, LevelFilter::Info)
        .init();

    let mut module = Module::default();

    let systicket;
    if let Ok(t) = module.get_sys_ticket_id() {
        systicket = t;
    } else {
        error!("fail get systicket");
        return Ok(());
    }

    let mut list_candidate_files: Vec<String> = Vec::new();

    let onto_path = "ontology".to_owned();

    let mut onto = Onto::default();
    info!("load onto start");
    load_onto(&mut module.fts, &mut module.storage, &mut onto);
    info!("load onto end");
    if !onto.relations.is_empty() {
        info!("ontology not found");
        collect_file_paths(&onto_path, &mut list_candidate_files);
    }

    info!("prepare {} files", list_candidate_files.len ());

    if !list_candidate_files.is_empty() {
        processing_files(list_candidate_files);
    }

    info!("watch file changes...");

    let (tx, rx) = unbounded();
    let mut watcher: RecommendedWatcher = Watcher::new(tx, Duration::from_secs(2))?;

    watcher.watch(onto_path, RecursiveMode::Recursive)?;

    loop {
        match rx.recv() {
            Ok(event) => println!("changed: {:?}", event),
            Err(err) => println!("watch error: {:?}", err),
        };
    }
}

fn collect_file_paths(onto_path: &str, res: &mut Vec<String>) {
    fn prepare_file(d: &DirEntry, res: &mut Vec<String>) {
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
        if let Some(path) = path.to_str() {
            res.push(path.to_owned());
        }
    }
    visit_dirs(Path::new(&onto_path), res, &prepare_file).unwrap_or_default();
}

fn processing_files(files: Vec<String>) {
    for file in files {
        parse_file(&file);
    }
}

fn parse_file(file_path: &str) {
    let mut individuals: HashMap<String, Individual> = HashMap::new();

    let mut parser = TurtleParser::new(BufReader::new(File::open(file_path).unwrap()), "").unwrap();

    let mut namespaces: HashMap<String, String> = HashMap::new();
    loop {
        for ns in &parser.namespaces {
            if !namespaces.contains_key(ns.1) {
                if let Some(s) = ns.1.get(0..ns.1.len() - 1) {
                    namespaces.insert(s.to_owned(), ns.0.clone());
                }
            }
        }

        let res = parser.parse_step(&mut |t| {
            //info!("namespaces: {:?}", namespaces);

            let indv;

            let subject = match t.subject {
                NamedOrBlankNode::BlankNode(n) => n.id,
                NamedOrBlankNode::NamedNode(n) => n.iri,
            };

            let s = to_prefix_form(&subject, &namespaces);
            if s.is_empty() {
                error!("invalid subject={:?}", subject);
            }

            indv = individuals.entry(s.to_owned()).or_default();

            if indv.obj.uri.is_empty() {
                indv.obj.uri = s;
            }

            let predicate = to_prefix_form(t.predicate.iri, &namespaces);

            //info!("[{:?}]", predicate);
            match t.object {
                BlankNode(n) => error!("BlankNode {}", n.id),
                NamedNode(n) => indv.obj.add_uri(&predicate, &to_prefix_form(n.iri, &namespaces), 0),

                Literal(l) => match l {
                    Simple {
                        value,
                    } => indv.obj.add_string(&predicate, value, Lang::NONE, 0),
                    LanguageTaggedString {
                        value,
                        language,
                    } => indv.obj.add_string(&predicate, value, Lang::from_str(language), 0),
                    Typed {
                        value,
                        datatype,
                    } => match datatype.iri {
                        "http://www.w3.org/2001/XMLSchema#string" => {
                            indv.obj.add_string(&predicate, value, Lang::NONE, 0);
                        }
                        "http://www.w3.org/2001/XMLSchema#nonNegativeInteger" => {
                            if let Ok(v) = value.parse::<i64>() {
                                indv.obj.add_integer(&predicate, v, 0);
                            } else {
                                error!("fail parse [{}] to integer", value);
                            }
                        }
                        "http://www.w3.org/2001/XMLSchema#integer" => {
                            if let Ok(v) = value.trim().parse::<i64>() {
                                indv.obj.add_integer(&predicate, v, 0);
                            } else {
                                error!("fail parse [{}] to integer", value);
                            }
                        }
                        "http://www.w3.org/2001/XMLSchema#boolean" => {
                            if let Ok(v) = value.parse::<bool>() {
                                indv.obj.add_bool(&predicate, v, 0);
                            } else {
                                error!("fail parse [{}] to bool", value);
                            }
                        }
                        "http://www.w3.org/2001/XMLSchema#decimal" => {
                            let qq = Decimal::from_str(value);
                            if let Ok(v) = qq {
                                let exp = v.scale() as i32 * -1;
                                if let Ok(m) = value.replace('.', "").parse::<i64>() {
                                    indv.obj.add_decimal_d(&predicate, m, exp as i64, 0);
                                    //                                    info!("{}{}", m, exp);
                                }
                            } else {
                                error!("fail parse [{}] to decimal", value);
                            }
                        }
                        "http://www.w3.org/2001/XMLSchema#dateTime" => {
                            let vv = normalize_datetime_string(value);
                            if let Ok(v) = NaiveDateTime::parse_from_str(&vv, "%Y-%m-%dT%H:%M:%S") {
                                indv.obj.add_datetime(&predicate, v.timestamp(), 0);
                            } else {
                                error!("fail parse [{}] to datetime", value);
                            }
                        }
                        _ => {
                            error!("unknown type {}", datatype.iri);
                        }
                    },
                },
            }

            Ok(()) as Result<(), TurtleError>
        });

        if let Err(e) = res {
            error!("fail parse {}, err={}", file_path, e);
            break;
        }

        if parser.is_end() {
            break;
        }
    }

    //info!("{}, load {}", file_path, individuals.len());

    //for (_, value) in individuals {
    //    info!("ind: {}", value);
    //}
}

fn to_prefix_form(iri: &str, namespaces: &HashMap<String, String>) -> String {
    let mut res = String::default();

    if let Some(s) = namespaces.get(iri) {
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
        if let Some(s) = namespaces.get(s) {
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

fn visit_dirs(dir: &Path, res: &mut Vec<String>, cb: &dyn Fn(&DirEntry, &mut Vec<String>)) -> io::Result<()> {
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

fn normalize_datetime_string(d: &str) -> String {
    if d.len() == 24 {
        if let Some(v) = d.get(0..d.len() - 5) {
            return v.to_owned();
        }
    } else if d.len() == 10 {
        return d.to_owned() + "T00:00:00";
    } else {
        if d.ends_with('Z') {
            if let Some(v) = d.get(0..d.len() - 1) {
                return v.to_owned();
            }
        }
    }
    d.to_owned()
}
