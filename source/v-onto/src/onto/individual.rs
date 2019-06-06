use crate::msgpack8individual::parse_to_predicate;
use crate::resource::{Resource, Value};
use std::collections::HashMap;
use std::fmt;

pub enum IndividualError {
    None(),
    ParseError(),
}

pub struct Individual {
    pub binobj: Vec<u8>,
    pub uri: String,
    pub resources: HashMap<String, Vec<Resource>>,

    //
    pub cur: u64,
    pub len_predicates: u32,
    pub cur_predicates: u32,
}

impl fmt::Display for Individual {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "uri={}, \n {:#?}", self.uri, self.resources)
    }
}

impl Individual {
    pub fn new(buff: Vec<u8>) -> Individual {
        Individual {
            uri: "".to_string(),
            resources: HashMap::new(),
            binobj: buff,
            cur: 0,
            len_predicates: 0,
            cur_predicates: 0,
        }
    }

    pub fn new_empty() -> Individual {
        Individual {
            uri: "".to_string(),
            resources: HashMap::new(),
            binobj: Vec::new(),
            cur: 0,
            len_predicates: 0,
            cur_predicates: 0,
        }
    }

    pub fn get_predicates(&self) -> Vec<String> {
        return self.resources.iter().map(|(key, _)| key.clone()).collect();
    }

    pub fn get_first_literal(&mut self, predicate: &str) -> Result<String, IndividualError> {
        for _ in 0..2 {
            match self.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Str(s, _l) => {
                        return Ok(s.to_string());
                    }
                    _ => {
                        return Err(IndividualError::ParseError());
                    }
                },
                None => {
                    if self.cur < self.binobj.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, self) == false {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return Err(IndividualError::None());
    }

    pub fn get_first_binobj(&mut self, predicate: &str) -> Result<Vec<u8>, IndividualError> {
        for _ in 0..2 {
            match self.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Binary(s) => {
                        return Ok(s.clone());
                    }
                    _ => {
                        return Err(IndividualError::ParseError());
                    }
                },
                None => {
                    if self.cur < self.binobj.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, self) == false {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return Err(IndividualError::None());
    }

    pub fn get_first_integer(&mut self, predicate: &str) -> Result<i64, IndividualError> {
        for _ in 0..2 {
            match self.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Int(i) => {
                        return Ok(*i);
                    }
                    _ => {}
                },
                None => {
                    if self.cur < self.binobj.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, self) == false {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return Err(IndividualError::None());
    }

    pub fn any_exists(&mut self, predicate: &str, values: &Vec<&str>) -> bool {
        for _ in 0..2 {
            match self.resources.get(predicate) {
                Some(v) => {
                    for el in v {
                        match &el.value {
                            Value::Str(s, _l) => {
                                for ve in values {
                                    if *ve == *s {
                                        return true;
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                None => {
                    if self.cur < self.binobj.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, self) == false {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return false;
    }
}
