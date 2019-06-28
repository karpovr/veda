use actix::prelude::*;
use geo::prelude::*;
use geo::{Coordinate, LineString, Point, Polygon, Rect};
use num_traits::Float;
use rand::{self, rngs::ThreadRng, Rng};
use rijksdriehoek::*;
use std::collections::{HashMap, HashSet};
use std::str;
use std::sync::mpsc;
use std::sync::mpsc::{Receiver, Sender};
use std::time::Duration;
use v_onto::individual::*;
use v_onto::parser::*;
use v_queue::consumer::*;
use v_queue::record::*;

const QUEUE_CHECK_INTERVAL: Duration = Duration::from_millis(300);
const STAT_INTERVAL: Duration = Duration::from_millis(10000);
pub type CMessage = (String, Sender<i64>);

/// CCUS server sends this messages to session
#[derive(Message)]
pub struct Msg(pub String);

#[derive(Message)]
#[rtype(usize)]
pub struct Connect {
    pub addr: Recipient<Msg>,
}

/// Session is disconnected
#[derive(Message)]
pub struct Disconnect {
    pub id: usize,
}

#[derive(Message)]
pub struct ClientMessage {
    /// Id of the client session
    pub id: usize,
    /// Peer message
    pub msg: String,
}

pub struct SubscribeElement {
    counter: u64,
    sessions: HashSet<usize>,
}

impl Default for SubscribeElement {
    fn default() -> SubscribeElement {
        SubscribeElement {
            counter: 0,
            sessions: HashSet::new(),
        }
    }
}

#[derive(Hash, Eq, PartialEq)]
struct Decimal((u64, i16, i8));

impl Decimal {
    fn new(val: f32) -> Decimal {
        Decimal(Float::integer_decode(val))
    }
}

#[derive(Hash, Eq, PartialEq)]
struct Square {
    min: (Decimal, Decimal),
    max: (Decimal, Decimal),
}

impl Square {
    fn new(min: (f32, f32), max: (f32, f32)) -> Self {
        Square {
            min: (Decimal(Float::integer_decode(min.0)), Decimal(Float::integer_decode(min.1))),
            max: (Decimal(Float::integer_decode(max.0)), Decimal(Float::integer_decode(max.1))),
        }
    }
}

fn lonlat_to_xy(lon: f32, lat: f32) -> (f32, f32) {
    wgs84_to_rijksdriehoek(lat, lon)
}

pub struct CCUSServer {
    sessions: HashMap<usize, Recipient<Msg>>,
    uri2sessions: HashMap<String, SubscribeElement>,
    poligon2sessions: HashMap<Square, SubscribeElement>,
    queue_consumer: Consumer,
    total_prepared_count: u64,
    rng: ThreadRng,
    stat_sessions: usize,
    stat_uris: usize,
    subscribe_manager_sender: Sender<CMessage>,
    my_sender: Sender<i64>,
    my_receiver: Receiver<i64>,
}

impl CCUSServer {
    pub fn new(tx: Sender<CMessage>) -> CCUSServer {
        let _consumer = Consumer::new("./data/queue", "CCUS1", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
        let ch = mpsc::channel();

        CCUSServer {
            sessions: HashMap::new(),
            uri2sessions: HashMap::new(),
            poligon2sessions: HashMap::new(),
            rng: rand::thread_rng(),
            queue_consumer: _consumer,
            total_prepared_count: 0,
            stat_sessions: 0,
            stat_uris: 0,
            subscribe_manager_sender: tx,
            my_sender: ch.0,
            my_receiver: ch.1,
        }
    }

    fn subscribe_geo(&mut self, value: &str, counter: u64, session_id: usize) -> bool {
        let coords = value.as_bytes();
        if coords[0] == b'(' && coords[coords.len() as usize] == b')' {
            let coords: Vec<&str> = value[1..coords.len() - 1].split(',').collect();
            if coords.len() == 4 {
                let min_lon: f32 = if let Ok(c) = coords[0].parse() {
                    c
                } else {
                    return false;
                };
                let min_lat: f32 = if let Ok(c) = coords[1].parse() {
                    c
                } else {
                    return false;
                };
                let max_lon: f32 = if let Ok(c) = coords[2].parse() {
                    c
                } else {
                    return false;
                };
                let max_lat: f32 = if let Ok(c) = coords[3].parse() {
                    c
                } else {
                    return false;
                };

                let sq = Square::new((min_lon, min_lat), (max_lon, max_lat));
                let el = self.poligon2sessions.entry(sq).or_default();

                if !el.sessions.contains(&session_id) {
                    el.sessions.insert(session_id);
                    debug!("[{}]: SUBSCRIBE: coord={}, counter={}, count subscribers={}", session_id, value, counter, el.sessions.len());
                } else {
                    debug!("[{}]: SUBSCRIBE (ALREADY EXISTS): coord={}, count subscribers={}", session_id, value, el.sessions.len());
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
        true
    }

    fn subscribe_uri(&mut self, uri: &str, counter: u64, session_id: usize) -> u64 {
        let mut storage_counter = 0;

        if !self.uri2sessions.contains_key(&uri.to_owned()) && self.subscribe_manager_sender.send((uri.to_string(), self.my_sender.clone())).is_ok() {
            if let Ok(msg) = self.my_receiver.recv_timeout(Duration::from_millis(1000)) {
                if msg >= 0 {
                    info!("from storage: {}, {}", uri, msg);
                    storage_counter = msg as u64;
                }
            } else {
                error!("not connect with storage thread");
            }
        }

        let el = self.uri2sessions.entry(uri.to_owned()).or_default();

        if !el.sessions.contains(&session_id) {
            el.sessions.insert(session_id);
            debug!("[{}]: SUBSCRIBE: uri={}, counter={}, count subscribers={}", session_id, uri, counter, el.sessions.len());
        } else {
            debug!("[{}]: SUBSCRIBE (ALREADY EXISTS): uri={}, count subscribers={}", session_id, uri, el.sessions.len());
        }

        if storage_counter > 0 {
            el.counter = storage_counter;
            storage_counter
        } else {
            el.counter
        }
    }

    fn unsubscribe(&mut self, uri: &str, session_id: usize) {
        //let mut empty_uris: Vec<String> = Vec::new();

        let el = self.uri2sessions.entry(uri.to_owned()).or_default();

        if el.sessions.contains(&session_id) {
            el.sessions.remove(&session_id);
            debug!("[{}]: REMOVE FROM URI={}, {}", session_id, &uri, el.sessions.len());
        }
        //if el.sessions.len() == 0 {
        //    empty_uris.push(uri.to_owned());
        //}

        //for uri in empty_uris {
        //    self.uri2sessions.remove(&uri);
        //    debug!("[{}]: REMOVE URI={}", session_id, uri);
        //}
    }

    fn unsubscribe_all(&mut self, session_id: usize, is_clear_unused: bool) {
        let mut empty_uris: Vec<String> = Vec::new();

        for (uri, uss) in &mut self.uri2sessions {
            if uss.sessions.contains(&session_id) {
                uss.sessions.remove(&session_id);
                debug!("[{}]: REMOVE FROM URI={}, {}", session_id, uri, uss.sessions.len());
            }

            if is_clear_unused && uss.sessions.is_empty() {
                empty_uris.push(uri.to_owned());
            }
        }

        if is_clear_unused {
            for uri in empty_uris {
                self.uri2sessions.remove(&uri);
                debug!("[{}]: REMOVE URI={}", session_id, uri);
            }
        }
    }

    fn prepare_command(&mut self, message: &str, session_id: usize) {
        let mut changes = String::new();

        for item in message.split(',') {
            let els: Vec<&str> = item.split('=').collect();

            if els.len() == 2 {
                if els[0] == "ccus" {
                    // Рукопожатие: ccus=Ticket
                    debug!("[{}]: HANDSHAKE", session_id);
                    break;
                } else if let Some(value) = els[0].get(1..) {
                    let counter: u64 = if let Ok(c) = els[1].parse() {
                        c
                    } else {
                        0
                    };

                    // Добавить подписку: [+[type]=value], type=[uri,geo]
                    if els[0] == "uri" {
                        // Добавить подписку: [+uri=xxxx]
                        let registred_counter = self.subscribe_uri(value, counter, session_id);

                        if registred_counter > counter || registred_counter == 0 {
                            if !changes.is_empty() {
                                changes.push_str(",");
                            }

                            changes.push_str(&value.to_owned());
                            changes.push_str("=");
                            changes.push_str(&registred_counter.to_string());
                        }
                    } else if els[0] == "geo" {
                        // Добавить подписку: [+geo=(min_lon,min_lat,max_lon,max_lat)]
                        self.subscribe_geo(value, counter, session_id);
                    }
                }
            } else if els.len() == 1 {
                if let Some(uri) = els[0].get(1..) {
                    if uri == "*" {
                        // Отменить все подписки: -*
                        self.unsubscribe_all(session_id, false);
                    } else {
                        // Отменить подписку: -uriN[,...]
                        self.unsubscribe(uri, session_id);
                    }
                }
            }
        }

        if !changes.is_empty() {
            if let Some(addr) = self.sessions.get(&session_id) {
                let _ = addr.do_send(Msg(changes.to_owned()));
                debug!("send {}", changes);
            }
        }
    }
}

/// Make actor from `CCUSServer`
impl Actor for CCUSServer {
    /// We are going to use simple Context, we just need ability to communicate with other actors.
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        info!("Start CCUS");

        ctx.run_interval(STAT_INTERVAL, |act, _ctx| {
            if act.sessions.len() != act.stat_sessions || act.uri2sessions.len() != act.stat_uris {
                info!("STAT: count subscribers: {}, look uris: {}", act.sessions.len(), act.uri2sessions.len());

                act.stat_sessions = act.sessions.len();
                act.stat_uris = act.uri2sessions.len();
            }
        });

        ctx.run_interval(QUEUE_CHECK_INTERVAL, |act, _ctx| {
            // READ QUEUE

            let mut size_batch = 0;

            // read queue current part info
            if let Err(e) = act.queue_consumer.queue.get_info_of_part(act.queue_consumer.id, true) {
                error!("{} get_info_of_part {}: {}", act.total_prepared_count, act.queue_consumer.id, e.as_str());
                return;
            }

            if act.queue_consumer.queue.count_pushed - act.queue_consumer.count_popped == 0 {
                // if not new messages, read queue info
                act.queue_consumer.queue.get_info_queue();

                if act.queue_consumer.queue.id > act.queue_consumer.id {
                    size_batch = 1;
                }
            } else if act.queue_consumer.queue.count_pushed - act.queue_consumer.count_popped > 0 {
                if act.queue_consumer.queue.id != act.queue_consumer.id {
                    size_batch = 1;
                } else {
                    size_batch = act.queue_consumer.queue.count_pushed - act.queue_consumer.count_popped;
                }
            }

            if size_batch > 0 {
                info!("queue: batch size={}", size_batch);
            }

            let mut session2uris: HashMap<usize, HashMap<String, u64>> = HashMap::new();

            for _it in 0..size_batch {
                // пробуем взять из очереди заголовок сообщения
                if !act.queue_consumer.pop_header() {
                    break;
                }

                let mut raw = RawObj::new(vec![0; (act.queue_consumer.header.msg_length) as usize]);

                // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
                if let Err(e) = act.queue_consumer.pop_body(&mut raw.data) {
                    if e == ErrorQueue::FailReadTailMessage {
                        break;
                    } else {
                        error!("{} get msg from queue: {}", act.total_prepared_count, e.as_str());
                        break;
                    }
                }

                let mut msg = Individual::new();
                // запустим ленивый парсинг сообщения в Individual
                if let Ok(uri) = parse_raw(&mut raw) {
                    msg.uri = uri;
                } else {
                    error!("{}: fail parse, retry", act.total_prepared_count);
                    break;
                }

                // берем поле [uri]
                if let Ok(uri_from_queue) = msg.get_first_literal(&mut raw, "uri") {
                    // найдем есть ли среди uri на которые есть подписки, uri из очереди
                    if let Some(el) = act.uri2sessions.get_mut(&uri_from_queue) {
                        debug!("FOUND CHANGES: uri={}, sessions={:?}", uri_from_queue, el.sessions);

                        // берем u_counter
                        let counter_from_queue = if let Ok(c) = msg.get_first_integer(&mut raw, "u_count") {
                            c as u64
                        } else {
                            0
                        };
                        debug!("uri={}, {}", uri_from_queue, counter_from_queue);

                        el.counter = counter_from_queue;

                        for session in el.sessions.iter() {
                            let urics = session2uris.entry(*session).or_default();
                            urics.insert(uri_from_queue.clone(), counter_from_queue);
                        }
                    }
                }

                act.queue_consumer.commit_and_next();

                act.total_prepared_count += 1;

                if act.total_prepared_count % 1000 == 0 {
                    info!("get from queue, count: {}", act.total_prepared_count);
                }
            }

            for el in session2uris.iter() {
                let mut changes = String::new();

                for (uri, counter) in el.1.iter() {
                    if !changes.is_empty() {
                        changes.push_str(",");
                    }

                    changes.push_str(&uri.to_owned());
                    changes.push_str("=");
                    changes.push_str(&counter.to_string());
                }

                if let Some(addr) = act.sessions.get(el.0) {
                    let _ = addr.do_send(Msg(changes.to_owned()));
                    debug!("send {}", changes);
                }
            }
        });
    }
}

/// Handler for Connect message. Register new session and assign unique id to this session
impl Handler<Connect> for CCUSServer {
    type Result = usize;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        // register session with random id

        let id = self.rng.gen::<usize>();
        self.sessions.insert(id, msg.addr);

        info!("[{}] Registred", id);

        // send id back
        id
    }
}

/// Handler for Disconnect message.
impl Handler<Disconnect> for CCUSServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        // remove address
        if self.sessions.remove(&msg.id).is_some() {
            info!("[{}] Unregistred", &msg.id);
            self.unsubscribe_all(msg.id, true);
        }
    }
}

/// Handler for Message message.
impl Handler<ClientMessage> for CCUSServer {
    type Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        self.prepare_command(msg.msg.as_str(), msg.id);
    }
}
