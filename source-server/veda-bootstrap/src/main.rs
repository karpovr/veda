#[macro_use]
extern crate log;

use chrono::prelude::*;
use env_logger::Builder;
use log::LevelFilter;
use nix::sys::signal::{self, Signal};
use nix::unistd::Pid;
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Write;
use std::io::{BufRead, BufReader};
use std::io::{Error, ErrorKind};
use std::path::Path;
use std::process::{Child, Command};
use std::time::{Duration, SystemTime};
use std::{fs, io, process, thread, time};
use sysinfo::{get_current_pid, ProcessExt, ProcessStatus, SystemExt};
use teloxide::prelude::*;
use teloxide::types::Recipient;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::Module;
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::Individual;
use v_common::v_api::api_client::IndvOp;

pub const MSTORAGE_ID: i64 = 1;

#[derive(Debug)]
#[repr(u8)]
pub enum ModuleError {
    Fatal = 101,
    Recoverable = 102,
}

#[derive(Debug)]
struct VedaModule {
    alias_name: String,
    exec_name: String,
    module_name: String,
    args: Vec<String>,
    memory_limit: Option<u64>,
    order: u32,
    watchdog_timeout: Option<u64>,
    module_info: Option<ModuleInfo>,
}

struct App {
    date_changed_modules_info: Option<SystemTime>,
    app_dir: String,
    modules_info: HashMap<String, VedaModule>,
    modules_start_order: Vec<String>,
    started_modules: Vec<(String, Child)>,
    backend: Backend,
    sys_ticket: String,
    tg: Option<TelegramDest>,
}

struct TelegramDest {
    tg_notify_token: String,
    tg_notify_chat_id: i64,
}

impl App {
    async fn start_modules(&mut self) -> io::Result<()> {
        for name in self.modules_start_order.iter() {
            //info!("start {:?}", module);
            let module = self.modules_info.get(name).unwrap();
            match start_module(module).await {
                Ok(child) => {
                    info!("pid = {}", child.id());
                    self.started_modules.push((module.alias_name.to_owned(), child));
                },
                Err(e) => {
                    return Err(Error::new(ErrorKind::Other, format!("failed to execute {}, err = {:?}", module.exec_name, e)));
                },
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
                log_err_and_to_tg(&self.tg, &format!("failed to start, process = {}, name = {}", process.id(), name)).await;
            }
        }

        if success_started < self.started_modules.len() {
            for (name, process) in self.started_modules.iter_mut() {
                if signal::kill(Pid::from_raw(process.id() as i32), Signal::SIGTERM).is_ok() {
                    warn!("stop process {} {}", process.id(), name);
                }
            }

            return Err(Error::new(ErrorKind::Other, "failed to start"));
        }

        Ok(())
    }

    async fn watch_started_modules(&mut self) {
        let mut mstorage_watchdog_check_period = None;
        if let Some(p) = Module::get_property("mstorage_watchdog_period") {
            if let Ok(t) = parse_duration::parse(&p) {
                mstorage_watchdog_check_period = Some(t);
                info!("started mstorage watchdog, period = {}", p);
            }
        }

        let mut prev_check_mstorage = Utc::now().naive_utc().timestamp();
        loop {
            let mut new_config_modules = HashSet::new();

            if let Err(e) = self.get_modules_info() {
                if e.kind() != ErrorKind::NotFound {
                    log_err_and_to_tg(&self.tg, "failed to read modules info").await;
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
                        log_err_and_to_tg(&self.tg, "detected a problem in module MSTORAGE, restart all modules").await;
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
                let mut need_check = true;
                let (mut is_ok, memory) = is_ok_process(&mut sys, process.id());

                if !mstorage_ready && signal::kill(Pid::from_raw(process.id() as i32), Signal::SIGTERM).is_ok() {
                    warn!("attempt stop module {} {}", process.id(), name);
                    is_ok = false;
                }

                debug!("name={}, memory={}", name, memory);
                if !is_ok {
                    let exit_code = if let Ok(c) = process.wait() {
                        c.code().unwrap_or_default()
                    } else {
                        0
                    };

                    if exit_code != ModuleError::Fatal as i32 {
                        log_err_and_to_tg(&self.tg, &format!("found dead module {} {}, exit code = {}, restart this", process.id(), name, exit_code)).await;

                        if signal::kill(Pid::from_raw(process.id() as i32), Signal::SIGTERM).is_ok() {
                            warn!("attempt to stop module, process = {}, name = {}", process.id(), name);
                        }

                        if let Some(module) = self.modules_info.get(name) {
                            match start_module(module).await {
                                Ok(child) => {
                                    info!("{} restart module {}, {}, {:?}", child.id(), module.alias_name, module.exec_name, module.args);
                                    *process = child;
                                    need_check = false;
                                },
                                Err(e) => {
                                    log_err_and_to_tg(&self.tg, &format!("failed to execute, name = {}, err = {:?}", module.exec_name, e)).await;
                                },
                            }
                        } else {
                            log_err_and_to_tg(&self.tg, &format!("failed to find module, name = {}", name)).await;
                        }
                    }
                }
                if let Some(module) = self.modules_info.get_mut(name) {
                    if need_check {
                        if let Some(memory_limit) = module.memory_limit {
                            if memory > memory_limit {
                                warn!("process = {}, memory = {} KiB, limit = {} KiB", name, memory, memory_limit);
                                if signal::kill(Pid::from_raw(process.id() as i32), Signal::SIGTERM).is_ok() {
                                    warn!("attempt to stop module, process = {}, name = {}", process.id(), name);
                                }
                            }
                        }

                        if let Some(timeout) = module.watchdog_timeout {
                            if module.module_info.is_none() {
                                match ModuleInfo::new("./data", &module.alias_name, false) {
                                    Ok(m) => {
                                        module.module_info = Some(m);
                                    },
                                    Err(e) => {
                                        error!("fail open info file {}, err={:?}", module.alias_name, e)
                                    },
                                }
                            }

                            if let Some(m) = &module.module_info {
                                if let Ok(tm) = m.read_modified() {
                                    if tm + Duration::from_secs(timeout) < SystemTime::now() {
                                        let now: DateTime<Utc> = SystemTime::now().into();
                                        let a: DateTime<Utc> = (tm + Duration::from_secs(timeout)).into();
                                        warn!("watchdog: modified + timeout ={},  now={}", a.format("%d/%m/%Y %T"), now.format("%d/%m/%Y %T"));
                                        if signal::kill(Pid::from_raw(process.id() as i32), Signal::SIGTERM).is_ok() {
                                            warn!("attempt to stop module, process = {}, name = {}", process.id(), name);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    info!("process {} does not exist in the configuration, it will be killed", name);
                    if signal::kill(Pid::from_raw(process.id() as i32), Signal::SIGTERM).is_ok() {
                        warn!("attempt to stop module, process = {}, name = {}", process.id(), name);
                    }
                }

                new_config_modules.remove(name);
            }

            for name in new_config_modules {
                if let Some(module) = self.modules_info.get(&name) {
                    match start_module(module).await {
                        Ok(child) => {
                            info!("{} start module {}, {}, {:?}", child.id(), module.alias_name, module.exec_name, module.args);
                            self.started_modules.push((module.alias_name.to_owned(), child));
                        },
                        Err(e) => {
                            log_err_and_to_tg(&self.tg, &format!("failed to execute, name = {}, err = {:?}", module.exec_name, e)).await;
                        },
                    }
                }
            }

            thread::sleep(time::Duration::from_millis(10000));
        }
    }

    fn mstorage_watchdog_check(&mut self) -> bool {
        if self.sys_ticket.is_empty() {
            while !self.backend.mstorage_api.connect() {
                info!("waiting for main module start...");
                thread::sleep(std::time::Duration::from_millis(100));
            }

            let mut systicket = self.backend.get_sys_ticket_id();
            while systicket.is_err() {
                info!("waiting for systicket...");
                thread::sleep(std::time::Duration::from_millis(100));
                systicket = self.backend.get_sys_ticket_id();
            }
            self.sys_ticket = systicket.unwrap();
        }

        let test_indv_id = "cfg:watchdog_test";
        let mut test_indv = Individual::default();
        test_indv.set_id(test_indv_id);
        test_indv.set_uri("rdf:type", "v-s:resource");
        if self.backend.mstorage_api.update_use_param(&self.sys_ticket, "", "", MSTORAGE_ID, IndvOp::Put, &test_indv).is_err() {
            error!("failed to store test individual, uri = {}", test_indv_id);
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
                            //info!("param = {}", p);
                            if let Some(eq_pos) = p.find('=') {
                                let nm: &str = p[0..eq_pos].trim();
                                let vl: &str = p[eq_pos + 1..].trim();

                                params.insert(nm.to_string(), vl.to_string());
                            }
                        } else {
                            break;
                        }
                    }
                }

                let mut module = VedaModule {
                    alias_name: line.to_string(),
                    args: Vec::new(),
                    memory_limit: None,
                    order,
                    exec_name: String::new(),
                    watchdog_timeout: None,
                    module_info: None,
                    module_name: String::new(),
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
                        if let Ok(meml) = elements.first().unwrap_or(&"").parse::<i32>() {
                            let m = match elements.get(1).unwrap_or(&"").to_uppercase().as_str() {
                                "GB" => 1024 * 1024,
                                "MB" => 1024,
                                _ => 1,
                            };

                            module.memory_limit = Some((meml * m) as u64);
                            //info!("{:?} Kb", module.memory_limit);
                        }
                    }

                    if module.memory_limit.is_none() {
                        error!("failed to parse param [memory-limit]");
                    }
                }

                if let Some(m) = params.get("watchdog-timeout") {
                    let elements: Vec<&str> = m.split(' ').collect();
                    if elements.len() == 1 {
                        if let Ok(v) = elements.first().unwrap_or(&"").parse::<i32>() {
                            module.watchdog_timeout = Some(v as u64);
                            //info!("watchdog_timeout {:?} s", module.watchdog_timeout);
                        }
                    }

                    if module.watchdog_timeout.is_none() {
                        error!("failed to parse param [watchdog_timeout]");
                    }
                }

                module.module_name = if let Some(m) = params.get("module") {
                    m.to_owned()
                } else {
                    line.trim().to_owned()
                };

                let module_path = format!("{}veda-{}", self.app_dir, module.module_name);
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
            self.modules_start_order.push(el.alias_name.to_owned());
        }

        Ok(())
    }
}

#[tokio::main]
async fn main() {
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
        backend: Default::default(),
        sys_ticket: "".to_string(),
        tg: None,
    };

    if let (Some(v), Some(t)) = (Module::get_property("tg_notify_chat_id"), Module::get_property("tg_notify_token")) {
        if let Ok(d) = v.parse::<i64>() {
            app.tg = Some(TelegramDest {
                tg_notify_token: t,
                tg_notify_chat_id: d,
            });
        }
    } else {
        warn!("sending notifications to Telegram is not available.");
    }

    if let Err(e) = app.get_modules_info() {
        error!("failed to read modules info, err = {:?}", e);
        return;
    }

    let mut sys = sysinfo::System::new();
    sys.refresh_processes();

    let current_proc = sys.get_process(get_current_pid().unwrap()).unwrap();
    let current_user = current_proc.uid;

    for (pid, proc) in sys.get_processes() {
        if *pid == current_proc.pid() || current_user != proc.uid {
            continue;
        }

        if proc.name().starts_with("veda-") && app.modules_info.values().map(|x| x.exec_name[2..].to_string()).any(|x| x == *proc.name()) {
            error!("failed to start, found other running process, pid = {}, {:?} ({:?}) ", pid, proc.exe(), proc.status());
            return;
        }
    }

    let started = app.start_modules().await;
    if started.is_err() {
        log_err_and_to_tg(&app.tg, &format!("failed to start veda, err = {:?}", &started.err())).await;
        return;
    }

    if let Ok(mut file) = File::create(".pids/__".to_owned() + "bootstrap-pid") {
        if let Err(e) = file.write_all(format!("{}", process::id()).as_bytes()) {
            error!("failed to create pid file for bootstrap, id = {}, err = {:?}", process::id(), e);
        }
    }

    app.watch_started_modules().await;
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

async fn log_err_and_to_tg(tg: &Option<TelegramDest>, text: &str) {
    error!("{}", text);
    send_msg_to_tg(tg, &format!("ERROR: {}", text)).await;
}

async fn send_msg_to_tg(tg: &Option<TelegramDest>, text: &str) {
    if let Some(t) = tg {
        let bot = Bot::new(t.tg_notify_token.to_owned()).auto_send();
        let chat_id = Recipient::Id(ChatId(t.tg_notify_chat_id));

        if let Err(e) = bot.send_message(chat_id, text).await {
            error!("fail send message to telegram: err={:?}", e);
        }
    }
}

async fn start_module(module: &VedaModule) -> io::Result<Child> {
    let datetime: DateTime<Local> = Local::now();

    fs::create_dir_all("./logs").unwrap_or_default();

    let log_path = "./logs/veda-".to_owned() + &module.alias_name + "-" + &datetime.format("%Y-%m-%d %H:%M:%S.%f").to_string() + ".log";
    let std_log_file = File::create(&log_path);
    let err_log_file = File::create(log_path);

    let mut args = module.args.clone();
    args.push(format!("--module-name={}", module.alias_name));

    let child = Command::new(&module.exec_name).stdout(std_log_file.unwrap()).stderr(err_log_file.unwrap()).args(&args).spawn();

    match child {
        Ok(p) => {
            info!("START *** {}", module.alias_name);
            info!("module exec path = {}", module.exec_name);

            if !&module.args.is_empty() {
                info!("args = {:?}", &module.args);
            }

            if let Some(v) = &module.memory_limit {
                info!("memory-limit = {} Kb", v);
            }

            if let Some(v) = &module.watchdog_timeout {
                info!("watchdog_timeout = {} s", v);
            }

            if let Ok(mut file) = File::create(".pids/__".to_owned() + &module.alias_name + "-pid") {
                if let Err(e) = file.write_all(format!("{}", p.id()).as_bytes()) {
                    error!("failed to create pid file, module = {}, process = {}, err = {:?}", &module.alias_name, p.id(), e);
                }
            }
            if module.alias_name == "mstorage" {
                thread::sleep(time::Duration::from_millis(100));
            }
            Ok(p)
        },
        Err(e) => Err(e),
    }
}
