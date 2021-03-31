#[macro_use]
extern crate log;

use chrono::prelude::*;
use env_logger::Builder;
use ini::Ini;
use log::LevelFilter;
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Write;
use std::io::{BufRead, BufReader};
use std::io::{Error, ErrorKind};
use std::path::Path;
use std::process::{Child, Command};
use std::time::SystemTime;
use std::{fs, io, process, thread, time};
use sysinfo::{get_current_pid, ProcessExt, ProcessStatus, SystemExt};
use v_module::module::*;
use v_module::v_api::app::ResultCode;
use v_module::v_api::*;
use v_module::v_onto::individual::*;

pub const MSTORAGE_ID: i64 = 1;

#[derive(Debug)]
#[repr(u8)]
pub enum ModuleError {
    Fatal = 101,
    Recoverable = 102,
}

#[derive(Debug)]
struct VedaModule {
    name: String,
    exec_name: String,
    args: Vec<String>,
    memory_limit: Option<u64>,
    order: u32,
    is_enabled: bool,
}

struct App {
    date_changed_modules_info: Option<SystemTime>,
    app_dir: String,
    modules_info: HashMap<String, VedaModule>,
    modules_start_order: Vec<String>,
    started_modules: Vec<(String, Child)>,
    module: Module,
    systicket: String,
}

impl App {
    fn start_modules(&mut self) -> io::Result<()> {
        for name in self.modules_start_order.iter() {
            //info!("start {:?}", module);
            let module = self.modules_info.get(name).unwrap();
            match start_module(&module) {
                Ok(child) => {
                    info!("{} start module {}, {}, {:?}", child.id(), module.name, module.exec_name, module.args);
                    self.started_modules.push((module.name.to_owned(), child));
                }
                Err(e) => {
                    return Err(Error::new(ErrorKind::Other, format!("failed to execute {}, err = {:?}", module.exec_name, e)));
                }
            }
        }

        let mut sys = sysinfo::System::new();
        thread::sleep(time::Duration::from_millis(500));
        sys.refresh_processes();

        let mut success_started = 0;
        for (name, process) in self.started_modules.iter() {
            if is_ok_process(&mut sys, process.id()).0 {
                success_started += 1;
            } else {
                error!("failed to start, process = {}, name = {}", process.id(), name)
            }
        }

        if success_started < self.started_modules.len() {
            for (name, process) in self.started_modules.iter_mut() {
                if let Ok(_0) = process.kill() {
                    warn!("stop process {} {}", process.id(), name);
                }
            }

            return Err(Error::new(ErrorKind::Other, "failed to start"));
        }

        Ok(())
    }

    fn watch_started_modules(&mut self) {
        let mut mstorage_watchdog_check_period = None;
        let conf = Ini::load_from_file("veda.properties").expect("failed to load veda.properties file");
        let section = conf.section(None::<String>).expect("failed to parse veda.properties");
        if let Some(p) = section.get("mstorage_watchdog_period") {
            if let Ok(t) = parse_duration::parse(p) {
                mstorage_watchdog_check_period = Some(t);
                info!("started mstorage watchdog, period = {}", p);
            }
        }

        let mut prev_check_mstorage = Utc::now().naive_utc().timestamp();
        loop {
            let mut new_config_modules = HashSet::new();

            if let Err(e) = self.get_modules_info() {
                if e.kind() != ErrorKind::NotFound {
                    error!("failed to read modules info");
                }
            }

            for el in self.modules_start_order.iter() {
                new_config_modules.insert(el.to_owned());
            }

            let mstorage_ready = if let Some(d) = mstorage_watchdog_check_period {
                let now = Utc::now().naive_utc().timestamp();
                if now - prev_check_mstorage > d.as_secs() as i64 {
                    prev_check_mstorage = now;

                    if !self.mstorage_watchdog_check() {
                        error!("detected a problem in module MSTORAGE, restart all modules");
                        false
                    } else {
                        true
                    }
                } else {
                    true
                }
            } else {
                true
            };


            let mut sys = sysinfo::System::new();
            sys.refresh_processes();
            for (name, process) in self.started_modules.iter_mut() {

                let (mut is_ok, memory) = is_ok_process(&mut sys, process.id());

                if !mstorage_ready {
                    if let Ok(_0) = process.kill() {
                        warn!("attempt stop module {} {}", process.id(), name);
                        is_ok = false;
                    }
                }

                debug!("name={}, memory={}", name, memory);
                if !is_ok {
                    let exit_code = if let Ok(c) = process.wait() {
                        c.code().unwrap_or_default()
                    } else {
                        0
                    };

                    if exit_code != ModuleError::Fatal as i32 {
                        error!("found dead module {} {}, exit code = {}, restart this", process.id(), name, exit_code);
                        if let Ok(_0) = process.kill() {
                            warn!("attempt to stop module, process = {}, name = {}", process.id(), name);
                        }

                        if let Some(module) = self.modules_info.get(name) {
                            match start_module(module) {
                                Ok(child) => {
                                    info!("{} restart module {}, {}, {:?}", child.id(), module.name, module.exec_name, module.args);
                                    *process = child;
                                }
                                Err(e) => {
                                    error!("failed to execute, name = {}, err = {:?}", module.exec_name, e);
                                }
                            }
                        } else {
                            error!("failed to find module, name = {}", name);
                        }
                    }
                }
                if let Some(module) = self.modules_info.get(name) {
                    if let Some(memory_limit) = module.memory_limit {
                        if memory > memory_limit {
                            warn!("process = {}, memory = {} KiB, limit = {} KiB", name, memory, memory_limit);
                            if let Ok(_0) = process.kill() {
                                warn!("attempt to stop module, process = {}, name = {}", process.id(), name);
                            }
                        }
                    }
                } else {
                    info!("process {} does not exist in the configuration, it will be killed", name);
                    if let Ok(_0) = process.kill() {
                        warn!("attempt to stop module, process = {}, name = {}", process.id(), name);
                    }
                }
                new_config_modules.remove(name);
            }

            for name in new_config_modules {
                if let Some(module) = self.modules_info.get(&name) {
                    match start_module(&module) {
                        Ok(child) => {
                            info!("{} start module {}, {}, {:?}", child.id(), module.name, module.exec_name, module.args);
                            self.started_modules.push((module.name.to_owned(), child));
                        }
                        Err(e) => {
                            error!("failed to execute, name = {}, err = {:?}", module.exec_name, e);
                        }
                    }
                }
            }

            thread::sleep(time::Duration::from_millis(10000));
        }
    }

    fn mstorage_watchdog_check(&mut self) -> bool{
        if self.systicket.is_empty() {
            while !self.module.api.connect() {
                info!("waiting for main module start...");
                thread::sleep(std::time::Duration::from_millis(100));
            }

            let mut systicket = self.module.get_sys_ticket_id();
            while systicket.is_err() {
                info!("waiting for systicket...");
                thread::sleep(std::time::Duration::from_millis(100));
                systicket = self.module.get_sys_ticket_id();
            }
            self.systicket = systicket.unwrap();
        }

        let test_indv_id = "cfg:watchdog_test";
        let mut test_indv = Individual::default();
        test_indv.set_id(test_indv_id);
        test_indv.set_uri("rdf:type", "v-s:resource");
        if self.module.api.update_use_param(&self.systicket, "", "", MSTORAGE_ID, IndvOp::Put, &mut test_indv).result != ResultCode::Ok {
            error!("failed to store test individual, uri = {}", test_indv.get_id());
            return false;
        }
        true
    }

    fn get_modules_info(&mut self) -> io::Result<()> {
        let f = File::open("veda.modules")?;
        let file = &mut BufReader::new(&f);
        let cur_modifed_date = f.metadata()?.modified()?;

        if let Some(d) = self.date_changed_modules_info {
            if d == cur_modifed_date {
                return Err(Error::new(ErrorKind::NotFound, ""));
            }
        }

        info!("reading modules configuration...");
        self.modules_info.clear();
        self.date_changed_modules_info = Some(cur_modifed_date);
        let mut order = 0;

        while let Some(l) = file.lines().next() {
            if let Ok(line) = l {
                if line.starts_with('#') || line.starts_with('\t') || line.starts_with('\n') || line.starts_with(' ') || line.is_empty() {
                    continue;
                }

                let mut params = HashMap::new();

                while let Some(p) = file.lines().next() {
                    if let Ok(p) = p {
                        if p.starts_with('\t') || p.starts_with(' ') {
                            info!("param = {}", p);
                            if let Some(eq_pos) = p.find('=') {
                                let nm: &str = &p[0..eq_pos].trim();
                                let vl: &str = &p[eq_pos + 1..].trim();

                                params.insert(nm.to_string(), vl.to_string());
                            }
                        } else {
                            break;
                        }
                    }
                }

                let mut module = VedaModule {
                    name: line.to_string(),
                    args: Vec::new(),
                    memory_limit: None,
                    order,
                    is_enabled: true,
                    exec_name: String::new(),
                };
                order += 1;

                if let Some(m) = params.get("args") {
                    let elements: Vec<&str> = m.split(' ').collect();
                    for el in elements {
                        module.args.push(el.to_string());
                    }
                }

                if let Some(m) = params.get("memory-limit") {
                    let elements: Vec<&str> = m.split(' ').collect();
                    if elements.len() == 2 {
                        if let Ok(meml) = elements.get(0).unwrap_or(&"").parse::<i32>() {
                            let m = match elements.get(1).unwrap_or(&"").to_uppercase().as_str() {
                                "GB" => 1024 * 1024,
                                "MB" => 1024,
                                _ => 1,
                            };

                            module.memory_limit = Some((meml * m) as u64);
                            info!("{:?} Kb", module.memory_limit);
                        }
                    }

                    if module.memory_limit.is_none() {
                        error!("failed to parse param [memory-limit]");
                    }
                }

                let module_name = if let Some(m) = params.get("module") {
                    "veda-".to_string() + m
                } else {
                    "veda-".to_string() + line.trim()
                };

                let module_path = self.app_dir.to_owned() + &module_name;
                if Path::new(&module_path).exists() {
                    module.exec_name = module_path;
                    self.modules_info.insert(line, module);
                } else {
                    return Err(Error::new(ErrorKind::Other, format!("failed to find module, path = {:?}", &module_path)));
                }
            }
        }

        let mut vmodules: Vec<&VedaModule> = Vec::new();
        for el in self.modules_info.values() {
            vmodules.push(el);
        }
        vmodules.sort_by(|a, b| a.order.partial_cmp(&b.order).unwrap());

        self.modules_start_order.clear();
        for el in vmodules {
            self.modules_start_order.push(el.name.to_owned());
        }

        Ok(())
    }
}

fn main() {
    let env_var = "RUST_LOG";
    match std::env::var_os(env_var) {
        Some(val) => println!("use env var: {}: {:?}", env_var, val.to_str()),
        None => std::env::set_var(env_var, "info"),
    }

    let app_dir = if let Ok(s) = std::env::var("APPDIR") {
        s.as_str().to_string() + "/"
    } else {
        "./".to_string()
    };

    Builder::new()
        .format(|buf, record| writeln!(buf, "{} [{}] - {}", Local::now().format("%Y-%m-%dT%H:%M:%S%.3f"), record.level(), record.args()))
        .filter(None, LevelFilter::Info)
        .init();

    info!("app dir = {}", app_dir);
    let mut app = App {
        date_changed_modules_info: None,
        app_dir,
        modules_info: HashMap::new(),
        modules_start_order: vec![],
        started_modules: vec![],
        module: Default::default(),
        systicket: "".to_string(),
    };

    if let Err(e) = app.get_modules_info() {
        error!("failed to read modules info, err = {:?}", e);
        return;
    }

    let module_full_names: Vec<String> = app.modules_info.values().map(|x| x.exec_name[2..].to_string()).collect();

    let mut sys = sysinfo::System::new();
    sys.refresh_processes();

    let current_proc = sys.get_process(get_current_pid().unwrap()).unwrap();
    let current_user = current_proc.uid;

    for (pid, proc) in sys.get_processes() {
        if *pid == current_proc.pid() || current_user != proc.uid {
            continue;
        }

        if proc.name().starts_with("veda-") && module_full_names.contains(&proc.name().to_string()) {
            error!("failed to start, found other running process, pid = {}, {:?} ({:?}) ", pid, proc.exe(), proc.status());
            return;
        }
    }

    let started = app.start_modules();
    if started.is_err() {
        error!("failed to start veda, err = {:?}", started.err());
        return;
    }

    if let Ok(mut file) = File::create(".pids/__".to_owned() + "bootstrap-pid") {
        if let Err(e) = file.write_all(format!("{}", process::id()).as_bytes()) {
            error!("failed to create pid file for bootstrap, id = {}, err = {:?}", process::id(), e);
        }
    }

    app.watch_started_modules();
    //info!("started {:?}", started);
}

fn is_ok_process(sys: &mut sysinfo::System, pid: u32) -> (bool, u64) {
    if let Some(proc) = sys.get_process(pid as i32) {
        match proc.status() {
            ProcessStatus::Idle => (true, proc.memory()),
            ProcessStatus::Run => (true, proc.memory()),
            ProcessStatus::Sleep => (true, proc.memory()),
            _ => (false, proc.memory()),
        }
    } else {
        (false, 0)
    }
}

fn start_module(module: &VedaModule) -> io::Result<Child> {
    let datetime: DateTime<Local> = Local::now();

    fs::create_dir_all("./logs").unwrap_or_default();

    let log_path = "./logs/veda-".to_owned() + &module.name + "-" + &datetime.format("%Y-%m-%d %H:%M:%S.%f").to_string() + ".log";
    let std_log_file = File::create(log_path.to_string());
    let err_log_file = File::create(log_path);

    let child = if module.args.is_empty() {
        Command::new(module.exec_name.to_string()).stdout(std_log_file.unwrap()).stderr(err_log_file.unwrap()).spawn()
    } else {
        Command::new(module.exec_name.to_string()).stdout(std_log_file.unwrap()).stderr(err_log_file.unwrap()).args(&module.args).spawn()
    };

    match child {
        Ok(p) => {
            info!("started successfully, module = {}, args = {:?}", module.exec_name.to_string(), &module.args);
            if let Ok(mut file) = File::create(".pids/__".to_owned() + &module.name + "-pid") {
                if let Err(e) = file.write_all(format!("{}", p.id()).as_bytes()) {
                    error!("failed to create pid file, module = {}, process = {}, err = {:?}", &module.name, p.id(), e);
                }
            }
            if module.name == "mstorage" {
                thread::sleep(time::Duration::from_millis(100));
            }
            Ok(p)
        }
        Err(e) => Err(e),
    }
}
