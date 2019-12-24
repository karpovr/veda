#[macro_use]
extern crate log;

use chrono::Utc;
use ini::Ini;
use nng::{Message, Protocol, Socket};
use serde_json::json;
use serde_json::value::Value as JSONValue;
use std::collections::HashMap;
use std::str;
use v_api::{IndvOp, ResultCode};
use v_authorization::{Access, Trace};
use v_az_lmdb::_authorize;
use v_module::info::ModuleInfo;
use v_module::module::{create_sys_ticket, init_log, Module};
use v_module::ticket::Ticket;
use v_onto::datatype::Lang;
use v_onto::individual::{Individual, RawObj};
use v_onto::individual2msgpack::to_msgpack;
use v_onto::json2individual::parse_json_to_individual;
use v_onto::parser::parse_raw;
use v_queue::queue::Queue;
use v_queue::record::{Mode, MsgType};
use v_storage::storage::*;

fn main() -> std::io::Result<()> {
    init_log();

    let base_path = "./data";

    let conf = Ini::load_from_file("veda.properties").expect("fail load veda.properties file");
    let section = conf.section(None::<String>).expect("fail parse veda.properties");

    let mut queue_out = Queue::new(&(base_path.to_owned() + "/queue"), "individuals-flow", Mode::ReadWrite).expect("!!!!!!!!! FAIL QUEUE");

    let tarantool_addr = if let Some(p) = section.get("tarantool_url") {
        p.to_owned()
    } else {
        warn!("param [tarantool_url] not found in veda.properties");
        "".to_owned()
    };

    if !tarantool_addr.is_empty() {
        info!("tarantool addr={}", &tarantool_addr);
    }

    let notify_channel_url = section.get("notify_channel_url");
    if notify_channel_url.is_none() {
        error!("fail read property [notify_channel_url]");
        return Ok(());
    };
    let notify_soc = Socket::new(Protocol::Pub0).unwrap();
    if let Err(e) = notify_soc.listen(notify_channel_url.unwrap()) {
        error!("fail connect to, {}, err={}", notify_channel_url.unwrap(), e);
        return Ok(());
    } else {
        info!("bind to notify_channel={}", notify_channel_url.unwrap());
    }

    let mut storage: VStorage;
    if !tarantool_addr.is_empty() {
        storage = VStorage::new_tt(tarantool_addr, "veda6", "123456");
    } else {
        storage = VStorage::new_lmdb(base_path, StorageMode::ReadWrite);
    }

    let mut sys_ticket = Ticket::default();
    if let Ok(ticket_id) = Module::get_sys_ticket_id_from_db(&mut storage) {
        get_ticket_from_db(&ticket_id, &mut sys_ticket, &mut storage);
    } else {
        sys_ticket = create_sys_ticket(&mut storage);
    }

    let param_name = "main_module_url";
    let main_module_url = Module::get_property(param_name);
    if main_module_url.is_none() {
        error!("not found param {} in properties file", param_name);
        return Ok(());
    }

    let server = Socket::new(Protocol::Rep0)?;
    if let Err(e) = server.listen(&main_module_url.unwrap()) {
        error!("fail listen, {:?}", e);
        return Ok(());
    }

    let mut tickets_cache: HashMap<String, Ticket> = HashMap::new();

    let info = ModuleInfo::new(base_path, "subject_manager", true);
    if info.is_err() {
        error!("fail open info file, {:?}", info.err());
        return Ok(());
    }

    let mut op_id = 0;
    let mut mstorage_info = info.unwrap();
    if let Some((_op_id, committed_op_id)) = mstorage_info.read_info() {
        op_id = committed_op_id;
    }
    info!("started with op_id={}", op_id);

    loop {
        if let Ok(recv_msg) = server.recv() {
            let mut out_msg = JSONValue::default();
            out_msg["type"] = json!("OpResult");
            let resp = request_prepare(&sys_ticket, &mut op_id, &recv_msg, &mut storage, &mut queue_out, &mut mstorage_info, &mut tickets_cache);
            if let Ok(v) = resp {
                let mut data = vec![];
                for el in v.iter() {
                    let mut out_el = JSONValue::default();
                    out_el["result"] = json!(el.res.clone() as u32);
                    out_el["op_id"] = json!(el.op_id);
                    data.push(out_el);

                    if el.res == ResultCode::Ok {
                        let msg_to_modules = format!("#{};{};{}", el.id, el.counter, el.op_id);
                        if notify_soc.send(Message::from(msg_to_modules.as_bytes())).is_err() {
                            error!("fail notify, id={}", el.id);
                        }
                    }
                }
                out_msg["data"] = json!(data);
            } else {
                if let Some(err_code) = resp.err() {
                    out_msg["result"] = json!(err_code as u32);
                }
            }

            if let Err(e) = server.send(Message::from(out_msg.to_string().as_bytes())) {
                error!("fail send {:?}", e);
            }
        }
    }
}

struct Response {
    id: String,
    res: ResultCode,
    op_id: i64,
    counter: i64,
}

impl Response {
    fn new(id: &str, rc: ResultCode, _op_id: i64, _counter: i64) -> Self {
        Response {
            id: id.to_string(),
            res: rc,
            op_id: _op_id,
            counter: _counter,
        }
    }
}

fn request_prepare(
    sys_ticket: &Ticket,
    op_id: &mut i64,
    request: &Message,
    storage: &mut VStorage,
    queue_out: &mut Queue,
    mstorage_info: &mut ModuleInfo,
    tickets_cache: &mut HashMap<String, Ticket>,
) -> Result<Vec<Response>, ResultCode> {
    let v: JSONValue = if let Ok(v) = serde_json::from_slice(request.as_slice()) {
        v
    } else {
        JSONValue::Null
    };

    let fticket = v["ticket"].as_str();
    if fticket.is_none() {
        error!("field [ticket] not found in request");
        return Err(ResultCode::TicketNotFound);
    }
    let ticket_id = fticket.unwrap();
    let mut ticket = Ticket::default();

    if let Some(cached_ticket) = tickets_cache.get(ticket_id) {
        ticket = cached_ticket.clone();
    } else {
        get_ticket_from_db(ticket_id, &mut ticket, storage);
        if ticket.result != ResultCode::Ok {
            error!("ticket [{}] not found in storage", ticket_id);
            return Err(ResultCode::TicketNotFound);
        }
        tickets_cache.insert(ticket_id.to_string(), ticket.clone());
    }

    if !is_ticket_valid(&mut ticket) {
        error!("ticket [{}] not valid", ticket.id);
        return Err(ResultCode::TicketExpired);
    }

    let assigned_subsystems = v["assigned_subsystems"].as_i64();
    let event_id = v["event_id"].as_str();
    let src = v["src"].as_str();
    let cmd;

    match v["function"].as_str().unwrap_or_default() {
        "put" => {
            cmd = IndvOp::Put;
        }
        "remove" => {
            cmd = IndvOp::Remove;
        }
        "add_to" => {
            cmd = IndvOp::AddIn;
        }
        "set_in" => {
            cmd = IndvOp::SetIn;
        }
        "remove_from" => {
            cmd = IndvOp::RemoveFrom;
        }
        _ => {
            error!("unknown command {:?}", v["function"].as_str());
            return Err(ResultCode::BadRequest);
        }
    }

    if let Some(jindividuals) = v["individuals"].as_array() {
        let mut res_of_id = vec![];
        for el in jindividuals {
            let mut indv = Individual::default();
            if !parse_json_to_individual(el, &mut indv) {
                error!("fail parse individual from json");
                res_of_id.push(Response::new("", ResultCode::BadRequest, -1, -1));
            } else {
                res_of_id.push(operation_prepare(
                    cmd.clone(),
                    op_id,
                    &ticket,
                    event_id,
                    src,
                    assigned_subsystems,
                    &mut indv,
                    storage,
                    queue_out,
                    mstorage_info,
                    sys_ticket,
                ));
            }
        }
        return Ok(res_of_id);
    } else {
        error!("field [individuals] is empty");
    }

    Err(ResultCode::InternalServerError)
}

fn operation_prepare(
    cmd: IndvOp,
    op_id: &mut i64,
    ticket: &Ticket,
    event_id: Option<&str>,
    src: Option<&str>,
    assigned_subsystems: Option<i64>,
    new_indv: &mut Individual,
    storage: &mut VStorage,
    queue_out: &mut Queue,
    my_info: &mut ModuleInfo,
    sys_ticket: &Ticket,
) -> Response {
    let is_need_authorize = if sys_ticket.user_uri == ticket.user_uri {
        false
    } else {
        true
    };

    if new_indv.get_id().is_empty() || new_indv.get_id().len() < 2 {
        return Response::new(new_indv.get_id(), ResultCode::InvalidIdentifier, -1, -1);
    }

    if cmd != IndvOp::Remove && new_indv.is_empty() {
        return Response::new(new_indv.get_id(), ResultCode::NoContent, -1, -1);
    }

    let mut prev_indv = Individual::default();
    let prev_state = storage.get_raw_value(StorageId::Individuals, new_indv.get_id());

    if !prev_state.is_empty() {
        prev_indv = Individual::new_raw(RawObj::new(prev_state.clone()));
        if parse_raw(&mut prev_indv).is_ok() {
            prev_indv.parse_all();
        } else {
            error!("fail parse individual prev states, cmd={:?}, uri={}", cmd, new_indv.get_id());
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    }

    if prev_indv.is_empty() && (cmd == IndvOp::AddIn || cmd == IndvOp::SetIn || cmd == IndvOp::RemoveFrom) {
        error!("fail update, cmd={:?}: not read prev_state uri={}", cmd, new_indv.get_id());
        return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
    }

    let mut trace = Trace {
        acl: &mut String::new(),
        is_acl: false,
        group: &mut String::new(),
        is_group: false,
        info: &mut String::new(),
        is_info: false,
        str_num: 0,
    };

    if is_need_authorize {
        if cmd == IndvOp::Remove {
            if _authorize(new_indv.get_id(), &ticket.user_uri, Access::CanDelete as u8, true, &mut trace).unwrap_or(0) != Access::CanDelete as u8 {
                error!("operation [Remove], Not Authorized, user {} request [can delete] {} ", ticket.user_uri, new_indv.get_id());
                //return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
            }
        } else {
            if !prev_state.is_empty() {
                if let Some(is_deleted) = new_indv.get_first_bool("v-s:deleted") {
                    if is_deleted && _authorize(new_indv.get_id(), &ticket.user_uri, Access::CanDelete as u8, true, &mut trace).unwrap_or(0) != Access::CanDelete as u8 {
                        error!("fail update, Not Authorized, user {} request [can delete] {} ", ticket.user_uri, new_indv.get_id());
                        return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
                    }
                } else {
                    if _authorize(new_indv.get_id(), &ticket.user_uri, Access::CanUpdate as u8, true, &mut trace).unwrap_or(0) != Access::CanUpdate as u8 {
                        error!("fail update, Not Authorized, user {} request [can update] {} ", ticket.user_uri, new_indv.get_id());
                        return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
                    }
                }
            }

            if cmd != IndvOp::Remove {
                // check access can_create for new types
                let prev_types = prev_indv.get_literals("rdf:type").unwrap_or_default();
                let new_types = new_indv.get_literals("rdf:type").unwrap_or_default();
                let mut added_types = vec![];

                if !new_types.is_empty() {
                    for n_el in new_types.iter() {
                        let mut found = false;
                        for p_el in prev_types.iter() {
                            if p_el == n_el {
                                found = true;
                            }
                        }
                        if !found {
                            added_types.push(n_el);
                        }
                    }
                } else if cmd == IndvOp::Put {
                    error!("fail update, not found type for new individual, user {}, id={} ", ticket.user_uri, new_indv.get_id());
                    return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
                }

                for type_id in added_types.iter() {
                    if _authorize(type_id, &ticket.user_uri, Access::CanCreate as u8, true, &mut trace).unwrap_or(0) != Access::CanCreate as u8 {
                        error!("fail update, Not Authorized, user {} request [can create] for {} ", ticket.user_uri, type_id);
                        return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
                    }
                }
            }
        }
        // end authorize
    }

    let upd_counter = prev_indv.get_first_integer("v-s:updateCounter").unwrap_or(0) + 1;
    new_indv.set_integer("v-s:updateCounter", upd_counter);

    if cmd == IndvOp::Remove {
        new_indv.set_bool("v-s:deleted", true);
    }

    if cmd == IndvOp::AddIn || cmd == IndvOp::SetIn || cmd == IndvOp::RemoveFrom {
        indv_apply_cmd(&cmd, &mut prev_indv, new_indv);

        if !to_storage_and_queue(IndvOp::Put, op_id, ticket, event_id, src, assigned_subsystems, &mut prev_indv, prev_state, upd_counter, storage, my_info, queue_out) {
            error!("not completed update to main DB");
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    } else {
        if !to_storage_and_queue(IndvOp::Put, op_id, ticket, event_id, src, assigned_subsystems, new_indv, prev_state, upd_counter, storage, my_info, queue_out) {
            error!("not completed update to main DB");
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    }

    if cmd == IndvOp::Remove {
        if !to_storage_and_queue(cmd, op_id, ticket, event_id, src, assigned_subsystems, new_indv, vec![], upd_counter, storage, my_info, queue_out) {
            error!("not completed update to main DB");
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    }

    Response::new(new_indv.get_id(), ResultCode::Ok, *op_id, upd_counter)
}

fn to_storage_and_queue(
    cmd: IndvOp,
    op_id: &mut i64,
    ticket: &Ticket,
    event_id: Option<&str>,
    src: Option<&str>,
    assigned_subsystems: Option<i64>,
    new_indv: &mut Individual,
    prev_state: Vec<u8>,
    update_counter: i64,
    storage: &mut VStorage,
    mstorage_info: &mut ModuleInfo,
    queue_out: &mut Queue,
) -> bool {
    // update main DB

    let mut new_state: Vec<u8> = Vec::new();
    if cmd == IndvOp::Remove {
        if storage.remove(StorageId::Individuals, new_indv.get_id()) {
            info!("remove individual, id={}", new_indv.get_id());
        } else {
            error!("fail remove individual, id={}", new_indv.get_id());
            return false;
        }
    } else {
        if to_msgpack(&new_indv, &mut new_state).is_ok() && storage.put_kv_raw(StorageId::Individuals, new_indv.get_id(), new_state.clone()) {
            info!("update, id={}", new_indv.get_id());
        } else {
            error!("fail update individual, id={}", new_indv.get_id());
            return false;
        }
    }

    // add to queue

    let mut queue_element = Individual::default();
    queue_element.set_id(&format!("{}", op_id));
    queue_element.set_integer("cmd", cmd.to_i64());
    queue_element.set_uri("uri", new_indv.get_id());

    if !ticket.user_uri.is_empty() {
        queue_element.set_uri("user_uri", &ticket.user_uri);
    }

    if !new_state.is_empty() {
        queue_element.set_binary("new_state", new_state);
    }

    if !prev_state.is_empty() {
        queue_element.set_binary("prev_state", prev_state);
    }

    if let Some(v) = event_id {
        queue_element.set_string("event_id", v, Lang::NONE);
    }

    queue_element.set_integer("tnx_id", *op_id);

    let src = if let Some(v) = src {
        if v.is_empty() {
            "?"
        } else {
            v
        }
    } else {
        "?"
    };
    queue_element.set_string("src", src, Lang::NONE);
    queue_element.add_datetime("date", Utc::now().naive_utc().timestamp());
    queue_element.add_integer("op_id", *op_id + 1);
    queue_element.add_integer("u_count", update_counter);

    if let Some(i) = assigned_subsystems {
        queue_element.add_integer("assigned_subsystems", i);
    }

    debug!("add to queue: uri={}", new_indv.get_id());

    let mut raw1: Vec<u8> = Vec::new();
    if let Err(e) = to_msgpack(&queue_element, &mut raw1) {
        error!("fail serialize, err={:?}", e);
        return false;
    }
    if let Err(e) = queue_out.push(&raw1, MsgType::String) {
        error!("fail push into queue, err={:?}", e);
        return false;
    }

    *op_id += 1;
    if let Err(e) = mstorage_info.put_info(*op_id, *op_id) {
        error!("fail put info, error={:?}", e);
        return false;
    }

    true
}

fn indv_apply_cmd(cmd: &IndvOp, prev_indv: &mut Individual, indv: &mut Individual) {
    if !prev_indv.is_empty() {
        let list_predicates = indv.get_predicates();

        for predicate in list_predicates {
            if predicate != "v-s:updateCounter" {
                if cmd == &IndvOp::AddIn {
                    // add value to set or ignore if exists
                    prev_indv.apply_predicate_as_add_unique(&predicate, indv);
                } else if cmd == &IndvOp::SetIn {
                    // set value to predicate
                    prev_indv.apply_predicate_as_set(&predicate, indv);
                } else if cmd == &IndvOp::RemoveFrom {
                    // remove predicate or value in set
                    prev_indv.apply_predicate_as_remove(&predicate, indv);
                }
            }
        }
    }
}

fn get_ticket_from_db(id: &str, dest: &mut Ticket, storage: &mut VStorage) {
    let mut indv = Individual::default();
    if storage.get_individual_from_db(StorageId::Tickets, id, &mut indv) {
        dest.update_from_individual(&mut indv);
        dest.result = ResultCode::Ok;
    }
}

fn is_ticket_valid(ticket: &mut Ticket) -> bool {
    if ticket.result != ResultCode::Ok {
        return false;
    }

    if Utc::now().timestamp() > ticket.end_time {
        ticket.result = ResultCode::TicketExpired;
        return false;
    }

    if ticket.user_uri.is_empty() {
        ticket.result = ResultCode::NotReady;
        return false;
    }

    true
}
