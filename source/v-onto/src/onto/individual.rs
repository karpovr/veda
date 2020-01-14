use crate::datatype::{DataType, Lang};
use crate::parser::*;
use crate::resource::{Resource, Value};
use chrono::offset::LocalResult::Single;
use chrono::{DateTime, Local, NaiveDateTime, TimeZone};
use num::FromPrimitive;
use num_traits::pow;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::fmt;
use std::ops::Sub;
use std::str::FromStr;

#[derive(PartialEq, Debug, Clone)]
pub enum IndividualError {
    None,
    ParseError,
}

pub struct IndividualObj {
    pub(crate) uri: String,
    pub(crate) resources: HashMap<String, Vec<Resource>>,
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
    pub(crate) obj: IndividualObj,
    pub(crate) raw: RawObj,
}

impl Default for Individual {
    fn default() -> Self {
        Individual {
            obj: IndividualObj::default(),
            raw: RawObj::new_empty(),
        }
    }
}

impl Individual {
    pub fn new_raw(raw: RawObj) -> Self {
        Individual {
            obj: IndividualObj::default(),
            raw,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.obj.resources.is_empty()
    }

    pub fn get_obj(&self) -> &IndividualObj {
        &self.obj
    }

    pub fn remove(&mut self, predicate: &str) -> bool {
        self.obj.remove(predicate)
    }

    pub fn clear(&mut self, predicate: &str) {
        self.obj.clear(predicate);
    }

    pub fn add_bool(&mut self, predicate: &str, b: bool) {
        self.obj.add_bool(predicate, b)
    }

    pub fn set_bool(&mut self, predicate: &str, b: bool) {
        self.obj.set_bool(predicate, b)
    }

    pub fn add_datetime(&mut self, predicate: &str, i: i64) {
        self.obj.add_datetime(predicate, i)
    }

    pub fn add_datetime_from_str(&mut self, predicate: &str, value: &str) {
        if value.contains('Z') {
            if let Ok(v) = DateTime::parse_from_rfc3339(&value) {
                self.add_datetime(&predicate, v.timestamp());
            } else {
                error!("fail parse [{}] to datetime", value);
            }
        } else {
            let ndt;
            if value.len() == 10 {
                ndt = NaiveDateTime::parse_from_str(&(value.to_owned() + "T00:00:00"), "%Y-%m-%dT%H:%M:%S");
            } else {
                ndt = NaiveDateTime::parse_from_str(&value, "%Y-%m-%dT%H:%M:%S")
            }

            if let Ok(v) = ndt {
                if let Single(offset) = Local.offset_from_local_datetime(&v) {
                    self.add_datetime(&predicate, v.sub(offset).timestamp());
                } else {
                    self.add_datetime(&predicate, v.timestamp());
                }
            } else {
                error!("fail parse [{}] to datetime", value);
            }
        }
    }

    pub fn set_datetime(&mut self, predicate: &str, i: i64) {
        self.obj.set_datetime(predicate, i)
    }

    pub fn add_binary(&mut self, predicate: &str, v: Vec<u8>) {
        self.obj.add_binary(predicate, v)
    }

    pub fn set_binary(&mut self, predicate: &str, v: Vec<u8>) {
        self.obj.set_binary(predicate, v)
    }

    pub fn add_integer(&mut self, predicate: &str, i: i64) {
        self.obj.add_integer(predicate, i)
    }

    pub fn set_integer(&mut self, predicate: &str, i: i64) {
        self.obj.set_integer(predicate, i)
    }

    pub fn add_decimal_d(&mut self, predicate: &str, mantissa: i64, exponent: i64) {
        self.obj.add_decimal_d(predicate, mantissa, exponent)
    }

    pub fn add_decimal_from_str(&mut self, predicate: &str, value: &str) {
        if let Ok(v) = Decimal::from_str(value) {
            let exp = v.scale() as i32 * -1;
            if let Ok(m) = value.replace('.', "").parse::<i64>() {
                self.add_decimal_d(&predicate, m, exp as i64);
            }
        } else {
            error!("fail parse [{}] to decimal", value);
        }
    }

    pub fn add_decimal_from_i64(&mut self, predicate: &str, value: i64) {
        self.add_decimal_d(&predicate, value, 1);
    }

    pub fn add_decimal_from_f64(&mut self, predicate: &str, value: f64) {
        if let Some(v) = Decimal::from_f64(value) {
            let exp = v.scale() as i32 * -1;
            self.add_decimal_d(&predicate, (value * pow(10, exp as usize) as f64) as i64, exp as i64);
        } else {
            error!("fail parse [{}] to decimal", value);
        }
    }

    pub fn set_decimal_d(&mut self, predicate: &str, mantissa: i64, exponent: i64) {
        self.obj.set_decimal_d(predicate, mantissa, exponent)
    }

    pub fn add_uri(&mut self, predicate: &str, s: &str) {
        self.obj.add_uri(predicate, s)
    }

    pub fn set_uri(&mut self, predicate: &str, s: &str) {
        self.obj.set_uri(predicate, s)
    }

    pub fn set_uris(&mut self, predicate: &str, ss: Vec<String>) {
        self.obj.set_uris(predicate, ss)
    }

    pub fn add_string(&mut self, predicate: &str, s: &str, lang: Lang) {
        self.obj.add_string(predicate, s, lang)
    }

    pub fn set_string(&mut self, predicate: &str, s: &str, lang: Lang) {
        self.obj.set_string(predicate, s, lang)
    }

    pub fn set_raw(&mut self, data: &[u8]) {
        self.raw.data = data.to_vec();
    }

    pub fn get_raw_len(&self) -> usize {
        self.raw.data.len()
    }

    pub fn set_id(&mut self, id: &str) {
        self.obj.uri = id.to_owned();
    }

    pub fn get_id(&self) -> &str {
        &self.obj.uri
    }

    pub fn is_exists(&mut self, predicate: &str) -> bool {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    for el in v {
                        if let Value::Str(_s, _l) = &el.value {
                            return true;
                        } else if let Value::Uri(_s) = &el.value {
                            return true;
                        }
                    }
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        false
    }

    pub fn any_exists(&mut self, predicate: &str, values: &[&str]) -> bool {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    for el in v {
                        if let Value::Str(s, _l) = &el.value {
                            for ve in values {
                                if str::eq(ve, s) {
                                    return true;
                                }
                            }
                        } else if let Value::Uri(s) = &el.value {
                            for ve in values {
                                if str::eq(ve, s) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        false
    }

    pub fn is_exists_bool(&mut self, predicate: &str, value: bool) -> bool {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    for el in v {
                        if let Value::Bool(v) = &el.value {
                            if bool::eq(&value, v) {
                                return true;
                            }
                        }
                    }
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        false
    }

    pub fn get_resources(&mut self, predicate: &str) -> Option<Vec<Resource>> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    return Some(v.iter().map(|el| el.get_copy()).collect::<Vec<Resource>>());
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_literals(&mut self, predicate: &str) -> Option<Vec<String>> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    return Some(
                        v.iter()
                            .map(|el| {
                                if let Value::Str(s, _l) = &el.value {
                                    s.to_string()
                                } else if let Value::Uri(s) = &el.value {
                                    s.to_string()
                                } else {
                                    "".to_string()
                                }
                            })
                            .collect::<Vec<String>>(),
                    );
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_first_literal(&mut self, predicate: &str) -> Option<String> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Str(s, _l) => {
                        return Some(s.to_string());
                    }
                    Value::Uri(s) => {
                        return Some(s.to_string());
                    }
                    _ => {
                        return None;
                    }
                },
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_first_bool(&mut self, predicate: &str) -> Option<bool> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Bool(s) => {
                        return Some(*s);
                    }
                    _ => {
                        return None;
                    }
                },
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_first_binobj(&mut self, predicate: &str) -> Option<Vec<u8>> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => match &v[0].value {
                    Value::Binary(s) => {
                        return Some(s.clone());
                    }
                    _ => {
                        return None;
                    }
                },
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_first_integer(&mut self, predicate: &str) -> Option<i64> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    if let Value::Int(i) = &v[0].value {
                        return Some(*i);
                    }
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_first_number(&mut self, predicate: &str) -> Option<(i64, i64)> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    if let Value::Num(m, e) = &v[0].value {
                        return Some((*m, *e));
                    }
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_first_datetime(&mut self, predicate: &str) -> Option<i64> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    if let Value::Datetime(i) = &v[0].value {
                        return Some(*i);
                    }
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn get_first_float(&mut self, predicate: &str) -> Option<f64> {
        for _ in 0..2 {
            match self.obj.resources.get(predicate) {
                Some(v) => {
                    return Some(v[0].get_float());
                }
                None => {
                    if self.raw.cur < self.raw.data.len() as u64 {
                        // next parse
                        if !parse_to_predicate(predicate, self) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        None
    }

    pub fn parse_all(&mut self) -> &mut Individual {
        while self.raw.cur < self.raw.data.len() as u64 {
            // next parse
            if !parse_to_predicate("?", self) {
                break;
            }
        }

        self
    }

    pub fn apply_predicate_as_set(&mut self, predicate: &str, new_data: &mut Individual) {
        if let Some(v) = new_data.obj.resources.get(predicate) {
            self.obj.set_resources(predicate, v);
        }
    }

    pub fn apply_predicate_as_add_unique(&mut self, predicate: &str, new_data: &mut Individual) {
        if let Some(v) = new_data.obj.resources.get(predicate) {
            self.obj.add_unique_resources(predicate, v);
        }
    }

    pub fn apply_predicate_as_remove(&mut self, predicate: &str, new_data: &mut Individual) {
        let exclude = new_data.get_resources(predicate).unwrap_or_default();

        if let Some(v) = new_data.obj.resources.get(predicate) {
            self.obj.exclude_and_set_resources(predicate, v, &exclude);
        }
    }

    pub fn get_predicates(&mut self) -> Vec<String> {
        self.parse_all();
        let mut res: Vec<String> = Vec::new();

        for (key, _vals) in self.obj.resources.iter() {
            res.push(key.to_string());
        }
        res
    }

    pub fn get_predicates_of_type(&mut self, rtype: DataType) -> Vec<String> {
        self.parse_all();
        let mut res: Vec<String> = Vec::new();

        for (key, vals) in self.obj.resources.iter() {
            for val in vals.iter() {
                if val.rtype == rtype {
                    res.push(key.to_string());
                    break;
                }
            }
        }
        res
    }

    pub fn compare(&self, b: &Individual, ignore_predicates: Vec<&str>) -> bool {
        if self.obj.uri != b.obj.uri {
            return false;
        }

        let keys = self.obj.resources.keys();

        for predicate in keys {
            if ignore_predicates.contains(&predicate.as_str()) {
                continue;
            }

            let a_value = self.obj.resources.get(predicate.as_str());
            let b_value = b.obj.resources.get(predicate.as_str());

            if a_value != b_value {
                //info!("A != B, uri={}, predicate={}, A={:?}, B={:?}", self.obj.uri, predicate, a_value, b_value);
                return false;
            }
        }

        true
    }
}

impl fmt::Display for Individual {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "uri={}, \n {:#?}", self.obj.uri, self.obj.resources)
    }
}

impl Default for IndividualObj {
    fn default() -> Self {
        IndividualObj {
            uri: "".to_string(),
            resources: HashMap::new(),
        }
    }
}

impl IndividualObj {
    //    pub fn get_predicates(&self) -> Vec<String> {
    //        self.resources.iter().map(|(key, _)| key.clone()).collect()
    //    }

    pub fn remove(&mut self, predicate: &str) -> bool {
        self.resources.remove(predicate).is_some()
    }

    pub fn clear(&mut self, predicate: &str) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
    }

    pub fn add_unique_resources(&mut self, predicate: &str, b: &[Resource]) {
        let values = self.resources.entry(predicate.to_owned()).or_default();

        for el in b.iter() {
            if !values.contains(el) {
                values.push(Resource {
                    rtype: el.rtype.clone(),
                    order: el.order,
                    value: el.value.clone(),
                });
            }
        }
    }

    pub fn remove_resources(&mut self, predicate: &str, b: &[Resource]) {
        let values = self.resources.entry(predicate.to_owned()).or_default();

        for el in b.iter() {
            let mut idx = 0;
            let mut is_found = false;
            for elv in values.iter() {
                if elv == el {
                    is_found = true;
                    break;
                }
                idx += 1;
            }

            if is_found {
                values.remove(idx);
            }
        }
    }

    pub fn set_resources(&mut self, predicate: &str, b: &[Resource]) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        for el in b.iter() {
            values.push(Resource {
                rtype: el.rtype.clone(),
                order: el.order,
                value: el.value.clone(),
            });
        }
    }

    pub fn add_resources(&mut self, predicate: &str, b: &[Resource]) {
        let values = self.resources.entry(predicate.to_owned()).or_default();

        for el in b.iter() {
            values.push(Resource {
                rtype: el.rtype.clone(),
                order: values.len() as u16,
                value: el.value.clone(),
            });
        }
    }

    pub fn exclude_and_set_resources(&mut self, predicate: &str, b: &[Resource], exclude: &[Resource]) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        for el in b.iter() {
            if !exclude.contains(el) {
                values.push(Resource {
                    rtype: el.rtype.clone(),
                    order: el.order,
                    value: el.value.clone(),
                });
            }
        }

        if values.is_empty() {
            self.resources.remove(predicate);
        }
    }

    pub fn add_bool(&mut self, predicate: &str, b: bool) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Boolean,
            order: values.len() as u16,
            value: Value::Bool(b),
        });
    }

    pub fn set_bool(&mut self, predicate: &str, b: bool) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        values.push(Resource {
            rtype: DataType::Boolean,
            order: 0,
            value: Value::Bool(b),
        });
    }

    pub fn add_datetime(&mut self, predicate: &str, i: i64) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Datetime,
            order: values.len() as u16,
            value: Value::Datetime(i),
        });
    }

    pub fn set_datetime(&mut self, predicate: &str, i: i64) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        values.push(Resource {
            rtype: DataType::Datetime,
            order: 0,
            value: Value::Datetime(i),
        });
    }

    pub fn add_binary(&mut self, predicate: &str, v: Vec<u8>) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Binary,
            order: values.len() as u16,
            value: Value::Binary(v),
        });
    }

    pub fn set_binary(&mut self, predicate: &str, v: Vec<u8>) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        values.push(Resource {
            rtype: DataType::Binary,
            order: 0,
            value: Value::Binary(v),
        });
    }

    pub fn add_integer(&mut self, predicate: &str, i: i64) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Integer,
            order: values.len() as u16,
            value: Value::Int(i),
        });
    }

    pub fn set_integer(&mut self, predicate: &str, i: i64) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        values.push(Resource {
            rtype: DataType::Integer,
            order: 0,
            value: Value::Int(i),
        });
    }

    pub fn add_decimal_d(&mut self, predicate: &str, mantissa: i64, exponent: i64) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Decimal,
            order: values.len() as u16,
            value: Value::Num(mantissa, exponent),
        });
    }

    pub fn set_decimal_d(&mut self, predicate: &str, mantissa: i64, exponent: i64) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        values.push(Resource {
            rtype: DataType::Decimal,
            order: 0,
            value: Value::Num(mantissa, exponent),
        });
    }

    pub fn add_uri(&mut self, predicate: &str, s: &str) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::Uri,
            order: values.len() as u16,
            value: Value::Uri(s.to_owned()),
        });
    }

    pub fn set_uri(&mut self, predicate: &str, s: &str) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        values.push(Resource {
            rtype: DataType::Uri,
            order: 0,
            value: Value::Uri(s.to_owned()),
        });
    }

    pub fn set_uris(&mut self, predicate: &str, ss: Vec<String>) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        for s in ss {
            values.push(Resource {
                rtype: DataType::Uri,
                order: 0,
                value: Value::Uri(s.to_owned()),
            });
        }
    }

    pub fn add_string(&mut self, predicate: &str, s: &str, lang: Lang) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.push(Resource {
            rtype: DataType::String,
            order: values.len() as u16,
            value: Value::Str(s.to_owned(), lang),
        });
    }

    pub fn set_string(&mut self, predicate: &str, s: &str, lang: Lang) {
        let values = self.resources.entry(predicate.to_owned()).or_default();
        values.clear();
        values.push(Resource {
            rtype: DataType::String,
            order: 0,
            value: Value::Str(s.to_owned(), lang),
        });
    }
}
