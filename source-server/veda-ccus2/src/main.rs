extern crate env_logger;
extern crate ws;

use crate::command::SubscribeManager;
use crate::queue_prepare::QueuePrepare;
use crate::shared_data::{unsubscribe_all, SMessage, SharedDataManager};
use chrono::Local;
use env_logger::Builder;
use log::{info, warn, LevelFilter};
use std::collections::HashMap;
use std::io::Write;
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::thread::sleep;
use std::time::{Duration, Instant};
use v_common::module::module_impl::Module;
use ws::{CloseCode, Handler, Message, Result, Sender as WSSender, Settings};

mod command;
mod queue_prepare;
mod shared_data;

const HEARTBEAT_TIME: Duration = Duration::from_millis(5000);

struct WSCtx {
    ws: WSSender,
    send_time: Instant,
}

struct Server<'a> {
    wsctx: WSCtx,
    subscr: SubscribeManager,
    ws_conn_pool: &'a Arc<Mutex<HashMap<u32, WSCtx>>>,
}

impl<'a> Server<'a> {
    fn new(sdm_tx: Sender<SMessage>, ws: WSSender, ws_conn_pool: &'a Arc<Mutex<HashMap<u32, WSCtx>>>) -> Server<'a> {
        let srv = Server {
            wsctx: WSCtx {
                ws,
                send_time: Instant::now(),
            },
            subscr: SubscribeManager::new(sdm_tx),
            ws_conn_pool,
        };

        if let Ok(mut w) = ws_conn_pool.lock() {
            w.insert(
                srv.wsctx.ws.connection_id(),
                WSCtx {
                    ws: srv.wsctx.ws.clone(),
                    send_time: Instant::now(),
                },
            );
        }
        srv
    }
}

impl<'a> Handler for Server<'a> {
    fn on_message(&mut self, msg: Message) -> Result<()> {
        info!("-> [{:?}] '{}'. ", self.wsctx.ws.connection_id(), msg);

        let ret = self.subscr.prepare_command(msg.as_text().unwrap_or_default(), self.wsctx.ws.connection_id() as usize);

        info!("<- [{:?}] '{}'. ", self.wsctx.ws.connection_id(), ret);
        self.wsctx.send_time = Instant::now();
        self.wsctx.ws.send(ret)
    }

    fn on_close(&mut self, _: CloseCode, m: &str) {
        warn!("CLOSE {}, msg={}", self.wsctx.ws.connection_id(), m);
        if let Ok(mut w) = self.ws_conn_pool.lock() {
            w.remove(&self.wsctx.ws.connection_id());
            unsubscribe_all(&self.subscr.shared_data_ch, self.wsctx.ws.connection_id(), false).unwrap();
        }
    }
}

fn main() {
    let env_var = "RUST_LOG";
    match std::env::var_os(env_var) {
        Some(val) => println!("use env var: {env_var}: {:?}", val.to_str()),
        None => std::env::set_var(env_var, "info,actix_server=info,actix_web=info"),
    }

    Builder::new()
        .format(|buf, record| writeln!(buf, "{} [{}] - {}", Local::now().format("%Y-%m-%dT%H:%M:%S%.3f"), record.level(), record.args()))
        .filter(None, LevelFilter::Info)
        .init();

    let ccus_port = Module::get_property("ccus_port").expect("param [ccus_port] not found in veda.properties");

    // start shared data manager

    let (sdm_tx, sdm_rx): (Sender<SMessage>, Receiver<SMessage>) = mpsc::channel();
    let c_sdm_tx = sdm_tx.clone();
    thread::spawn(move || SharedDataManager::run(sdm_rx));

    let mut qp = QueuePrepare::new();

    info!("ccus2 port = {:?}", ccus_port);

    let wb = Arc::new(Mutex::new(HashMap::new()));
    let ww = wb.clone();

    let _server = thread::Builder::new()
        .name("server".to_owned())
        .spawn(move || {
            let ws = ws::Builder::new()
                .with_settings(Settings {
                    max_connections: 5000,
                    ..Settings::default()
                })
                .build(|out| Server::new(sdm_tx.clone(), out, &ww))
                .unwrap();
            ws.listen(format!("0.0.0.0:{ccus_port}")).unwrap();
        })
        .unwrap();

    loop {
        if let Some(delta) = qp.prepare_delta(&c_sdm_tx) {
            if let Ok(mut chid_2_ws) = wb.lock() {
                // send HEARTBEAT
                for wsc in chid_2_ws.values_mut() {
                    if wsc.send_time.elapsed() > HEARTBEAT_TIME && wsc.ws.send("").is_ok() {
                        wsc.send_time = Instant::now();
                        //info!("<- [{}] HEARTBEAT", wsc.ws.connection_id());
                    }
                }

                // send changes
                for (ch_id, vals) in &delta {
                    let mut changes = String::new();

                    for (uri, counter) in vals.iter() {
                        if !changes.is_empty() {
                            changes.push(',');
                        }

                        changes.push_str(uri);
                        changes.push('=');
                        changes.push_str(&counter.to_string());
                    }

                    if !changes.is_empty() {
                        if let Some(wsc) = chid_2_ws.get_mut(ch_id) {
                            if wsc.ws.send(changes.clone()).is_ok() {
                                wsc.send_time = Instant::now();
                                info!("<- [{}] '{}'. ", ch_id, changes);
                            }
                        }
                    }
                }
            }
        }

        sleep(Duration::from_secs(1));
        thread::yield_now();
    }
}
