use actix::prelude::*;
use rand::{self, rngs::ThreadRng, Rng};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::str;
use std::sync::mpsc;
use std::sync::mpsc::{Receiver, Sender};
use std::time::Duration;
use v_common::module::module_impl::wait_load_ontology;
use v_common::onto::individual::{Individual, RawObj};
use v_common::onto::parser::parse_raw;
use v_common::v_queue::consumer::Consumer;
use v_common::v_queue::record::ErrorQueue;

const QUEUE_CHECK_INTERVAL: Duration = Duration::from_millis(300);
const STAT_INTERVAL: Duration = Duration::from_millis(10000);

pub type RData = (i64, u64);
pub type CMessage = (String, u64, Sender<RData>);

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

#[derive(Default)]
pub struct SubscribeElement {
    counter: u64,
    sessions: HashSet<usize>,
}

pub struct CCUSServer {
    sessions: HashMap<usize, Recipient<Msg>>,
    uri2sessions: HashMap<String, SubscribeElement>,
    queue_consumer: Consumer,
    total_prepared_count: u64,
    rng: ThreadRng,
    stat_sessions: usize,
    stat_uris: usize,
    subscribe_manager_sender: Sender<CMessage>,
    my_sender: Sender<RData>,
    my_receiver: Receiver<RData>,
    msg_id: u64,
}

impl CCUSServer {
    pub fn new(tx: Sender<CMessage>) -> CCUSServer {
        wait_load_ontology();

        let _consumer = Consumer::new("./data/queue", "CCUS1", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");
        let ch = mpsc::channel();

        info!("create CCUSServer");

        CCUSServer {
            sessions: HashMap::new(),
            uri2sessions: HashMap::new(),
            rng: rand::thread_rng(),
            queue_consumer: _consumer,
            total_prepared_count: 0,
            stat_sessions: 0,
            stat_uris: 0,
            subscribe_manager_sender: tx,
            my_sender: ch.0,
            my_receiver: ch.1,
            msg_id: 0,
        }
    }

    fn subscribe(&mut self, uri: &str, counter: u64, session_id: usize) -> u64 {
        let mut storage_counter = 0;
        // generate new id for sending message
        let msg_id = self.msg_id + 1;
        if !self.uri2sessions.contains_key(&uri.to_owned()) && self.subscribe_manager_sender.send((uri.to_string(), msg_id, self.my_sender.clone())).is_ok() {
            loop {
                if let Ok(msg) = self.my_receiver.recv_timeout(Duration::from_millis(1000)) {
                    // success receive, now store id of this message, for next id generate
                    match msg_id.cmp(&msg.1) {
                        Ordering::Greater => {
                            error!("received someone else's message, ignore it. expected = {} > received = {}", msg_id, msg.1);
                        },
                        Ordering::Less => {
                            error!("received someone else's message, ignore it. expected = {} < received = {}", msg_id, msg.1);
                        },
                        Ordering::Equal => {
                            if msg.0 >= 0 {
                                info!("{}, from storage: {}, {}", self.msg_id, uri, msg.0);
                                storage_counter = msg.0 as u64;
                            }
                            break;
                        },
                    }
                } else {
                    error!("failed to read message, timeout exceeded, message = {}, individual = {}", self.msg_id, uri);
                }
            }
            self.msg_id = msg_id;
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
        debug!("prepare_command: recv: {}", message);
        let mut changes = String::new();

        for item in message.split(',') {
            let els: Vec<&str> = item.split('=').collect();

            if els.len() == 2 {
                if els[0] == "ccus" {
                    // Рукопожатие: ccus=Ticket
                    debug!("[{}]: HANDSHAKE", session_id);
                    break;
                } else if let Some(uri) = els[0].get(1..) {
                    let mut counter = 0;
                    if let Ok(c) = els[1].parse() {
                        counter = c;
                    };
                    // Добавить подписку: +uriN=M[,...]

                    let registered_counter = self.subscribe(uri, counter, session_id);

                    if registered_counter > counter {
                        if !changes.is_empty() {
                            changes.push(',');
                        }

                        changes.push_str(uri);
                        changes.push('=');
                        changes.push_str(&registered_counter.to_string());
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
                debug!("prepare_command: send {}", changes);
            }
        }
    }
}

/// Make actor from `CCUSServer`
impl Actor for CCUSServer {
    /// We are going to use simple Context, we just need ability to communicate with other actors.
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        info!("start CCUS");

        ctx.run_interval(STAT_INTERVAL, |act, _ctx| {
            if act.sessions.len() != act.stat_sessions || act.uri2sessions.len() != act.stat_uris {
                info!("stats: count subscribers: {}, look uris: {}", act.sessions.len(), act.uri2sessions.len());

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

            match (act.queue_consumer.queue.count_pushed - act.queue_consumer.count_popped).cmp(&0) {
                Ordering::Greater => {
                    if act.queue_consumer.queue.id != act.queue_consumer.id {
                        size_batch = 1;
                    } else {
                        size_batch = act.queue_consumer.queue.count_pushed - act.queue_consumer.count_popped;
                    }
                },
                Ordering::Less => {},
                Ordering::Equal => {
                    // if not new messages, read queue info
                    act.queue_consumer.queue.get_info_queue();

                    if act.queue_consumer.queue.id > act.queue_consumer.id {
                        size_batch = 1;
                    }
                },
            }

            if size_batch > 0 {
                info!("queue: batch size = {}", size_batch);
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
                    if e != ErrorQueue::FailReadTailMessage {
                        error!("failed to extract message from queue, total processed = {}, err = {}", act.total_prepared_count, e.as_str());
                    }
                    break;
                }

                let mut indv = Individual::new_raw(raw);

                if prepare_queue_el(&mut indv, &mut act.uri2sessions, &mut session2uris).is_err() {
                    error!("failed to parse message, total processed = {}", act.total_prepared_count);
                    break;
                }

                act.queue_consumer.commit();

                act.total_prepared_count += 1;

                if act.total_prepared_count % 1000 == 0 {
                    info!("total processed = {}", act.total_prepared_count);
                }
            }

            for el in session2uris.iter() {
                let mut changes = String::new();

                for (uri, counter) in el.1.iter() {
                    if !changes.is_empty() {
                        changes.push(',');
                    }

                    changes.push_str(uri);
                    changes.push('=');
                    changes.push_str(&counter.to_string());
                }

                if let Some(addr) = act.sessions.get(el.0) {
                    let _ = addr.do_send(Msg(changes.to_owned()));
                    debug!("run_interval: send {}", changes);
                }
            }
        });
    }
}

fn prepare_queue_el(
    msg: &mut Individual,
    uri2sessions: &mut HashMap<String, SubscribeElement>,
    session2uris: &mut HashMap<usize, HashMap<String, u64>>,
) -> Result<(), i32> {
    // запустим ленивый парсинг сообщения в Individual
    if parse_raw(msg).is_ok() {
    } else {
        return Err(-1);
    }

    // берем поле [uri]
    if let Some(uri_from_queue) = msg.get_first_literal("uri") {
        // найдем есть ли среди uri на которые есть подписки, uri из очереди
        if let Some(el) = uri2sessions.get_mut(&uri_from_queue) {
            debug!("FOUND CHANGES: uri={}, sessions={:?}", uri_from_queue, el.sessions);

            // берем u_counter
            let counter_from_queue = msg.get_first_integer("u_count").unwrap_or_default() as u64;
            debug!("uri={}, {}", uri_from_queue, counter_from_queue);

            el.counter = counter_from_queue;

            for session in el.sessions.iter() {
                let urics = session2uris.entry(*session).or_default();
                urics.insert(uri_from_queue.clone(), counter_from_queue);
            }
        }
    }

    Ok(())
}

/// Handler for Connect message. Register new session and assign unique id to this session
impl Handler<Connect> for CCUSServer {
    type Result = usize;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        // register session with random id

        let id = self.rng.gen::<usize>();
        self.sessions.insert(id, msg.addr);

        info!("registered [{}]", id);

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
            info!("unregistered [{}]", &msg.id);
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
