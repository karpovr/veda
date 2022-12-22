use log::{debug, error, info};
use std::collections::{HashMap, HashSet};
use std::sync::mpsc;
use std::sync::mpsc::{Receiver, RecvError, SendError, Sender};
use thiserror::Error;
use v_common::module::module_impl::wait_load_ontology;
use v_common::module::veda_backend::get_storage_use_prop;
use v_common::onto::individual::Individual;
use v_common::storage::common::{StorageMode, VStorage};

#[derive(Error, Debug)]
pub enum SharedDataManagerError {
    #[error("not send to shared-data-manager")]
    NotSend(#[from] SendError<SMessage>),
    #[error("not recv from shared-data-manager")]
    NotRecv(#[from] RecvError),
    #[error("unknown shared-data-manager error")]
    Unknown,
}

pub type SessionId = u32;

#[derive(PartialEq)]
enum Cmd {
    Subscribe,
    Unsubscribe,
    UnsubscribeAll,
    GetSessions,
    UpdateCounter,
}

pub struct OutData {
    counter: Option<i64>,
    sessions: Option<Vec<SessionId>>,
}

pub struct InData {
    cmd: Cmd,
    uri: Option<String>,
    session_id: Option<SessionId>,
    counter: Option<i64>,
    is_clear_unused: Option<bool>,
    out_ch: Sender<SMessage>,
}

pub enum SMessage {
    In(InData),
    Out(OutData),
}

#[derive(Default)]
pub struct SubscribeElement {
    pub(crate) counter: i64,
    pub(crate) sessions: HashSet<SessionId>,
}

pub struct SharedDataManager {
    //total_prepared_count: u64,
    uri2sessions: HashMap<String, SubscribeElement>,
    storage: VStorage,
}

impl SharedDataManager {
    fn find_counter(&mut self, uri: &str) -> Option<i64> {
        let mut indv = Individual::default();
        self.storage.get_individual(uri, &mut indv);
        if let Some(counter) = indv.get_first_integer("v-s:updateCounter") {
            info!("read from storage: {}, {}", uri, counter);
            return Some(counter);
        }
        None
    }

    fn subscribe(&mut self, uri: &str, counter: i64, session_id: SessionId) -> i64 {
        let new_counter = if let Some(v) = self.uri2sessions.get(uri) {
            if v.sessions.is_empty() {
                self.find_counter(uri)
            } else {
                None
            }
        } else {
            self.find_counter(uri)
        };

        let res = self.add_session_to_uri(uri, session_id, new_counter);

        if res.0 {
            debug!("[{}]: SUBSCRIBE: uri={}, counter={}, count subscribers={}", session_id, uri, counter, -1);
        } else {
            debug!("[{}]: SUBSCRIBE (ALREADY EXISTS): uri={}, count subscribers={}", session_id, uri, -1);
        }

        res.1
    }

    pub fn add_session_to_uri(&mut self, uri: &str, session_id: SessionId, counter: Option<i64>) -> (bool, i64) {
        let el = self.uri2sessions.entry(uri.to_owned()).or_default();
        let insert = if el.sessions.contains(&session_id) {
            false
        } else {
            el.sessions.insert(session_id);
            true
        };

        if let Some(v) = counter {
            el.counter = v;
        }

        (insert, el.counter)
    }

    pub fn run(rx: Receiver<SMessage>) {
        info!("start shared data manager");
        wait_load_ontology();
        let storage = get_storage_use_prop(StorageMode::ReadOnly);

        let mut srv = SharedDataManager {
            //total_prepared_count: 0,
            storage,
            uri2sessions: HashMap::default(),
        };

        loop {
            if let Ok(m) = rx.recv() {
                match m {
                    SMessage::In(d) => match d.cmd {
                        Cmd::UpdateCounter => {
                            let el = srv.uri2sessions.entry(d.uri.unwrap()).or_default();

                            el.counter = d.counter.unwrap();
                        },
                        Cmd::GetSessions => {
                            let mut sessions = vec![];

                            if let Some(v) = srv.uri2sessions.get(&d.uri.unwrap()) {
                                for el in &v.sessions {
                                    sessions.push(*el);
                                }
                            }

                            let msg_s = SMessage::Out(OutData {
                                //data: None,
                                counter: None,
                                sessions: Some(sessions),
                            });
                            if let Err(e) = d.out_ch.send(msg_s) {
                                error!("fail send to out channel, err={:?}", e);
                            }
                        },
                        Cmd::Subscribe => {
                            let counter = srv.subscribe(&d.uri.unwrap(), d.counter.unwrap(), d.session_id.unwrap());

                            let msg_s = SMessage::Out(OutData {
                                //data: None,
                                counter: Some(counter),
                                sessions: None,
                            });
                            if let Err(e) = d.out_ch.send(msg_s) {
                                error!("fail send to out channel, err={:?}", e);
                            }
                        },
                        Cmd::Unsubscribe => {
                            let el = srv.uri2sessions.entry(d.uri.unwrap()).or_default();

                            if el.sessions.contains(&d.session_id.unwrap()) {
                                el.sessions.remove(&d.session_id.unwrap());
                            }
                        },
                        Cmd::UnsubscribeAll => {
                            let mut empty_uris: Vec<String> = Vec::new();

                            for (uri, uss) in &mut srv.uri2sessions {
                                if uss.sessions.contains(&d.session_id.unwrap()) {
                                    uss.sessions.remove(&d.session_id.unwrap());
                                    debug!("[{}]: REMOVE FROM URI={}", d.session_id.unwrap(), uri,);
                                }

                                if let Some(b) = d.is_clear_unused {
                                    if b && uss.sessions.is_empty() {
                                        empty_uris.push(uri.clone());
                                    }
                                }
                            }

                            if let Some(b) = d.is_clear_unused {
                                if b {
                                    for uri in empty_uris {
                                        srv.uri2sessions.remove(&uri);
                                        debug!("REMOVE URI={}", uri,);
                                    }
                                }
                            }
                        },
                    },
                    SMessage::Out(_) => {},
                }
            }
        }
    }
}

// utils

pub fn subscribe(tx: &Sender<SMessage>, uri: &str, counter: i64, session_id: SessionId) -> Result<i64, SharedDataManagerError> {
    let (q_tx, q_rx): (Sender<SMessage>, Receiver<SMessage>) = mpsc::channel();
    let s_msg = SMessage::In(InData {
        cmd: Cmd::Subscribe,
        uri: Some(uri.to_owned()),
        session_id: Some(session_id),
        counter: Some(counter),
        is_clear_unused: None,
        out_ch: q_tx,
    });
    tx.send(s_msg)?;
    if let SMessage::Out(r) = q_rx.recv()? {
        return Ok(r.counter.unwrap_or_default());
    }
    Err(SharedDataManagerError::Unknown)
}

pub fn unsubscribe(tx: &Sender<SMessage>, uri: &str, session_id: SessionId) -> Result<(), SharedDataManagerError> {
    let (q_tx, _q_rx): (Sender<SMessage>, Receiver<SMessage>) = mpsc::channel();
    let s_msg = SMessage::In(InData {
        cmd: Cmd::Unsubscribe,
        uri: Some(uri.to_owned()),
        session_id: Some(session_id),
        counter: None,
        is_clear_unused: None,
        out_ch: q_tx,
    });
    tx.send(s_msg)?;
    Ok(())
}

pub fn unsubscribe_all(tx: &Sender<SMessage>, session_id: SessionId, is_clear_unused: bool) -> Result<(), SharedDataManagerError> {
    let (q_tx, _q_rx): (Sender<SMessage>, Receiver<SMessage>) = mpsc::channel();
    let s_msg = SMessage::In(InData {
        cmd: Cmd::UnsubscribeAll,
        uri: None,
        session_id: Some(session_id),
        counter: None,
        is_clear_unused: Some(is_clear_unused),
        out_ch: q_tx,
    });
    tx.send(s_msg)?;
    Ok(())
}

pub fn update_counter(tx: &Sender<SMessage>, uri: &str, counter: Option<i64>) -> Result<(), SharedDataManagerError> {
    let (q_tx, _q_rx): (Sender<SMessage>, Receiver<SMessage>) = mpsc::channel();
    let s_msg = SMessage::In(InData {
        cmd: Cmd::UpdateCounter,
        uri: Some(uri.to_owned()),
        session_id: None,
        counter,
        is_clear_unused: None,
        out_ch: q_tx,
    });
    tx.send(s_msg)?;
    Ok(())
}

pub fn get_sessions(tx: &Sender<SMessage>, uri: &str) -> Result<Vec<SessionId>, SharedDataManagerError> {
    let (q_tx, q_rx): (Sender<SMessage>, Receiver<SMessage>) = mpsc::channel();
    let s_msg = SMessage::In(InData {
        cmd: Cmd::GetSessions,
        uri: Some(uri.to_owned()),
        session_id: None,
        counter: None,
        is_clear_unused: None,
        out_ch: q_tx,
    });
    tx.send(s_msg)?;
    if let Ok(SMessage::Out(r)) = q_rx.recv() {
        if let Some(v) = r.sessions {
            return Ok(v);
        }
    }
    Err(SharedDataManagerError::Unknown)
}
