use crate::shared_data::{subscribe, unsubscribe, unsubscribe_all, SessionId};
use crate::SMessage;
use log::debug;
use std::sync::mpsc::Sender;

pub struct SubscribeManager {
    pub shared_data_ch: Sender<SMessage>,
}

impl SubscribeManager {
    pub fn new(shared_data_ch: Sender<SMessage>) -> SubscribeManager {
        SubscribeManager {
            shared_data_ch,
        }
    }

    pub fn prepare_command(&mut self, message: &str, session_id: usize) -> String {
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

                    let registered_counter = subscribe(&self.shared_data_ch, uri, counter, session_id as SessionId).unwrap();

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
                        unsubscribe_all(&self.shared_data_ch, session_id as SessionId, false).unwrap();
                    } else {
                        // Отменить подписку: -uriN[,...]
                        unsubscribe(&self.shared_data_ch, uri, session_id as SessionId).unwrap();
                        debug!("[{}]: REMOVE FROM URI={}", session_id, &uri);
                    }
                }
            }
        }

        changes
    }
}
