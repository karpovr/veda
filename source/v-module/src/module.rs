use crate::info::ModuleInfo;
use crate::ticket::Ticket;
use chrono::Local;
use chrono::{NaiveDateTime, Utc};
use env_logger::Builder;
use ini::Ini;
use log::LevelFilter;
use nng::options::protocol::pubsub::Subscribe;
use nng::options::Options;
use nng::options::RecvTimeout;
use nng::{Protocol, Socket};
use std::io::Write;
use std::process;
use std::time::Duration;
use std::{thread, time};
use uuid::Uuid;
use v_api::*;
use v_onto::datatype::Lang;
use v_onto::individual::*;
use v_onto::individual2msgpack::to_msgpack;
use v_onto::parser::*;
use v_queue::{consumer::*, record::*};
use v_search::*;
use v_storage::storage::*;

#[derive(Debug)]
#[repr(u8)]
pub enum PrepareError {
    Fatal = 101,
    Recoverable = 102,
}

const TICKS_TO_UNIX_EPOCH: i64 = 62135596800000;

pub struct Module {
    pub storage: VStorage,
    pub fts: FTClient,
    pub api: APIClient,
    queue_prepared_count: i64,
    notify_channel_url: String,
}

impl Default for Module {
    fn default() -> Self {
        Module::new(StorageMode::ReadOnly)
    }
}

impl Module {
    pub fn new(storage_mode: StorageMode) -> Self {
        let conf = Ini::load_from_file("veda.properties").expect("fail load veda.properties file");

        let section = conf.section(None::<String>).expect("fail parse veda.properties");
        let ft_query_service_url = section.get("ft_query_service_url").expect("param [ft_query_service_url] not found in veda.properties").clone();

        let tarantool_addr = if let Some(p) = section.get("tarantool_url") {
            p.to_owned()
        } else {
            warn!("param [tarantool_url] not found in veda.properties");
            "".to_owned()
        };

        if !tarantool_addr.is_empty() {
            info!("tarantool addr={}", &tarantool_addr);
        }

        let notify_channel_url = if let Some(s) = section.get("notify_channel_url") {
            s.to_owned()
        } else {
            String::default()
        };

        let storage: VStorage;
        if !tarantool_addr.is_empty() {
            storage = VStorage::new_tt(tarantool_addr, "veda6", "123456");
        } else {
            storage = VStorage::new_lmdb("./data", storage_mode);
        }

        let ft_client = FTClient::new(ft_query_service_url);

        let param_name = "main_module_url";
        let api = if let Some(url) = Module::get_property(param_name) {
            APIClient::new(url)
        } else {
            error!("not found param {} in properties file", param_name);
            APIClient::new("".to_owned())
        };

        Module {
            storage,
            fts: ft_client,
            api,
            queue_prepared_count: 0,
            notify_channel_url,
        }
    }
}

impl Module {
    pub fn get_property(param: &str) -> Option<String> {
        let conf = Ini::load_from_file("veda.properties").expect("fail load veda.properties file");

        let section = conf.section(None::<String>).expect("fail parse veda.properties");
        if let Some(v) = section.get(param) {
            Some(v.to_string())
        } else {
            None
        }
    }

    pub fn get_sys_ticket_id_from_db(storage: &mut VStorage) -> Result<String, i32> {
        let mut indv = Individual::default();
        if storage.get_individual_from_db(StorageId::Tickets, "systicket", &mut indv) {
            if let Some(c) = indv.get_first_literal("v-s:resource") {
                return Ok(c);
            }
        }
        Err(-1)
    }

    pub fn get_sys_ticket_id(&mut self) -> Result<String, i32> {
        Module::get_sys_ticket_id_from_db(&mut self.storage)
    }

    pub fn get_literal_of_link(&mut self, indv: &mut Individual, link: &str, field: &str, to: &mut Individual) -> Option<String> {
        if let Some(v) = indv.get_literals(link) {
            for el in v {
                if self.storage.get_individual(&el, to) {
                    return to.get_first_literal(field);
                }
            }
        }
        None
    }

    pub fn get_literals_of_link(&mut self, indv: &mut Individual, link: &str, field: &str) -> Vec<String> {
        let mut res = Vec::new();
        if let Some(v) = indv.get_literals(link) {
            for el in v {
                let to = &mut Individual::default();
                if self.storage.get_individual(&el, to) {
                    if let Some(s) = to.get_first_literal(field) {
                        res.push(s);
                    }
                }
            }
        }
        res
    }

    pub fn get_datetime_of_link(&mut self, indv: &mut Individual, link: &str, field: &str, to: &mut Individual) -> Option<i64> {
        if let Some(v) = indv.get_literals(link) {
            for el in v {
                if self.storage.get_individual(&el, to) {
                    return to.get_first_datetime(field);
                }
            }
        }
        None
    }

    pub fn get_individual_h(&mut self, uri: &str) -> Option<Box<Individual>> {
        let mut iraw = Box::new(Individual::default());
        if !self.storage.get_individual(uri, &mut iraw) {
            return None;
        }
        Some(iraw)
    }

    pub fn get_individual<'a>(&mut self, uri: &str, iraw: &'a mut Individual) -> Option<&'a mut Individual> {
        if uri.is_empty() || !self.storage.get_individual(uri, iraw) {
            return None;
        }
        Some(iraw)
    }

    pub fn listen_queue<T>(
        &mut self,
        queue_consumer: &mut Consumer,
        module_info: &mut ModuleInfo,
        module_context: &mut T,
        before_batch: &mut fn(&mut Module, &mut T),
        prepare: &mut fn(&mut Module, &mut ModuleInfo, &mut T, &mut Individual) -> Result<(), PrepareError>,
        after_batch: &mut fn(&mut Module, &mut T),
    ) {
        let mut soc = Socket::new(Protocol::Sub0).unwrap();
        let mut is_ready_notify_channel = false;
        let mut count_timeout_error = 0;

        loop {
            if !is_ready_notify_channel && !self.notify_channel_url.is_empty() {
                soc = Socket::new(Protocol::Sub0).unwrap();
                if let Err(e) = soc.set_opt::<RecvTimeout>(Some(Duration::from_secs(30))) {
                    error!("fail set timeout, {} err={}", self.notify_channel_url, e);
                }

                if let Err(e) = soc.dial(&self.notify_channel_url) {
                    error!("fail connect to, {} err={}", self.notify_channel_url, e);
                } else {
                    let all_topics = vec![];
                    if let Err(e) = soc.set_opt::<Subscribe>(all_topics) {
                        error!("fail subscribe, {} err={}", self.notify_channel_url, e);
                        soc.close();
                        is_ready_notify_channel = false;
                    } else {
                        info!("success subscribe on queue changes: {}", self.notify_channel_url);
                        is_ready_notify_channel = true;
                    }
                }
            }

            let mut size_batch = 0;

            before_batch(self, module_context);

            // read queue current part info
            if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
                error!("{} get_info_of_part {}: {}", self.queue_prepared_count, queue_consumer.id, e.as_str());
                continue;
            }

            if queue_consumer.queue.count_pushed - queue_consumer.count_popped == 0 {
                // if not new messages, read queue info
                queue_consumer.queue.get_info_queue();

                if queue_consumer.queue.id > queue_consumer.id {
                    size_batch = 1;
                }
            } else if queue_consumer.queue.count_pushed - queue_consumer.count_popped > 0 {
                if queue_consumer.queue.id != queue_consumer.id {
                    size_batch = 1;
                } else {
                    size_batch = queue_consumer.queue.count_pushed - queue_consumer.count_popped;
                }
            }

            if size_batch > 0 {
                debug!("queue: batch size={}", size_batch);
            }

            for _it in 0..size_batch {
                // пробуем взять из очереди заголовок сообщения
                if !queue_consumer.pop_header() {
                    break;
                }

                let mut raw = RawObj::new(vec![0; (queue_consumer.header.msg_length) as usize]);

                // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
                if let Err(e) = queue_consumer.pop_body(&mut raw.data) {
                    if e == ErrorQueue::FailReadTailMessage {
                        break;
                    } else {
                        error!("{} get msg from queue: {}", self.queue_prepared_count, e.as_str());
                        break;
                    }
                }

                let mut queue_element = Individual::new_raw(raw);
                if parse_raw(&mut queue_element).is_ok() {
                    if let Err(e) = prepare(self, module_info, module_context, &mut queue_element) {
                        process::exit(e as i32);
                    }
                }

                queue_consumer.commit_and_next();

                self.queue_prepared_count += 1;

                if self.queue_prepared_count % 1000 == 0 {
                    info!("get from queue, count: {}", self.queue_prepared_count);
                }
            }
            after_batch(self, module_context);

            let wmsg = soc.recv();
            if let Err(e) = wmsg {
                error!("fail recv from queue notify channel, err={:?}", e);

                if count_timeout_error > 0 && size_batch > 0 {
                    warn!("queue changed but we not received notify message, need reconnect...");
                    is_ready_notify_channel = false;
                    count_timeout_error += 1;
                }
            } else {
                count_timeout_error = 0;
            }
        }
    }
}

pub fn get_inner_binobj_as_individual<'a>(queue_element: &'a mut Individual, field_name: &str, new_indv: &'a mut Individual) -> bool {
    let binobj = queue_element.get_first_binobj(field_name);
    if binobj.is_some() {
        new_indv.set_raw(&binobj.unwrap_or_default());
        if parse_raw(new_indv).is_ok() {
            return true;
        }
    }
    false
}

pub fn get_cmd(queue_element: &mut Individual) -> Option<IndvOp> {
    let wcmd = queue_element.get_first_integer("cmd");
    wcmd?;

    Some(IndvOp::from_i64(wcmd.unwrap_or_default()))
}

pub fn init_log() {
    let env_var = "RUST_LOG";
    match std::env::var_os(env_var) {
        Some(val) => println!("use env var: {}: {:?}", env_var, val.to_str()),
        None => std::env::set_var(env_var, "info"),
    }

    Builder::new()
        .format(|buf, record| writeln!(buf, "{} [{}] - {}", Local::now().format("%Y-%m-%dT%H:%M:%S%.3f"), record.level(), record.args()))
        .filter(None, LevelFilter::Info)
        .init();
}

pub fn get_ticket_from_db(id: &str, dest: &mut Ticket, module: &mut Module) {
    let mut indv = Individual::default();
    if module.storage.get_individual_from_db(StorageId::Tickets, id, &mut indv) {
        dest.update_from_individual(&mut indv);
        dest.result = ResultCode::Ok;
    }
}

pub fn create_new_ticket(login: &str, user_id: &str, duration: i32, ticket: &mut Ticket, storage: &mut VStorage) {
    let mut ticket_indv = Individual::default();

    ticket.result = ResultCode::FailStore;
    ticket_indv.add_string("rdf:type", "ticket:ticket", Lang::NONE);

    if !ticket.id.is_empty() && !ticket.id.is_empty() {
        ticket_indv.set_id(&ticket.id);
    } else {
        ticket_indv.set_id(&Uuid::new_v4().to_hyphenated().to_string());
    }

    ticket_indv.add_string("ticket:login", login, Lang::NONE);
    ticket_indv.add_string("ticket:accessor", user_id, Lang::NONE);

    let now = Utc::now();
    let start_time_str = format!("{:?}", now.naive_utc());

    if start_time_str.len() > 28 {
        ticket_indv.add_string("ticket:when", &start_time_str[0..28], Lang::NONE);
    } else {
        ticket_indv.add_string("ticket:when", &start_time_str, Lang::NONE);
    }

    ticket_indv.add_string("ticket:duration", &duration.to_string(), Lang::NONE);

    let mut raw1: Vec<u8> = Vec::new();
    if to_msgpack(&ticket_indv, &mut raw1).is_ok() && storage.put_kv_raw(StorageId::Tickets, ticket_indv.get_id(), raw1) {
        ticket.update_from_individual(&mut ticket_indv);
        ticket.result = ResultCode::Ok;
        ticket.start_time = (TICKS_TO_UNIX_EPOCH + now.timestamp_millis()) * 10_000;
        ticket.end_time = ticket.start_time + duration as i64 * 10_000_000;

        let end_time_str = format!("{:?}", NaiveDateTime::from_timestamp((ticket.end_time / 10_000 - TICKS_TO_UNIX_EPOCH) / 1_000, 0));
        info!("create new ticket {}, login={}, user={}, start={}, end={}", ticket.id, ticket.user_login, ticket.user_uri, start_time_str, end_time_str);
    } else {
        error!("fail store ticket {:?}", ticket)
    }
}

pub fn create_sys_ticket(storage: &mut VStorage) -> Ticket {
    let mut ticket = Ticket::default();
    create_new_ticket("veda", "cfg:VedaSystem", 90_000_000, &mut ticket, storage);

    if ticket.result == ResultCode::Ok {
        let mut sys_ticket_link = Individual::default();
        sys_ticket_link.set_id("systicket");
        sys_ticket_link.add_uri("rdf:type", "rdfs:Resource");
        sys_ticket_link.add_uri("v-s:resource", &ticket.id);
        let mut raw1: Vec<u8> = Vec::new();
        if to_msgpack(&sys_ticket_link, &mut raw1).is_ok() && storage.put_kv_raw(StorageId::Tickets, sys_ticket_link.get_id(), raw1) {
            return ticket;
        } else {
            error!("fail store system ticket link")
        }
    } else {
        error!("fail create sys ticket")
    }

    ticket
}

pub fn get_info_of_module(module_name: &str) -> Option<(i64, i64)> {
    let module_info = ModuleInfo::new("./data", module_name, false);
    if module_info.is_err() {
        error!("fail open info of [{}], err={:?}", module_name, module_info.err());
        return None;
    }

    let mut info = module_info.unwrap();
    info.read_info()
}

pub fn wait_load_ontology() -> i64 {
    wait_module("input-onto", 1)
}

pub fn wait_module(module_name: &str, wait_op_id: i64) -> i64 {
    if wait_op_id < 0 {
        error!("wait module [{}] to complete op_id={}", module_name, wait_op_id);
        return -1;
    }

    info!("wait module [{}] to complete op_id={}", module_name, wait_op_id);
    loop {
        let module_info = ModuleInfo::new("./data", module_name, false);
        if module_info.is_err() {
            error!("fail open info of [{}], err={:?}", module_name, module_info.err());
            thread::sleep(time::Duration::from_millis(300));
            continue;
        }

        let mut info = module_info.unwrap();
        loop {
            if let Some((_, committed)) = info.read_info() {
                if committed >= wait_op_id {
                    return committed;
                }
                info!("wait module [{}] to complete op_id={}, found commited_op_id={}", module_name, wait_op_id, committed);
            } else {
                error!("fail read info for module [{}]", module_name);
                //break;
            }
            thread::sleep(time::Duration::from_millis(300));
        }

        //break;
    }

    //-1
}
