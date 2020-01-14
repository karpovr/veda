use crate::individual::*;
use std::collections::{HashMap, HashSet};
use std::fmt;

// TODO: Make Ontology a part of module

// TODO: Cold start on the empty db or a start with new/changed ttl-files.
//  - Primary modules are: `input-onto`, `storage`, `ft-indexer`, `ft-search`, `acl-indexer`(?).
//  - These modules should start first.
//  - Secondary modules are all the rest. They should start processing queue only when ontology is fully loaded.
//  - Otherwise the logical error can occur when ontology in not loaded and module can not capture individuals of desired super class.

// TODO: Load ontology individuals to have them by hand at runtime.

#[derive(PartialEq, Debug)]
pub enum RelType {
    Sub,
    Super,
}

#[derive(Debug)]
pub struct Onto {
    pub relations: HashMap<String, HashMap<String, RelType>>,
}

impl fmt::Display for Onto {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:#?}", self.relations)
    }
}

impl Default for Onto {
    fn default() -> Self {
        Onto {
            relations: HashMap::new(),
        }
    }
}

impl Onto {
    pub fn update(&mut self, indv: &mut Individual) -> bool {
        if let Some(vtype) = indv.get_first_literal("rdf:type") {
            if vtype == "owl:Class"
                || vtype == "rdfs:Class"
                || vtype == "rdf:Property"
                || vtype == "rdfs:Datatype"
                || vtype == "owl:ObjectProperty"
                || vtype == "owl:DatatypeProperty"
            {
                let subs = if vtype == "owl:Class" || vtype == "rdfs:Class" {
                    if let Some(_subclasses) = indv.get_literals("rdfs:subClassOf") {
                        _subclasses
                    } else {
                        Vec::new()
                    }
                } else if vtype == "rdf:Property" || vtype == "owl:ObjectProperty" || vtype == "owl:DatatypeProperty" {
                    if let Some(_subproperties) = indv.get_literals("rdfs:subPropertyOf") {
                        _subproperties
                    } else {
                        Vec::new()
                    }
                } else {
                    Vec::new()
                };

                // if subs.len() > 0 {
                let _onto_el = self.relations.entry(indv.obj.uri.clone()).or_default();

                //                    for sub in subs.clone() {
                //                        let rel_type = onto_el.entry(sub).or_insert(RelType::Super);
                //                        *rel_type = RelType::Super;
                //                    }

                for sub in subs {
                    let onto_el = self.relations.entry(sub).or_default();
                    let rel_type = onto_el.entry(indv.obj.uri.clone()).or_insert(RelType::Sub);
                    *rel_type = RelType::Sub;
                }
            //}
            } else {
                warn!("is not onto element: {}", indv.obj.uri)
            }
        }
        true
    }

    pub fn is_some_entered(&mut self, el: &str, subs: &[&str]) -> bool {
        for sub in subs {
            if self.relations.contains_key(*sub) {
                let onto_el = self.relations.entry((*sub).to_string()).or_default();
                if let Some(rtype) = onto_el.get(el) {
                    if *rtype == RelType::Sub {
                        return true;
                    }
                }
            }
        }

        false
    }

    pub fn get_subs(&mut self, el: &str, collector: &mut HashSet<String>) {
        if self.relations.contains_key(el) {
            let mut buf = Vec::new();
            if let Some(qqq) = self.relations.get(el) {
                for x in qqq.keys() {
                    if !collector.contains(x) {
                        collector.insert(x.to_string());
                        buf.push(x.to_string());
                    }
                }
            }

            for x in buf {
                self.get_subs(&x, collector);
            }
        }
    }

    pub fn update_subs(&mut self, el: &str, subs: &mut HashSet<String>) {
        if self.relations.contains_key(el) {
            let onto_el = self.relations.entry(el.to_string()).or_default();

            for sub in subs.iter() {
                let rel_type = onto_el.entry(sub.to_string()).or_insert(RelType::Sub);
                *rel_type = RelType::Sub;
            }
        }
    }
}
