use chrono::Utc;
use v_common::module::info::ModuleInfo;
use v_common::module::ticket::Ticket;
use v_common::onto::datatype::Lang;
use v_common::onto::individual::Individual;
use v_common::onto::individual2msgpack::to_msgpack;
use v_common::storage::common::{StorageId, VStorage};
use v_common::v_api::api_client::IndvOp;
use v_common::v_api::obj::ResultCode;
use v_common::v_queue::queue::Queue;
use v_common::v_queue::record::MsgType;

pub struct TransactionItem {
    pub indv_id: String,
    pub cmd: IndvOp,
    pub original_cmd: IndvOp,
    pub new_state: Vec<u8>,
    pub prev_state: Vec<u8>,
    pub update_counter: i64,
}

pub struct Transaction<'a> {
    pub id: i64,
    pub event_id: Option<&'a str>,
    pub assigned_subsystems: Option<i64>,
    pub src: Option<&'a str>,
    pub queue: Vec<TransactionItem>,
    pub sys_ticket: String,
    pub ticket: Ticket,
}

impl<'a> Transaction<'a> {
    pub(crate) fn add_item(&mut self, item: TransactionItem) {
        self.queue.push(item);
    }

    pub(crate) fn commit(&mut self, storage: &mut VStorage, queue_out: &mut Queue, mstorage_info: &mut ModuleInfo) -> Result<i64, ResultCode> {
        let mut op_id = self.id;

        for el in self.queue.iter() {
            op_id += 1;

            if el.indv_id.is_empty() {
                warn!(
                    "SKIP:{}, {} id={}:{}, ticket={}, event_id={}, src={}",
                    op_id,
                    el.original_cmd.as_string(),
                    el.indv_id,
                    el.update_counter,
                    self.ticket.id,
                    self.event_id.unwrap_or_default(),
                    self.src.unwrap_or_default()
                );
                continue;
            }

            if el.cmd == IndvOp::Remove {
                if storage.remove(StorageId::Individuals, &el.indv_id) {
                    info!("remove individual, id = {}", el.indv_id);
                } else {
                    error!("failed to remove individual, id = {}", el.indv_id);
                    return Err(ResultCode::InternalServerError);
                }
            } else if storage.put_kv_raw(StorageId::Individuals, &el.indv_id, el.new_state.clone()) {
                info!(
                    "OK:{}, {} id={}:{}, ticket={}, event_id={}, src={}",
                    op_id,
                    el.original_cmd.as_string(),
                    el.indv_id,
                    el.update_counter,
                    self.ticket.id,
                    self.event_id.unwrap_or_default(),
                    self.src.unwrap_or_default()
                );
            } else {
                error!("failed to update individual, id = {}", el.indv_id);
                return Err(ResultCode::InternalServerError);
            }

            // add to queue
            let mut store_to_queue = if let Some(i) = self.assigned_subsystems {
                i != 1
            } else {
                true
            };

            if el.cmd == IndvOp::Remove && el.prev_state.is_empty() {
                store_to_queue = false;
            }

            if store_to_queue {
                let mut queue_element = Individual::default();
                queue_element.set_id(&format!("{}", op_id));
                queue_element.set_integer("cmd", el.cmd.to_i64());
                queue_element.set_uri("uri", &el.indv_id);

                if !self.ticket.user_uri.is_empty() {
                    queue_element.set_uri("user_uri", &self.ticket.user_uri);
                }

                if !el.new_state.is_empty() {
                    queue_element.set_binary("new_state", el.new_state.clone());
                }

                if !el.prev_state.is_empty() {
                    queue_element.set_binary("prev_state", el.prev_state.clone());
                }

                if let Some(v) = self.event_id {
                    queue_element.set_string("event_id", v, Lang::none());
                }

                queue_element.set_integer("tnx_id", op_id);

                let src = if let Some(v) = self.src {
                    if v.is_empty() {
                        "?"
                    } else {
                        v
                    }
                } else {
                    "?"
                };
                queue_element.set_string("src", src, Lang::none());
                queue_element.add_datetime("date", Utc::now().naive_utc().timestamp());
                queue_element.add_integer("op_id", op_id);
                queue_element.add_integer("u_count", el.update_counter);

                if let Some(i) = self.assigned_subsystems {
                    queue_element.add_integer("assigned_subsystems", i);
                }

                debug!("add to queue: uri={}", el.indv_id);

                let mut raw1: Vec<u8> = Vec::new();
                if let Err(e) = to_msgpack(&queue_element, &mut raw1) {
                    error!("failed to serialize, err = {:?}", e);
                    return Err(ResultCode::InternalServerError);
                }
                if let Err(e) = queue_out.push(&raw1, MsgType::String) {
                    error!("failed to push message to queue, err = {:?}", e);
                    return Err(ResultCode::InternalServerError);
                }
            }
        }

        if let Err(e) = mstorage_info.put_info(op_id, op_id) {
            error!("failed to put info, err = {:?}", e);
            return Err(ResultCode::InternalServerError);
        }

        Ok(op_id)
    }
}
