use crate::callback::init_context_with_callback;
use crate::callback::G_VARS;
use crate::common::*;
use crate::common::{collect_js_files, collect_module_dirs, str_2_v8};
use crate::session_cache::CallbackSharedData;
use rusty_v8 as v8;
use rusty_v8::{Context, HandleScope, Isolate, Local};
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use v_module::module::Module;

pub fn script_origin<'a>(s: &mut v8::HandleScope<'a>, resource_name: v8::Local<'a, v8::String>) -> v8::ScriptOrigin<'a> {
    let resource_line_offset = v8::Integer::new(s, 0);
    let resource_column_offset = v8::Integer::new(s, 0);
    let resource_is_shared_cross_origin = v8::Boolean::new(s, false);
    let script_id = v8::Integer::new(s, 123);
    let source_map_url = v8::String::new(s, "").unwrap();
    let resource_is_opaque = v8::Boolean::new(s, true);
    let is_wasm = v8::Boolean::new(s, false);
    let is_module = v8::Boolean::new(s, false);
    v8::ScriptOrigin::new(
        resource_name.into(),
        resource_line_offset,
        resource_column_offset,
        resource_is_shared_cross_origin,
        script_id,
        source_map_url.into(),
        resource_is_opaque,
        is_wasm,
        is_module,
    )
}

impl<'a, T: Default> ScriptInfo<'a, T> {
    pub fn new_with_src(id: &str, src: &str) -> Self {
        Self {
            id: id.to_string(),
            str_script: src.to_string(),
            compiled_script: None,
            dependency: Default::default(),
            context: Default::default(),
        }
    }

    pub fn compile_script(&mut self, js_name: &str, parent_scope: &mut HandleScope<'a>) {
        let source = str_2_v8(parent_scope, &self.str_script);
        let name = v8::String::new(parent_scope, js_name).unwrap();
        let origin = script_origin(parent_scope, name);

        match v8::Script::compile(parent_scope, source, Some(&origin)) {
            Some(script) => {
                self.compiled_script = Some(script);
            }
            None => {
                error!("fail compile script {}", self.str_script);
                self.compiled_script = None;
            }
        }
    }
}

pub struct ScriptsWorkPlace<'a, T> {
    pub scripts: HashMap<String, ScriptInfo<'a, T>>,
    pub scripts_order: Vec<String>,
    pub module: Module,
    pub scope: HandleScope<'a, ()>,
    pub context: Local<'a, Context>,
}

impl<'a, T: Default> ScriptsWorkPlace<'a, T> {
    pub fn load_ext_scripts(&mut self, sys_ticket: &str) {
        let mut modules_de = vec![];
        let mut o_files = vec![];

        collect_module_dirs("./public/modules", &mut modules_de);

        let scripts_location = Module::get_property("scripts_location");

        let scr_lc = if let Some(s) = scripts_location {
            vec![s]
        } else {
            vec!["./public/js/common".to_owned(), "./public/js/server".to_owned()]
        };

        for p in scr_lc.iter() {
            let path = p.to_owned() + "/";
            let seq = path.to_string() + ".seq";

            if Path::new(&seq).exists() {
                match File::open(&seq) {
                    Ok(f) => {
                        let file = BufReader::new(&f);
                        for line in file.lines() {
                            match line {
                                Ok(file_name) => {
                                    if file_name == "$modules" {
                                        for x in modules_de.iter() {
                                            o_files.push(x.to_owned());
                                        }
                                    } else {
                                        collect_js_files(&(path.to_string() + &file_name), &mut o_files);
                                    }
                                }
                                Err(e) => error!("{:?}", e),
                            }
                        }
                    }
                    Err(e) => error!("{:?}", e),
                }
            } else {
                collect_js_files(&path, &mut o_files);
            }
        }

        let mut session_data = CallbackSharedData::default();
        session_data.g_key2attr.insert("$ticket".to_owned(), sys_ticket.to_owned());
        let mut sh_g_vars = G_VARS.lock().unwrap();
        let g_vars = sh_g_vars.get_mut();
        *g_vars = session_data;
        drop(sh_g_vars);

        for x in o_files.iter() {
            match fs::read_to_string(x) {
                Ok(f) => {
                    info!("{}", x);
                    let mut scr_inf: ScriptInfo<T> = ScriptInfo::new_with_src(x, &f);

                    let scope = &mut v8::ContextScope::new(&mut self.scope, self.context);
                    scr_inf.compile_script(x, scope);

                    if let Some(i_script) = scr_inf.compiled_script {
                        i_script.run(scope);
                    }

                    //self.scripts.insert(x.to_owned(), scr_inf);
                }
                Err(e) => error!("{:?}", e),
            }
        }
    }

    pub fn new(isolate: &'a mut Isolate) -> Self {
        let mut scope = v8::HandleScope::new(isolate);

        let context = init_context_with_callback(&mut scope);
        Self {
            scripts: Default::default(),
            scripts_order: vec![],
            module: Module::default(),
            scope,
            context,
        }
    }

    pub fn add_to_order(&mut self, scr_inf: &ScriptInfo<T>) {
        let mut count_find_dependency = 0;
        let mut inserted = false;

        let mut new_scripts_order = vec![];

        for oo in self.scripts_order.iter() {
            if count_find_dependency < scr_inf.dependency.vec.len() {
                if let Some(soo) = self.scripts.get(oo) {
                    for dp in soo.dependency.vec.iter() {
                        if scr_inf.id == *dp {
                            count_find_dependency += 1;
                        }
                    }
                }
            }

            if !inserted && count_find_dependency >= scr_inf.dependency.vec.len() {
                new_scripts_order.push(scr_inf.id.to_owned());
                inserted = true;
            }

            if *oo != scr_inf.id {
                new_scripts_order.push(oo.to_owned());
            }
        }
        if !inserted {
            new_scripts_order.push(scr_inf.id.to_owned());
        }

        self.scripts_order = new_scripts_order;
    }
}
