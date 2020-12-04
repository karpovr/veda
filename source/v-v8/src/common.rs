use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use rusty_v8 as v8;
use rusty_v8::HandleScope;
use std::collections::HashSet;
use std::fs::DirEntry;
use std::path::Path;
use std::sync::Mutex;
use std::{fs, io};
use v_onto::datatype::Lang;
use v_onto::individual::Individual;
use v_onto::onto::Onto;
use v_onto::resource::Value;
use v_search::common::QueryResult;

pub struct HashVec<String> {
    pub hash: HashSet<String>,
    pub vec: Vec<String>,
}

impl Default for HashVec<String> {
    fn default() -> Self {
        Self {
            hash: Default::default(),
            vec: vec![],
        }
    }
}

impl HashVec<String> {
    pub fn new(src: Vec<String>) -> Self {
        Self {
            hash: src.iter().cloned().collect(),
            vec: src,
        }
    }
}

pub struct ScriptInfo<'a, T> {
    pub id: String,
    pub str_script: String,
    pub compiled_script: Option<v8::Local<'a, v8::Script>>,
    pub dependency: HashVec<String>,
    pub context: T,
}

pub struct ScriptInfoContext {
    pub trigger_by_type: HashVec<String>,
    pub prevent_by_type: HashVec<String>,
    pub trigger_by_uid: HashVec<String>,
    pub run_at: String,
    pub disallow_changing_source: bool,
    pub is_unsafe: bool,
}

impl Default for ScriptInfoContext {
    fn default() -> Self {
        Self {
            trigger_by_type: Default::default(),
            prevent_by_type: Default::default(),
            trigger_by_uid: Default::default(),
            run_at: "".to_string(),
            disallow_changing_source: false,
            is_unsafe: false,
        }
    }
}

lazy_static! {
    pub static ref SYS_TICKET: Mutex<String> = Mutex::new("?".to_owned());
}

pub fn str_2_v8<'sc>(scope: &mut HandleScope<'sc, ()>, s: &str) -> v8::Local<'sc, v8::String> {
    v8::String::new(scope, s).unwrap()
}

pub fn v8_2_str<'sc>(scope: &mut HandleScope<'sc>, s: &v8::Local<'sc, v8::Value>) -> String {
    s.to_string(scope).unwrap().to_rust_string_lossy(scope)
}

pub fn v8obj2individual<'a>(scope: &mut HandleScope<'a>, v8_obj: v8::Local<'a, v8::Object>) -> Individual {
    let mut res = Individual::default();

    v8obj_into_individual(scope, v8_obj, &mut res);

    debug!("res={}", res.to_string());
    res
}

pub fn v8obj_into_individual<'a>(scope: &mut HandleScope<'a>, v8_obj: v8::Local<'a, v8::Object>, mut res: &mut Individual) {
    let data_key = str_2_v8(scope, "data");
    let type_key = str_2_v8(scope, "type");
    let lang_key = str_2_v8(scope, "lang");

    if let Some(j_predicates) = v8_obj.get_property_names(scope) {
        for idx in 0..j_predicates.length() {
            let j_idx = v8::Integer::new(scope, idx as i32);
            let key = j_predicates.get(scope, j_idx.into()).unwrap();
            let predicate = v8_2_str(scope, &key);
            let val = v8_obj.get(scope, key).unwrap();

            if predicate == "@" {
                res.set_id(&v8_2_str(scope, &val));
            } else {
                if val.is_null_or_undefined() {
                    continue;
                }
                if let Some(resources) = val.to_object(scope) {
                    if !resources.is_array() {
                        add_v8_value_obj_to_individual(scope, &predicate, resources, &mut res, data_key, type_key, lang_key);
                    } else if let Some(key_list) = resources.get_property_names(scope) {
                        for resources_idx in 0..key_list.length() {
                            let j_resources_idx = v8::Integer::new(scope, resources_idx as i32);
                            if let Some(v) = resources.get(scope, j_resources_idx.into()) {
                                if let Some(resource) = v.to_object(scope) {
                                    if resource.is_array() {
                                        let idx_0 = v8::Integer::new(scope, 0);
                                        if let Some(v) = resource.get(scope, idx_0.into()) {
                                            if let Some(resource) = v.to_object(scope) {
                                                add_v8_value_obj_to_individual(scope, &predicate, resource, &mut res, data_key, type_key, lang_key);
                                            }
                                        }
                                    } else {
                                        add_v8_value_obj_to_individual(scope, &predicate, resource, &mut res, data_key, type_key, lang_key);
                                    }
                                } else {
                                    error!("v8obj2individual: invalid value predicate[{}], idx={}", predicate, resources_idx);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn add_v8_value_obj_to_individual<'a>(
    scope: &mut HandleScope<'a>,
    predicate: &str,
    resource: v8::Local<v8::Object>,
    res: &mut Individual,
    data_key: v8::Local<v8::String>,
    type_key: v8::Local<v8::String>,
    lang_key: v8::Local<v8::String>,
) {
    let vdata = resource.get(scope, data_key.into()).unwrap();
    let vtype = resource.get(scope, type_key.into()).unwrap();
    if !vtype.is_string() {
        return;
    }

    if let Some(stype) = vtype.to_string(scope) {
        let stype = stype.to_rust_string_lossy(scope);
        match stype.as_str() {
            "Decimal" => {
                if vdata.is_number() && !vdata.is_int32() && !vdata.is_big_int() {
                    if let Some(v) = vdata.to_number(scope) {
                        res.add_decimal_from_f64(&predicate, v.value());
                    }
                } else if vdata.is_int32() || vdata.is_big_int() {
                    if let Some(v) = vdata.to_integer(scope) {
                        res.add_decimal_from_i64(&predicate, v.value());
                    }
                } else if vdata.is_string() {
                    if let Some(v) = vdata.to_string(scope) {
                        res.add_decimal_from_str(&predicate, &v.to_rust_string_lossy(scope));
                    }
                }
            }
            "Integer" => {
                if vdata.is_number() {
                    res.add_integer(&predicate, vdata.integer_value(scope).unwrap());
                } else if vdata.is_string() {
                    if let Some(v) = vdata.to_string(scope) {
                        let sv = v.to_rust_string_lossy(scope);
                        if let Ok(i) = sv.parse::<i64>() {
                            res.add_integer(&predicate, i);
                        } else {
                            error!("v8obj2individual: fail convert {} to int", sv);
                        }
                    }
                } else {
                    error!("v8obj2individual: invalid string in Integer");
                }
            }
            "Datetime" => {
                if vdata.is_number() {
                    if let Some(v) = vdata.to_integer(scope) {
                        res.add_datetime(&predicate, v.value());
                    }
                } else if vdata.is_string() {
                    res.add_datetime_from_str(&predicate, &v8_2_str(scope, &vdata));
                } else if vdata.is_date() {
                    if let Some(v) = vdata.to_integer(scope) {
                        res.add_datetime(&predicate, v.value() / 1000);
                    }
                }
            }
            "Boolean" => {
                if vdata.is_boolean() {
                    res.add_bool(&predicate, vdata.to_integer(scope).unwrap().value() != 0);
                }
            }
            "String" => {
                let lang = if let Some(vlang) = resource.get(scope, lang_key.into()) {
                    Lang::new_from_str(&v8_2_str(scope, &vlang).to_lowercase())
                } else {
                    Lang::NONE
                };

                let sdata = v8_2_str(scope, &vdata);
                res.add_string(&predicate, &sdata, lang);
            }
            "Uri" => {
                let sdata = v8_2_str(scope, &vdata);
                res.add_uri(&predicate, &sdata);
            }
            _ => {
                error!("v8obj2individual: unknown type = {}, predicate[{}]", stype, predicate);
            }
        }
    } else {
        error!("v8obj2individual: type is not string");
    }
}

pub fn query_result2v8obj<'a>(scope: &mut HandleScope<'a>, src: &QueryResult) -> v8::Local<'a, v8::Object> {
    let mut v8_obj = v8::Object::new(scope);

    let v1 = v8::Integer::new(scope, src.count as i32).into();
    let k1 = str_2_v8(scope, "count").into();
    v8_obj.set(scope, k1, v1);

    let js_resources = v8::Array::new(scope, src.result.len() as i32);
    for (idx, el) in src.result.iter().enumerate() {
        let k1 = v8::Integer::new(scope, idx as i32).into();
        let v1 = str_2_v8(scope, el).into();
        js_resources.set(scope, k1, v1);
    }

    let key = str_2_v8(scope, "result").into();
    v8_obj.set(scope, key, js_resources.into());
    set_key_i32_value(scope, &mut v8_obj, "estimated", src.estimated as i32);
    set_key_i32_value(scope, &mut v8_obj, "processed", src.processed as i32);
    set_key_i32_value(scope, &mut v8_obj, "total_time", src.total_time as i32);
    set_key_i32_value(scope, &mut v8_obj, "query_time", src.query_time as i32);
    set_key_i32_value(scope, &mut v8_obj, "authorize_time", src.authorize_time as i32);
    set_key_i32_value(scope, &mut v8_obj, "result_code", src.result_code as i32);
    v8_obj
}

pub fn individual2v8obj<'a>(scope: &mut HandleScope<'a>, src: &mut Individual) -> v8::Local<'a, v8::Object> {
    let mut v8_obj = v8::Object::new(scope);

    set_key_str_value(scope, &mut v8_obj, "@", src.get_id());

    let map_resources = src.get_obj().get_resources();
    for (predicate, resources) in map_resources {
        let js_resources = v8::Array::new(scope, resources.len() as i32);

        for (idx, resource) in resources.iter().enumerate() {
            let mut v8_value = v8::Object::new(scope);
            let key = v8::Integer::new(scope, idx as i32).into();
            js_resources.set(scope, key, v8_value.into());

            match &resource.value {
                Value::Num(m, e) => {
                    let scale = if *e < 0 {
                        (*e * -1) as u32
                    } else {
                        0
                    };

                    let num = if *e > 0 {
                        *m * 10_i64.pow(*e as u32)
                    } else {
                        *m
                    };

                    let d = Decimal::new(num, scale);

                    set_key_f64_value(scope, &mut v8_value, "data", d.to_f64().unwrap_or_default());
                    set_key_str_value(scope, &mut v8_value, "type", "Decimal");
                }
                Value::Int(i) => {
                    if *i < i32::max as i64 {
                        set_key_i32_value(scope, &mut v8_value, "data", *i as i32);
                    } else {
                        set_key_f64_value(scope, &mut v8_value, "data", *i as f64);
                        //                        error!("individual2v8obj: predicate{}, {} > i32.max", predicate, i);
                    }
                    set_key_str_value(scope, &mut v8_value, "type", "Integer");
                }
                Value::Datetime(i) => {
                    let dt = *i;
                    set_key_date_value(scope, &mut v8_value, "data", dt);
                    set_key_str_value(scope, &mut v8_value, "type", "Datetime");
                }
                Value::Bool(b) => {
                    set_key_bool_value(scope, &mut v8_value, "data", *b);
                    set_key_str_value(scope, &mut v8_value, "type", "Boolean");
                }
                Value::Str(s, l) => {
                    if *l != Lang::NONE {
                        set_key_str_value(scope, &mut v8_value, "lang", &l.to_string().to_uppercase());
                    }
                    set_key_str_value(scope, &mut v8_value, "data", s);
                    set_key_str_value(scope, &mut v8_value, "type", "String");
                }
                Value::Uri(s) => {
                    set_key_str_value(scope, &mut v8_value, "data", s);
                    set_key_str_value(scope, &mut v8_value, "type", "Uri");
                }
                _ => {}
            }
        }

        let key = str_2_v8(scope, predicate).into();
        v8_obj.set(scope, key, js_resources.into());
    }

    v8_obj
}

fn set_key_str_value(scope: &mut HandleScope, v8_obj: &mut v8::Local<v8::Object>, key: &str, val: &str) {
    let v8_key = str_2_v8(scope, key).into();
    let v8_val = str_2_v8(scope, val).into();
    v8_obj.set(scope, v8_key, v8_val);
}

fn set_key_bool_value(scope: &mut HandleScope, v8_obj: &mut v8::Local<v8::Object>, key: &str, val: bool) {
    let v8_key = str_2_v8(scope, key).into();
    let v8_val = v8::Boolean::new(scope, val).into();
    v8_obj.set(scope, v8_key, v8_val);
}

fn set_key_i32_value(scope: &mut HandleScope, v8_obj: &mut v8::Local<v8::Object>, key: &str, val: i32) {
    let v8_key = str_2_v8(scope, key).into();
    let v8_val = v8::Integer::new(scope, val).into();
    v8_obj.set(scope, v8_key, v8_val);
}

fn set_key_f64_value(scope: &mut HandleScope, v8_obj: &mut v8::Local<v8::Object>, key: &str, val: f64) {
    let v8_key = str_2_v8(scope, key).into();
    let v8_val = v8::Number::new(scope, val).into();
    v8_obj.set(scope, v8_key, v8_val);
}

fn set_key_date_value(scope: &mut HandleScope, v8_obj: &mut v8::Local<v8::Object>, key: &str, val: i64) {
    let v8_key = str_2_v8(scope, key).into();
    if let Some(v8_val) = v8::Date::new(scope, (val * 1000) as f64) {
        v8_obj.set(scope, v8_key, v8_val.into());
    }
}

fn visit_dirs<T>(in_path: &Path, res: &mut Vec<T>, cb: &dyn Fn(&DirEntry, &mut Vec<T>)) -> io::Result<()> {
    if in_path.is_dir() {
        for entry in fs::read_dir(in_path)? {
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

pub fn collect_module_dirs(in_path: &str, res: &mut Vec<String>) {
    fn prepare_dir(d: &DirEntry, res: &mut Vec<String>) {
        let path = d.path().as_path().to_owned();
        if let Some(path_str) = path.as_os_str().to_str() {
            if path_str.contains("/server/") || path_str.contains("/common/") {
                res.push(path.to_str().unwrap().to_owned());
            }
        }
    }
    visit_dirs(Path::new(&in_path), res, &prepare_dir).unwrap_or_default();
}

pub fn collect_js_files(in_path: &str, res: &mut Vec<String>) {
    fn prepare_dir(d: &DirEntry, res: &mut Vec<String>) {
        let path = d.path().as_path().to_owned();
        if let Some(ext) = path.extension() {
            if let Some(ext) = ext.to_str() {
                if ext != "js" {
                    return;
                }
            }
        } else {
            return;
        }
        res.push(path.to_str().unwrap().to_owned());
    }

    let path = Path::new(&in_path);

    if !path.is_dir() {
        if path.exists() {
            res.push(path.to_str().unwrap().to_owned());
        }
    } else {
        visit_dirs(Path::new(&in_path), res, &prepare_dir).unwrap_or_default();
    }
}

pub fn is_filter_pass(script: &ScriptInfo<ScriptInfoContext>, individual_id: &str, indv_types: &Vec<String>, onto: &mut Onto) -> bool {
    let mut is_pass = false;

    if !script.context.prevent_by_type.vec.is_empty() {
        for indv_type in indv_types.iter() {
            if script.context.prevent_by_type.hash.contains(indv_type) {
                return false;
            }

            if onto.is_some_entered_it(indv_type, script.context.prevent_by_type.vec.iter()) {
                return false;
            }
        }
    }

    if script.context.trigger_by_uid.vec.is_empty() && script.context.trigger_by_type.vec.is_empty() {
        return true;
    }

    if !script.context.trigger_by_uid.vec.is_empty() && script.context.trigger_by_uid.hash.contains(individual_id) {
        is_pass = true;
    }

    if !is_pass && !script.context.trigger_by_type.vec.is_empty() {
        for indv_type in indv_types.iter() {
            if script.context.trigger_by_type.hash.contains(indv_type) {
                is_pass = true;
                break;
            }

            if onto.is_some_entered_it(indv_type, script.context.trigger_by_type.vec.iter()) {
                is_pass = true;
                break;
            }
        }
    }

    return is_pass;
}
