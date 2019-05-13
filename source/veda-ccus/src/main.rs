use std::collections::HashMap;
use std::str;
use std::sync::mpsc;
use std::sync::mpsc::{Receiver, Sender};
use std::time::{Duration, Instant};
use std::{thread, time};

use actix::prelude::*;
use actix::Running::Continue;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;

use crate::v_onto::individual::*;
use crate::v_onto::msgpack8individual::msgpack2individual;
use v_queue::*;

extern crate scan_fmt;
extern crate v_onto;
extern crate v_queue;

extern crate ini;
use ini::Ini;

use nng::{Message, Protocol, Socket};

#[macro_use]
extern crate log;
use actix_web::middleware::Logger;

const HEARTBEAT_INTERVAL: Duration = Duration::from_millis(1000);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(60);

/// do websocket handshake and start `MyWebSocket` actor
fn ws_index(r: HttpRequest, stream: web::Payload, data: web::Data<AppData>) -> Result<HttpResponse, Error> {
    let res = ws::start(MyWebSocket::new(data.subscribe_manager_sender.clone()), &r, stream);
    res
}

#[derive(Debug)]
struct PQMsg {
    data: String,
    from: u32,
}

impl PQMsg {
    fn new(data: &str, in_from: u32) -> Self {
        Self {
            data: data.to_owned(),
            from: in_from,
        }
    }
}

#[derive(Debug)]
struct MyWebSocket {
    hb: Instant,
    counter: u64,
    subscribe_manager_sender: Sender<(PQMsg, Sender<PQMsg>)>,
    my_sender: Sender<PQMsg>,
    my_receiver: Receiver<PQMsg>,
    id: u32,
}

impl Actor for MyWebSocket {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {}
}

impl StreamHandler<ws::Message, ws::ProtocolError> for MyWebSocket {
    fn started(&mut self, _ctx: &mut Self::Context) {
        self.id = self.snd_rcv_subsrc("N").from;
        info!("[{}] Started", self.id);
    }

    fn handle(&mut self, msg: ws::Message, ctx: &mut Self::Context) {
        match msg {
            ws::Message::Ping(msg) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            ws::Message::Pong(_) => {
                self.hb = Instant::now();
                self.counter = self.counter + 1;

                if let Ok(_) = self.subscribe_manager_sender.send((PQMsg::new("?", self.id), self.my_sender.clone())) {
                    if let Ok(msg) = self.my_receiver.recv() {
                        if msg.data.len() > 0 {
                            info!("[{}] Send: {}", self.id, msg.data);
                            ctx.text(msg.data);
                        }
                    }
                }

                //info!("@WS RECV: {:?}", msg);
            }
            ws::Message::Text(text) => {
                info!("[{}] Receive: {:?}", self.id, text);

                if let Ok(_) = self.subscribe_manager_sender.send((PQMsg::new(&text, self.id), self.my_sender.clone())) {
                    if let Ok(msg) = self.my_receiver.recv() {
                        if msg.data.len() > 0 {
                            info!("WS: send to client: {:?}", msg);
                            ctx.text(msg.data);
                        }
                    }
                }
            }
            ws::Message::Binary(bin) => ctx.binary(bin),
            ws::Message::Close(_) => {
                info!("[{}] Close", self.id);
                self.snd_rcv_subsrc("-*");
                ctx.stop();
            }
            ws::Message::Nop => (),
        }
    }

    fn error(&mut self, _err: ws::ProtocolError, _ctx: &mut Self::Context) -> Running {
        error!("[{}] Error", self.id);
        return Continue;
    }

    fn finished(&mut self, _ctx: &mut Self::Context) {
        info!("[{}] Finished", self.id);
        self.snd_rcv_subsrc("-*");
    }
}

impl MyWebSocket {
    fn new(tx: Sender<(PQMsg, Sender<PQMsg>)>) -> Self {
        let ch = mpsc::channel();

        Self {
            hb: Instant::now(),
            counter: 0,
            subscribe_manager_sender: tx,
            my_sender: ch.0,
            my_receiver: ch.1,
            id: 0,
        }
    }

    fn snd_rcv_subsrc(&self, cmd: &str) -> PQMsg {
        if let Ok(_) = self.subscribe_manager_sender.send((PQMsg::new(cmd, self.id), self.my_sender.clone())) {
            if let Ok(msg) = self.my_receiver.recv() {
                return msg;
            }
        }

        PQMsg::new("", 0)
    }

    fn hb(&self, ctx: &mut <Self as Actor>::Context) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // check client heartbeats
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // heartbeat timed out
                error!("Websocket Client heartbeat failed, disconnecting!");

                // stop actor
                ctx.stop();

                // don't try to send a ping
                return;
            }

            ctx.ping("");
        });
    }
}

struct AppData {
    subscribe_manager_sender: Sender<(PQMsg, Sender<PQMsg>)>,
}

fn subscribe_manager(rx: Receiver<(PQMsg, Sender<PQMsg>)>, ro_client_addr: String) {
    info!("Start CCUS");

    let mut is_ro_storage_ready = false;
    let mut ro_storage_client: Socket;

    if let Ok(c) = Socket::new(Protocol::Req0) {
        ro_storage_client = c;
        if let Err(e) = ro_storage_client.dial(ro_client_addr.as_str()) {
            error!("fail dial to ro-storage, [{}], err={}", ro_client_addr, e);
        }

        let req = Message::from("I,cfg:standart_node".as_bytes());

        ro_storage_client.send(req).unwrap();

        // Wait for the response from the server.
        let msg = ro_storage_client.recv().unwrap();

        if msg.len() > 0 {
            is_ro_storage_ready = true;
        }
    } else {
        error!("fail connect to ro-storage, [{}]", ro_client_addr);
    }

    if is_ro_storage_ready == true {
        info!("success connect to ro-storage, {}", ro_client_addr);
    }

    let mut ws_id_gen = 0;

    // key:id_ws [key:uri[counter]]
    let mut idws2uris: HashMap<u32, HashMap<String, u64>> = HashMap::new();

    // key:uri [counter, count_subscribe]
    let mut uri2counter: HashMap<String, (u64, u64)> = HashMap::new();

    if let Ok(mut consumer) = Consumer::new("ccus", "individuals-flow") {
        loop {
            if let Ok(msg) = rx.try_recv() {
                //info!("@QUEUE PREPARER: RECV: {:?}", msg);

                let from = msg.0.from;

                let mut out_msg = PQMsg::new("", from);

                for item in msg.0.data.split(',') {
                    let els: Vec<&str> = item.split('=').collect();

                    if els.len() == 2 {
                        if els[0] == "ccus" {
                            // Рукопожатие: ccus=Ticket
                            debug!("[{}]: HANDSHAKE", from);
                            break;
                        } else {
                            // Добавить подписку: +uriN=M[,...]
                            if let Some(uri) = els[0].get(1..) {
                                let mut counter = 0;
                                if let Ok(c) = els[1].parse() {
                                    counter = c;
                                };

                                let uris = idws2uris.entry(from).or_default();
                                if uris.contains_key(uri) == false {
                                    uris.insert(uri.to_owned(), counter);
                                }

                                if let Some(counters) = uri2counter.get_mut(uri) {
                                    debug!("[{}]: ADD (ALREADY EXISTS): uri={}, counters={:?}", from, uri, counters);
                                    counters.1 = counters.1 + 1;
                                } else {
                                    uri2counter.insert(uri.to_owned(), (counter, 0));
                                    debug!("[{}]: ADD: uri={}, counter={}", from, uri, counter);
                                }
                            }
                        }
                    } else if els.len() == 1 {
                        let uris = idws2uris.entry(from).or_default();

                        if els[0] == "N" {
                            ws_id_gen = ws_id_gen + 1;
                            out_msg.from = ws_id_gen;
                        } else if els[0] == "?" {
                            // есть ли изменения в подписках ?
                            //info!("@QP[{}]: GET CHANGES", from);

                            let mut changes = String::new();

                            for (uri, ws_counter) in uris.iter_mut() {
                                if let Some(counters) = uri2counter.get_mut(uri) {
                                    //info!("@QP[{}]: FOUND IN SUBSCRIPTION: {}{:?}", from, uri, counters);

                                    if &counters.0 != ws_counter {
                                        if changes.len() > 0 {
                                            changes.push_str(",");
                                        }

                                        changes.push_str(&uri.to_owned());
                                        changes.push_str("=");
                                        changes.push_str(&counters.0.to_string());
                                        *ws_counter = counters.0;
                                    }
                                } else {
                                    debug!("[{}]: NOT FOUND IN SUBSCRIPTION: {}", from, uri);
                                }
                            }

                            if changes.len() > 0 {
                                debug!("[{}]: FOUND CHANGES IN SUBSCRIPTION: {:?}", from, changes);
                            }

                            out_msg.data = changes;
                        } else {
                            if let Some(uri) = els[0].get(1..) {
                                if uri == "*" {
                                    // Отменить все подписки: -*

                                    for (uri, _ws_counter) in uris.iter() {
                                        if let Some(counters) = uri2counter.get_mut(uri) {
                                            debug!("[{}]: REMOVE: uri={}, counters={:?}", from, uri, counters);
                                            if counters.1 > 0 {
                                                counters.1 = counters.1 - 1;
                                            }
                                        }
                                    }

                                    uris.clear();
                                    debug!("[{}]: REMOVE: ALL", from);
                                } else {
                                    // Отменить подписку: -uriN[,...]
                                    if uris.contains_key(uri) == true {
                                        uris.remove(uri);
                                        debug!("[{}]: REMOVE: uri={}", from, uri);
                                    }
                                    if let Some(counters) = uri2counter.get_mut(uri) {
                                        debug!("[{}]: REMOVE: uri={}, counters={:?}", from, uri, counters);
                                        if counters.1 > 0 {
                                            counters.1 = counters.1 - 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if let Err(e) = msg.1.send(out_msg) {
                    debug!("[{}]: NOT SEND RESPONSE, err={}", from, e);
                }
            }

            // пробуем взять из очереди заголовок сообщения
            if consumer.pop_header() == false {
                thread::sleep(time::Duration::from_millis(10));
                continue;
            }

            let mut msg = Individual::new(vec![0; (consumer.header.msg_length) as usize]);

            // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
            if consumer.pop_body(&mut msg.binobj) == false {
                continue;
            }

            // запустим ленивый парсинг сообщения в Indidual
            if msgpack2individual(&mut msg) == false {
                error!("fail parse, stop");
                continue;
            }

            // берем поле [uri]
            if let Ok(uri_from_queue) = msg.get_first_literal("uri") {
                // найдем есть ли среди подписанных индивидов, индивид из очереди
                if let Some(counters) = uri2counter.get_mut(&uri_from_queue) {
                    debug!("FOUND IN SUBSCRIBE: uri={}, counters={:?}", uri_from_queue, counters);
                    // берем u_counter
                    let counter_from_queue = msg.get_first_integer("u_count");
                    //info!("uri={}, {}", uri_from_queue, counter_from_queue);

                    counters.0 = counter_from_queue as u64;
                } else {
                }
            }

            consumer.commit_and_next();
        }
    } else {
        error!("STOP: fail open queue");
    }
}

fn main() -> std::io::Result<()> {
    std::env::set_var("RUST_LOG", "info,actix_server=info,actix_web=info");
    env_logger::init();

    let conf = Ini::load_from_file("veda.properties").expect("File load veda.properties file");

    let section = conf.section(None::<String>).expect("fail parse veda.properties");
    let ccus_port = section.get("ccus_port").expect("param [ccus_port] not found in veda.properties").clone();
    let ro_client_addr = section.get("ro_storage_url").expect("param [ro_storage_url] not found in veda.properties").clone();

    info!("CCUS PORT {:?}", ccus_port);

    // создадим канал приема и передачи с нитью subscriber_manager
    let (sbscr_tx, sbscr_rx): (Sender<(PQMsg, Sender<PQMsg>)>, Receiver<(PQMsg, Sender<PQMsg>)>) = mpsc::channel();

    // start queue preparer thread
    thread::spawn(move || subscribe_manager(sbscr_rx, ro_client_addr));

    HttpServer::new(move || {
        App::new()
            .data(AppData {
                subscribe_manager_sender: sbscr_tx.clone(),
            })
            // enable logger
            .wrap(Logger::default())
            // websocket route
            .service(web::resource("/ccus").route(web::get().to(ws_index)))
    })
    .bind("[::]:".to_owned() + &ccus_port)?
    .run()
}
