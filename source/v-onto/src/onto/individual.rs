use crate::datatype::{DataType, Lang};
use crate::parser::*;
use crate::resource::{Resource, Value};
use std::collections::HashMap;
use std::fmt;

pub enum IndividualError {
    None,
    ParseError,
}

pub struct RawObj {
    pub data: Vec<u8>,
    pub cur: u64,
    pub len_predicates: u32,
    pub cur_predicates: u32,
    pub raw_type: RawType,
}

impl RawObj {
    pub fn new(buff: Vec<u8>) -> RawObj {
        RawObj {
            data: buff,
            raw_type: RawType::UNKNOWN,
            cur: 0,
            len_predicates: 0,
            cur_predicates: 0,
        }
    }

    pub fn new_empty() -> RawObj {
        RawObj {
            data: Vec::new(),
            raw_type: RawType::UNKNOWN,
            cur: 0,
            len_predicates: 0,
            cur_predicates: 0,
        }
    }
}

pub struct Individual {
    pub uri: String,
    pub resources: HashMap<String, Vec<Resource>>,
}

impl fmt::Display for Individual {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "uri={}, \n {:#?}", self.uri, self.resources)
    }
}

impl Individual {
    pub fn new() -> Individual {
        Individual {
            uri: "".to_string(),
            resources: HashMap::new(),
        }
    }

    pub fn parse_all(&mut self, raw: &mut RawObj) {
        while raw.cur < raw.data.len() as u64 {
            // next parse
            if parse_to_predicate("?", raw, self) == false {
                break;
            }
        }
    }

    pub fn get_predicates(&self) -> Vec<String> {
        return self.resources.iter().map(|(key, _)| key.clone()).collect();
    }

    pub fn get_first_literal(&mut self, raw: &mut RawObj, predicate: &str) -> Result<String, IndividualError> {
        for _ in 0..2 {
            match self.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Str(s, _l) => {
                        return Ok(s.to_string());
                    }
                    _ => {
                        return Err(IndividualError::ParseError);
                    }
                },
                None => {
                    if raw.cur < raw.data.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, raw, self) == false {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return Err(IndividualError::None);
    }

    pub fn get_first_binobj(&mut self, raw: &mut RawObj, predicate: &str) -> Result<Vec<u8>, IndividualError> {
        for _ in 0..2 {
            match self.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Binary(s) => {
                        return Ok(s.clone());
                    }
                    _ => {
                        return Err(IndividualError::ParseError);
                    }
                },
                None => {
                    if raw.cur < raw.data.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, raw, self) == false {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return Err(IndividualError::None);
    }

    pub fn get_first_integer(&mut self, raw: &mut RawObj, predicate: &str) -> Result<i64, IndividualError> {
        for _ in 0..2 {
            match self.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Int(i) => {
                        return Ok(*i);
                    }
                    _ => {}
                },
                None => {
                    if raw.cur < raw.data.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, raw, self) == false {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        return Err(IndividualError::None);
    }

    pub fn any_exists(&mut self, raw: &mut RawObj, predicate: &str, values: &Vec<&str>) -> bool {
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
                    if raw.cur < raw.data.len() as u64 {
                        // next parse
                        if parse_to_predicate(predicate, raw, self) == false {
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

    pub fn add_bool(&mut self, predicate: &str, b: bool, order: u32) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Boolean,
            order: order as u16,
            value: Value::Bool(b),
        });
    }

    pub fn add_datetime(&mut self, predicate: &str, i: i64, order: u32) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Datetime,
            order: order as u16,
            value: Value::Int(i),
        });
    }

    pub fn add_integer(&mut self, predicate: &str, i: i64, order: u32) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Integer,
            order: order as u16,
            value: Value::Int(i),
        });
    }

    pub fn add_decimal_d(&mut self, predicate: &str, mantissa: i64, exponent: i64, order: u32) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Decimal,
            order: order as u16,
            value: Value::Num(mantissa, exponent),
        });
    }

    pub fn add_uri(&mut self, predicate: &str, s: &str, order: u32) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Uri,
            order: order as u16,
            value: Value::Str(s.to_owned(), Lang::NONE),
        });
    }

    pub fn add_string<'a>(&mut self, predicate: &str, s: &str, lang: Lang, order: u32) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::String,
            order: order as u16,
            value: Value::Str(s.to_owned(), lang),
        });
    }
}
