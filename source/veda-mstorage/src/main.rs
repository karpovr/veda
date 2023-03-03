#[macro_use]
extern crate log;

mod transaction;

use crate::transaction::{Transaction, TransactionItem};
use chrono::Utc;
use nng::{Message, Protocol, Socket};
use serde_json::json;
use serde_json::value::Value as JSONValue;
use std::collections::HashMap;
use std::net::IpAddr;
use std::str;
use std::thread::sleep;
use std::time::Duration;
use v_common::az_impl::common::f_authorize;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{init_log, Module};
use v_common::module::ticket::Ticket;
use v_common::module::veda_backend::{get_storage_use_prop, indv_apply_cmd};
use v_common::onto::individual::{Individual, RawObj};
use v_common::onto::individual2msgpack::to_msgpack;
use v_common::onto::json2individual::parse_json_to_individual;
use v_common::onto::parser::parse_raw;
use v_common::storage::common::{StorageId, StorageMode, VStorage};
use v_common::v_api::api_client::IndvOp;
use v_common::v_api::obj::*;
use v_common::v_authorization::common::{Access, Trace};
use v_common::v_queue::queue::Queue;
use v_common::v_queue::record::Mode;

pub const MSTORAGE_ID: i64 = 1;

struct Context {
    primary_storage: VStorage,
    queue_out: Queue,
    mstorage_info: ModuleInfo,
    tickets_cache: HashMap<String, Ticket>,
}

fn main() -> std::io::Result<()> {
    init_log("MSTORAGE");

    let base_path = "./data";

    let mut primary_storage = get_storage_use_prop(StorageMode::ReadWrite);
    info!("total count: {}", primary_storage.count(StorageId::Individuals));

    let queue_out = Queue::new(&(base_path.to_owned() + "/queue"), "individuals-flow", Mode::ReadWrite).expect("!!!!!!!!! FAIL QUEUE");

    let notify_channel_url = Module::get_property("notify_channel_url").expect("failed to read property [notify_channel_url]");

    let notify_soc = Socket::new(Protocol::Pub0).unwrap();
    if let Err(e) = notify_soc.listen(&notify_channel_url) {
        error!("failed to connect to {}, err = {}", notify_channel_url, e);
        return Ok(());
    } else {
        info!("bind to notify_channel = {}", notify_channel_url);
    }

    let mut sys_ticket = Ticket::default();
    while sys_ticket.id.is_empty() {
        if let Ok(ticket_id) = Module::get_sys_ticket_id_from_db(&mut primary_storage) {
            get_ticket_from_db(&ticket_id, &mut sys_ticket, &mut primary_storage);
            info!("found system ticket");
        } else {
            error!("system ticket not found, sleep and repeat...");
            sleep(Duration::from_secs(1));
        }
    }

    let param_name = "main_module_url";
    let main_module_url = Module::get_property(param_name);
    if main_module_url.is_none() {
        error!("failed to find parameter [{}] in properties file", param_name);
        return Ok(());
    }

    let check_ticket_ip = Module::get_property("check_ticket_ip").unwrap_or_default().parse::<bool>().unwrap_or(true);

    let main_module_url = main_module_url.unwrap();

    let server = Socket::new(Protocol::Rep0)?;
    if let Err(e) = server.listen(&main_module_url) {
        error!("failed to listen, err = {:?}", e);
        return Ok(());
    }
    info!("started listening {}", main_module_url);

    let tickets_cache: HashMap<String, Ticket> = HashMap::new();

    let info = ModuleInfo::new(base_path, "subject_manager", true);
    if info.is_err() {
        error!("failed to open info file, err = {:?}", info.err());
        return Ok(());
    }

    let mut op_id = 0;
    let mut mstorage_info = info.unwrap();
    if let Some((_op_id, committed_op_id)) = mstorage_info.read_info() {
        op_id = committed_op_id;
    }
    info!("started with op_id = {}", op_id);

    let mut ctx = Context {
        primary_storage,
        queue_out,
        mstorage_info,
        tickets_cache,
    };

    loop {
        if let Ok(recv_msg) = server.recv() {
            let mut out_msg = JSONValue::default();
            out_msg["type"] = json!("OpResult");
            let resp = request_prepare(&mut ctx, &sys_ticket, &mut op_id, &recv_msg, check_ticket_ip);
            if let Ok(v) = resp {
                for el in v.iter() {
                    if el.res == ResultCode::Ok {
                        let msg_to_modules = format!("#{};{};{}", el.id, el.counter, el.op_id);
                        if notify_soc.send(Message::from(msg_to_modules.as_bytes())).is_err() {
                            error!("failed to notify, id = {}", el.id);
                        }
                    }
                }
                let mut out_el = JSONValue::default();
                out_el["result"] = json!(ResultCode::Ok as u32);
                out_el["op_id"] = json!(op_id);
                out_msg["data"] = json!([out_el]);
            } else if let Some(err_code) = resp.err() {
                out_msg["result"] = json!(err_code as u32);
            }

            if let Err(e) = server.send(Message::from(out_msg.to_string().as_bytes())) {
                error!("failed to send, err = {:?}", e);
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

fn request_prepare(ctx: &mut Context, sys_ticket: &Ticket, op_id: &mut i64, request: &Message, check_ticket_ip: bool) -> Result<Vec<Response>, ResultCode> {
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

    if let Some(cached_ticket) = ctx.tickets_cache.get(ticket_id) {
        ticket = cached_ticket.clone();
    } else {
        get_ticket_from_db(ticket_id, &mut ticket, &mut ctx.primary_storage);
        if ticket.result != ResultCode::Ok {
            error!("ticket [{}] not found in storage", ticket_id);
            return Err(ResultCode::TicketNotFound);
        }
        ctx.tickets_cache.insert(ticket_id.to_string(), ticket.clone());
    }

    let assigned_subsystems = v["assigned_subsystems"].as_i64();
    let event_id = v["event_id"].as_str();
    let src = v["src"].as_str();

    let addr = if let Ok(v) = v["addr"].as_str().unwrap_or_default().parse::<IpAddr>() {
        Some(v)
    } else {
        None
    };

    if !(ticket.is_ticket_valid(&addr, check_ticket_ip & addr.is_some()) == ResultCode::Ok) {
        error!("ticket [{}] not valid", ticket.id);
        return Err(ResultCode::TicketExpired);
    }

    let cmd = match v["function"].as_str().unwrap_or_default() {
        "put" => IndvOp::Put,
        "remove" => IndvOp::Remove,
        "add_to" => IndvOp::AddTo,
        "set_in" => IndvOp::SetIn,
        "remove_from" => IndvOp::RemoveFrom,
        _ => {
            error!("unknown command {:?}", v["function"].as_str());
            return Err(ResultCode::BadRequest);
        },
    };

    if let Some(jindividuals) = v["individuals"].as_array() {
        let mut transaction = Transaction {
            sys_ticket: sys_ticket.id.to_owned(),
            id: *op_id,
            event_id,
            src,
            queue: vec![],
            assigned_subsystems,
            ticket,
        };

        let mut res_of_id = vec![];
        for el in jindividuals {
            let mut indv = Individual::default();
            if !parse_json_to_individual(el, &mut indv) {
                error!("failed to parse individual from json");
                return Err(ResultCode::InternalServerError);
            } else {
                let resp = operation_prepare(cmd.clone(), op_id, &mut indv, &mut ctx.primary_storage, sys_ticket, &mut transaction);
                if resp.res != ResultCode::Ok {
                    return Err(resp.res);
                }
                res_of_id.push(resp);
            }
        }

        if let Ok(res_op_id) = transaction.commit(&mut ctx.primary_storage, &mut ctx.queue_out, &mut ctx.mstorage_info) {
            *op_id = res_op_id;
            return Ok(res_of_id);
        }
    } else {
        error!("field [individuals] is empty");
    }

    Err(ResultCode::InternalServerError)
}

fn operation_prepare(
    cmd: IndvOp,
    op_id: &mut i64,
    new_indv: &mut Individual,
    primary_storage: &mut VStorage,
    sys_ticket: &Ticket,
    transaction: &mut Transaction,
) -> Response {
    let is_need_authorize = sys_ticket.user_uri != transaction.ticket.user_uri;

    if new_indv.get_id().is_empty() || new_indv.get_id().len() < 2 {
        return Response::new(new_indv.get_id(), ResultCode::InvalidIdentifier, -1, -1);
    }

    if cmd != IndvOp::Remove && new_indv.is_empty() {
        return Response::new(new_indv.get_id(), ResultCode::NoContent, -1, -1);
    }

    debug!("cmd={:?}, new_indv.id={}", cmd, new_indv.get_id());

    let mut prev_indv = Individual::default();
    let prev_state = primary_storage.get_raw_value(StorageId::Individuals, new_indv.get_id());

    if !prev_state.is_empty() {
        prev_indv = Individual::new_raw(RawObj::new(prev_state.clone()));
        if parse_raw(&mut prev_indv).is_ok() {
            prev_indv.parse_all();
        } else {
            error!("failed to parse individual prev states, cmd = {:?}, uri = {}", cmd, new_indv.get_id());
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    }

    if prev_indv.is_empty() && cmd == IndvOp::Remove {
        warn!("remove not exists, uri = {}", new_indv.get_id());
        return Response::new(new_indv.get_id(), ResultCode::Ok, -1, -1);
    }

    if prev_indv.is_empty() && (cmd == IndvOp::AddTo || cmd == IndvOp::SetIn || cmd == IndvOp::RemoveFrom) {
        error!("failed to update, cmd = {:?}, no prev_state, uri = {}", cmd, new_indv.get_id());
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
            if f_authorize(new_indv.get_id(), &transaction.ticket.user_uri, Access::CanDelete as u8, true, Some(&mut trace)).unwrap_or(0) != Access::CanDelete as u8 {
                error!("operation [Remove], Not Authorized, user = {}, request [can delete], uri = {} ", transaction.ticket.user_uri, new_indv.get_id());
                return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
            }
        } else {
            if !prev_state.is_empty() {
                if let Some(new_is_deleted) = new_indv.get_first_bool("v-s:deleted") {
                    if let Some(prev_is_deleted) = prev_indv.get_first_bool("v-s:deleted") {
                        if !prev_is_deleted
                            && new_is_deleted
                            && f_authorize(new_indv.get_id(), &transaction.ticket.user_uri, Access::CanDelete as u8, true, Some(&mut trace)).unwrap_or(0)
                                != Access::CanDelete as u8
                        {
                            let types = new_indv.get_literals("rdf:type").unwrap_or_default();
                            error!(
                                "failed to update, Not Authorized, user = {}, request [can delete], uri = {}, types = {:?}",
                                transaction.ticket.user_uri,
                                &new_indv.get_id(),
                                types
                            );
                            return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
                        }
                    }
                }
                if f_authorize(new_indv.get_id(), &transaction.ticket.user_uri, Access::CanUpdate as u8, true, Some(&mut trace)).unwrap_or(0) != Access::CanUpdate as u8 {
                    let types = new_indv.get_literals("rdf:type").unwrap_or_default();
                    error!(
                        "failed to update, Not Authorized, user = {}, request [can update], uri = {}, types = {:?}",
                        transaction.ticket.user_uri,
                        new_indv.get_id(),
                        types
                    );
                    return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
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
                    error!(
                        "failed to update, not found type for new individual, user = {}, id = {}, types = {:?}",
                        transaction.ticket.user_uri,
                        new_indv.get_id(),
                        new_types
                    );
                    return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
                }

                for type_id in added_types.iter() {
                    if f_authorize(type_id, &transaction.ticket.user_uri, Access::CanCreate as u8, true, Some(&mut trace)).unwrap_or(0) != Access::CanCreate as u8 {
                        error!("failed to update, Not Authorized, user = {}, request [can create], type = {}", transaction.ticket.user_uri, type_id);
                        return Response::new(new_indv.get_id(), ResultCode::NotAuthorized, -1, -1);
                    }
                }
            }
        }
        // end authorize
    }

    let upd_counter = prev_indv.get_first_integer("v-s:updateCounter").unwrap_or(0) + 1;

    if cmd == IndvOp::Put && !new_indv.is_exists("v-s:created") {
        new_indv.add_datetime("v-s:created", Utc::now().naive_utc().timestamp());
    }

    let mut prev_state_c1 = vec![];
    if cmd == IndvOp::Remove {
        prev_indv.set_bool("v-s:deleted", true);
        prev_state_c1 = prev_state.clone();
    }

    if cmd == IndvOp::AddTo || cmd == IndvOp::SetIn || cmd == IndvOp::RemoveFrom || cmd == IndvOp::Remove {
        if cmd == IndvOp::AddTo || cmd == IndvOp::SetIn || cmd == IndvOp::RemoveFrom {
            indv_apply_cmd(&cmd, &mut prev_indv, new_indv);
        }
        prev_indv.set_integer("v-s:updateCounter", upd_counter);

        if !add_to_transaction(IndvOp::Put, &cmd, &mut prev_indv, prev_state, upd_counter, transaction) {
            error!("failed to commit update to main DB");
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    } else {
        new_indv.set_integer("v-s:updateCounter", upd_counter);
        if !add_to_transaction(IndvOp::Put, &cmd, new_indv, prev_state, upd_counter, transaction) {
            error!("failed to commit update to main DB");
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    }

    if cmd == IndvOp::Remove {
        new_indv.set_integer("v-s:updateCounter", upd_counter);
        if !add_to_transaction(IndvOp::Remove, &cmd, new_indv, prev_state_c1, upd_counter, transaction) {
            error!("failed to commit update to main DB");
            return Response::new(new_indv.get_id(), ResultCode::FailStore, -1, -1);
        }
    }

    Response::new(new_indv.get_id(), ResultCode::Ok, *op_id, upd_counter)
}

fn add_to_transaction(cmd: IndvOp, original_cmd: &IndvOp, new_indv: &mut Individual, prev_state: Vec<u8>, update_counter: i64, transaction: &mut Transaction) -> bool {
    let mut new_state: Vec<u8> = Vec::new();
    if cmd == IndvOp::Remove {
    } else if to_msgpack(new_indv, &mut new_state).is_err() {
        error!("failed to update individual, id = {}", new_indv.get_id());
        return false;
    }
    let ti = TransactionItem {
        indv_id: new_indv.get_id().to_owned(),
        cmd,
        original_cmd: original_cmd.clone(),
        new_state,
        prev_state,
        update_counter,
    };

    transaction.add_item(ti);

    true
}

fn get_ticket_from_db(id: &str, dest: &mut Ticket, storage: &mut VStorage) {
    let mut indv = Individual::default();
    if storage.get_individual_from_db(StorageId::Tickets, id, &mut indv) {
        dest.update_from_individual(&mut indv);
        dest.result = ResultCode::Ok;
    }
}
