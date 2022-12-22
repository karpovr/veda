use crate::shared_data::{get_sessions, update_counter, SessionId};
use crate::SMessage;
use log::{error, info, warn};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::mpsc::Sender;
use std::thread::sleep;
use std::time::{Duration, Instant};
use v_common::onto::individual::{Individual, RawObj};
use v_common::onto::parser::parse_raw;
use v_common::v_queue::consumer::Consumer;
use v_common::v_queue::record::ErrorQueue;

const QUEUE_CHECK_MAX_TIME: Duration = Duration::from_millis(1000);

pub struct QueuePrepare {
    queue_consumer: Consumer,
}

type SessionsContext = HashMap<SessionId, HashMap<String, i64>>;

impl QueuePrepare {
    pub fn new() -> Self {
        let queue_name = "individuals-flow";
        for _ in 0..5 {
            if let Ok(queue_consumer) = Consumer::new("./data/queue", "CCUS2", "individuals-flow") {
                return QueuePrepare {
                    queue_consumer,
                    //total_prepared_count: 0,
                };
            }
            warn!("sleep, and then reopen queue ...");
            sleep(Duration::from_secs(1));
        }
        panic!("!!!!!!!!! FAIL OPEN QUEUE {queue_name}");
    }

    pub fn prepare_delta(&mut self, tx: &Sender<SMessage>) -> Option<SessionsContext> {
        let now = Instant::now();

        // READ QUEUE
        let mut size_batch = 0;
        let mut total_prepared_count = 0;
        // read queue current part info
        if let Err(e) = self.queue_consumer.queue.get_info_of_part(self.queue_consumer.id, true) {
            error!("{} get_info_of_part {}: {}", total_prepared_count, self.queue_consumer.id, e.as_str());
            return None;
        }

        match (self.queue_consumer.queue.count_pushed - self.queue_consumer.count_popped).cmp(&0) {
            Ordering::Greater => {
                if self.queue_consumer.queue.id == self.queue_consumer.id {
                    size_batch = self.queue_consumer.queue.count_pushed - self.queue_consumer.count_popped;
                } else {
                    size_batch = 1;
                }
            },
            Ordering::Less => {},
            Ordering::Equal => {
                // if not new messages, read queue info
                self.queue_consumer.queue.get_info_queue();

                if self.queue_consumer.queue.id > self.queue_consumer.id {
                    size_batch = 1;
                }
            },
        }

        if size_batch > 0 {
            info!("queue: batch size = {}", size_batch);
        }

        let mut session2uris: SessionsContext = HashMap::new();

        for _it in 0..size_batch {
            // пробуем взять из очереди заголовок сообщения
            if !self.queue_consumer.pop_header() {
                break;
            }

            let mut raw = RawObj::new(vec![0; (self.queue_consumer.header.msg_length) as usize]);

            // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
            if let Err(e) = self.queue_consumer.pop_body(&mut raw.data) {
                if e != ErrorQueue::FailReadTailMessage {
                    error!("failed to extract message from queue, total processed = {}, err = {}", total_prepared_count, e.as_str());
                }
                break;
            }

            let mut indv = Individual::new_raw(raw);

            if prepare_queue_el(tx, &mut indv, &mut session2uris).is_err() {
                error!("failed to parse message, total processed = {}", total_prepared_count);
                break;
            }

            self.queue_consumer.commit();

            total_prepared_count += 1;

            if total_prepared_count % 1000 == 0 {
                info!("total processed = {}", total_prepared_count);
            }

            if now.elapsed() > QUEUE_CHECK_MAX_TIME {
                warn!("break prepare: QUEUE_CHECK_MAX_TIME");
                break;
            }
        }
        Some(session2uris)
    }
}

fn prepare_queue_el(tx: &Sender<SMessage>, msg: &mut Individual, session2uris: &mut SessionsContext) -> Result<(), i32> {
    // запустим ленивый парсинг сообщения в Individual
    if parse_raw(msg).is_ok() {
    } else {
        return Err(-1);
    }

    // берем поле [uri]
    if let Some(uri_from_queue) = msg.get_first_literal("uri") {
        // найдем есть ли среди uri на которые есть подписки, uri из очереди
        let sessions = get_sessions(tx, &uri_from_queue).unwrap();
        if !sessions.is_empty() {
            info!("FOUND CHANGES: uri={}, sessions={:?}", uri_from_queue, sessions);

            // берем u_counter
            let counter_from_queue = msg.get_first_integer("u_count").unwrap_or_default();
            info!("uri={}, {}", uri_from_queue, counter_from_queue);

            update_counter(tx, &uri_from_queue, Some(counter_from_queue)).unwrap();

            for session in &sessions {
                let urics = session2uris.entry(*session).or_default();
                urics.insert(uri_from_queue.clone(), counter_from_queue);
            }
        }
    }

    Ok(())
}
