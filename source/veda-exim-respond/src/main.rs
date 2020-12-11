/*
 * Ожидает и обрабатывает сеанс обмена данными с другими системами, является
 * slave частью в протоколе связи
 */
#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate log;
#[macro_use]
extern crate rocket;
#[macro_use]
extern crate rocket_contrib;

use rocket::config::Environment;
use rocket::{Config, State};
use rocket_contrib::json::{Json, JsonValue};
use serde_json::Value;
use std::error::Error;
use std::io::ErrorKind;
use std::sync::Mutex;
use v_api::*;
use v_exim::*;
use v_module::module::*;
use v_onto::individual::{Individual, RawObj};
use v_queue::consumer::Consumer;
use v_queue::record::ErrorQueue;

struct Context {
    node_id: String,
    sys_ticket: String,
    api: APIClient,
}

fn main() -> Result<(), Box<dyn Error>> {
    init_log_with_filter("EXIM_RESPOND", None /*Some("error,rocket=error,exim=info")*/);
    rocket()?.launch();

    Ok(())
}

fn rocket() -> Result<rocket::Rocket, Box<dyn Error>> {
    info!("START EXIM RESPOND");
    let mut module = Module::default();

    let param_name = "exim_respond_port";
    let exim_respond_port = Module::get_property(param_name);
    if exim_respond_port.is_none() {
        return Err(Box::new(std::io::Error::new(ErrorKind::NotFound, format!("not found param {} in properties file", param_name))));
    }

    let sys_ticket;
    if let Ok(t) = module.get_sys_ticket_id() {
        sys_ticket = t;
    } else {
        return Err(Box::new(std::io::Error::new(ErrorKind::NotFound, format!("fail get system ticket"))));
    }

    let mut node_id = get_db_id(&mut module);
    if node_id.is_none() {
        node_id = create_db_id(&mut module);
    }

    if node_id.is_none() {
        return Err(Box::new(std::io::Error::new(ErrorKind::NotFound, format!("fail create node_id"))));
    }
    let node_id = node_id.unwrap();
    info!("my node_id={}", node_id);

    let ctx = Context {
        node_id,
        sys_ticket,
        api: APIClient::new(Module::get_property("main_module_url").unwrap_or_default()),
    };

    let config = Config::build(Environment::Staging).address("0.0.0.0").port(exim_respond_port.unwrap().parse::<u16>()?).finalize();
    if config.is_err() {
        return Err(Box::new(std::io::Error::new(ErrorKind::Other, format!("fail config"))));
    }
    let config = config.unwrap();
    Ok(rocket::custom(config).mount("/", routes![import_delta, export_delta]).register(catchers![not_found]).manage(Mutex::new(ctx)))
}

#[get("/export_delta/<remote_node_id>", format = "text/html")]
fn export_delta(remote_node_id: String, _in_ctx: State<Mutex<Context>>) -> Option<JsonValue> {
    // this request changes from master
    // читаем элемент очереди, создаем обьект и отправляем на server
    let consumer_name = format!("r_{}", remote_node_id.replace(":", "_"));
    let mut queue_consumer = Consumer::new("./data/out", &consumer_name, "extract").expect("!!!!!!!!! FAIL QUEUE");

    if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
        error!("get_info_of_part {}: {}", queue_consumer.id, e.as_str());
    }

    // пробуем взять из очереди заголовок сообщения
    if queue_consumer.pop_header() {
        let mut raw = RawObj::new(vec![0; (queue_consumer.header.msg_length) as usize]);

        if let Err(e) = queue_consumer.pop_body(&mut raw.data) {
            if e != ErrorQueue::FailReadTailMessage {
                error!("get msg from queue: {}", e.as_str());
            }
        } else {
            let queue_element = &mut Individual::new_raw(raw);
            match create_export_message(queue_element, &remote_node_id) {
                Ok(mut out_obj) => {
                    if let Ok(msg) = encode_message(&mut out_obj) {
                        queue_consumer.commit_and_next();
                        return Some(msg.into());
                    } else {
                        error!("fail encode out message");
                    }
                }
                Err(e) => {
                    if e != ExImCode::Ok {
                        error!("fail create out message {:?}", e);
                    }
                }
            }
        }
    }

    Some(json!({"msg": ""}))
}

#[put("/import_delta", format = "json", data = "<msg>")]
fn import_delta(msg: Json<Value>, in_ctx: State<Mutex<Context>>) -> Option<JsonValue> {
    let mut q = in_ctx.lock();
    let ctx = q.as_mut().unwrap();
    let node_id = ctx.node_id.to_owned();
    let sys_ticket = ctx.sys_ticket.to_owned();

    if let Ok(mut recv_indv) = decode_message(&msg.0) {
        let res = processing_imported_message(&node_id, &mut recv_indv, &sys_ticket, &mut ctx.api);
        return Some(json!(res));
    }
    None
}

#[catch(404)]
fn not_found() -> JsonValue {
    json!({
        "status": "error",
        "reason": "Resource was not found."
    })
}
