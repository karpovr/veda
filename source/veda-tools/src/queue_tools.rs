use chrono::{TimeZone, Utc};
use crc32fast::Hasher;
use v_v8::v_common::ft_xapian::xapian_reader::XapianReader;
use v_v8::v_common::module::module_impl::{get_cmd, get_inner_binobj_as_individual, PrepareError};
use v_v8::v_common::module::veda_backend::Backend;
use v_v8::v_common::onto::individual::{Individual, RawObj};
use v_v8::v_common::onto::individual2msgpack::to_msgpack;
use v_v8::v_common::onto::parser::parse_raw;
use v_v8::v_common::search::common::FTQuery;
use v_v8::v_common::v_api::api_client::IndvOp;
use v_v8::v_common::v_api::obj::ResultCode;
use v_v8::v_common::v_queue::consumer::Consumer;
use v_v8::v_common::v_queue::queue::Queue;
use v_v8::v_common::v_queue::record::{Mode, MsgType};

pub fn export_from_query(query: &str) -> Result<(), PrepareError> {
    let mut backend = Backend::default();

    let mut queue_out = Queue::new("./data/out", "tools-extract", Mode::ReadWrite).expect("!!!!!!!!! FAIL QUEUE");

    if let Some(mut xr) = XapianReader::new("russian", &mut backend.storage) {
        let mut ftq = FTQuery::new_with_user("cfg:VedaSystem", query);
        ftq.top = 1000000;
        ftq.limit = 1000000;
        info!("execute query [{:?}]", ftq);
        let res = xr.query(ftq, &mut backend.storage);
        if res.result_code == ResultCode::Ok && res.count > 0 {
            for id in &res.result {
                if let Some(indv) = backend.get_individual(id, &mut Individual::default()) {
                    let msg_id = indv.get_id().to_string();
                    indv.parse_all();
                    add_to_queue(&mut queue_out, IndvOp::Put, indv, &msg_id)?;
                }
            }
        }
    }
    Ok(())
}

fn add_to_queue(queue_out: &mut Queue, cmd: IndvOp, new_state_indv: &mut Individual, msg_id: &str) -> Result<(), PrepareError> {
    new_state_indv.parse_all();

    let mut raw: Vec<u8> = Vec::new();
    if to_msgpack(&new_state_indv, &mut raw).is_ok() {
        let mut new_indv = Individual::default();
        new_indv.set_id(msg_id);
        new_indv.add_binary("new_state", raw);
        new_indv.add_integer("cmd", cmd as i64);
        //new_indv.add_integer("date", date);

        info!("add to export queue: uri = {}", new_state_indv.get_id());

        let mut raw1: Vec<u8> = Vec::new();
        if let Err(e) = to_msgpack(&new_indv, &mut raw1) {
            error!("failed to serialize, err = {:?}", e);
            return Err(PrepareError::Fatal);
        }
        if let Err(e) = queue_out.push(&raw1, MsgType::Object) {
            error!("failed to push into queue, err = {:?}", e);
            return Err(PrepareError::Fatal);
        }
    }
    Ok(())
}

pub fn queue_to_veda(queue_path: String, part_id: Option<u32>, check_counter: bool) {
    let mut backend = Backend::default();

    let sys_ticket = backend.get_sys_ticket_id();

    if sys_ticket.is_err() {
        error!("failed to read systicket, exit");
        return;
    }

    let sys_ticket = sys_ticket.unwrap();

    let mut queue_consumer = Consumer::new(&queue_path, "queue2storage", "individuals-flow").expect("!!!!!!!!! FAIL OPEN QUEUE");

    if let Some(id) = part_id {
        queue_consumer.id = id;
        queue_consumer.queue.open_part(id).expect(&format!("fail open part id={}", id));
    }
    // read queue current part info
    if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
        error!("failed to get_info_of_part {}: {}", queue_consumer.id, e.as_str());
        return;
    }

    let size_batch = queue_consumer.get_batch_size();

    for _idx in 0..size_batch {
        // пробуем взять из очереди заголовок сообщения
        if !queue_consumer.pop_header() {
            break;
        }

        let mut raw = RawObj::new(vec![0; (queue_consumer.header.msg_length) as usize]);

        // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
        if let Err(_e) = queue_consumer.pop_body(&mut raw.data) {
            break;
        }

        let mut queue_element = Individual::new_raw(raw);
        if parse_raw(&mut queue_element).is_ok() {
            let mut new_state = Individual::default();
            get_inner_binobj_as_individual(&mut queue_element, "new_state", &mut new_state);
            new_state.parse_all();

            let mut is_update = false;
            if !new_state.is_empty() {
                let mut indv_from_db = Individual::default();
                if check_counter {
                    if backend.storage.get_individual(new_state.get_id(), &mut indv_from_db) {
                        let db_indv_counter = new_state.get_first_integer("v-s:updateCounter").unwrap_or(0);
                        let queue_indv_counter = indv_from_db.get_first_integer("v-s:updateCounter").unwrap_or(0);

                        if queue_indv_counter > db_indv_counter {
                            is_update = true;
                        } else {
                            warn!("{}, counter db:{} >= queue:{}, skip it", new_state.get_id(), db_indv_counter, queue_indv_counter);
                        }
                    }
                } else {
                    is_update = true;
                }

                if is_update {
                    let res = backend.mstorage_api.update(&sys_ticket, IndvOp::Put, &mut new_state);
                    if res.result != ResultCode::Ok {
                        error!("failed to store individual, id = {}", new_state.get_id());
                        return;
                    } else {
                        info!("update {}", new_state.get_id());
                    }
                }
            }
        }
    }
}

pub fn queue_crc(queue_path: String, part_id: Option<u32>) {
    let mut queue_consumer = Consumer::new(&queue_path, "queue2crc", "individuals-flow").expect("!!!!!!!!! FAIL OPEN QUEUE");

    if let Some(id) = part_id {
        queue_consumer.id = id;
        queue_consumer.queue.open_part(id).expect(&format!("fail open part id={}", id));
    }
    // read queue current part info
    if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
        error!("get_info_of_part {}: {}", queue_consumer.id, e.as_str());
        return;
    }

    let mut hash = Hasher::new();
    let mut count = 0;

    loop {
        let size_batch = queue_consumer.get_batch_size();
        if size_batch == 0 {
            break;
        }
        for idx in 0..size_batch + 1 {
            // пробуем взять из очереди заголовок сообщения
            if !queue_consumer.pop_header() {
                break;
            }

            let mut raw = RawObj::new(vec![0; (queue_consumer.header.msg_length) as usize]);

            // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
            if let Err(_e) = queue_consumer.pop_body(&mut raw.data) {
                info!("fail get body");
                break;
            }

            hash.update(&raw.data);
            count += 1;
            if idx % 100000 == 0 {
                info!("queue part={}, part_count={}, total_count={}", queue_consumer.id, idx, count);
            }
        }
    }

    info!("total count record={}, CRC={}", count, hash.finalize());
}

pub fn queue_to_json(queue_path: String, part_id: Option<u32>) {
    let mut queue_consumer = Consumer::new(&queue_path, "queue2json", "individuals-flow").expect("!!!!!!!!! FAIL OPEN QUEUE");

    if let Some(id) = part_id {
        queue_consumer.id = id;
        queue_consumer.queue.open_part(id).expect(&format!("fail open part id={}", id));
    }
    // read queue current part info
    if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
        error!("failed to get_info_of_part {}: {}", queue_consumer.id, e.as_str());
        return;
    }

    let size_batch = queue_consumer.get_batch_size();

    for _idx in 0..size_batch {
        // пробуем взять из очереди заголовок сообщения
        if !queue_consumer.pop_header() {
            break;
        }

        let mut raw = RawObj::new(vec![0; (queue_consumer.header.msg_length) as usize]);

        // заголовок взят успешно, занесем содержимое сообщения в структуру Individual
        if let Err(_e) = queue_consumer.pop_body(&mut raw.data) {
            break;
        }

        let mut queue_element = Individual::new_raw(raw);

        if parse_raw(&mut queue_element).is_ok() {
            let uri = queue_element.get_first_literal("uri").unwrap_or_default();
            let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();
            let date = queue_element.get_first_datetime("date").unwrap_or_default();
            let src = queue_element.get_first_literal("src").unwrap_or_default();
            let cmd = get_cmd(&mut queue_element);
            let event_id = queue_element.get_first_literal("event_id").unwrap_or_default();
            let user_id = queue_element.get_first_literal("user_uri").unwrap_or_default();
            println!(
                "{:?}, uri=\"{}\", op_id={}, src={}, cmd={:?}, event_id={}, user_id={}",
                &format!("{:?}", &Utc.timestamp(date, 0)),
                uri,
                op_id,
                src,
                cmd,
                event_id,
                user_id
            );

            let mut prev_state = Individual::default();
            get_inner_binobj_as_individual(&mut queue_element, "prev_state", &mut prev_state);
            prev_state.parse_all();

            let mut new_state = Individual::default();
            get_inner_binobj_as_individual(&mut queue_element, "new_state", &mut new_state);
            new_state.parse_all();

            if !prev_state.is_empty() {
                println!("prev_state: {}", prev_state.get_obj().as_json_str());
            }

            if !new_state.is_empty() {
                println!("new_state: {}", new_state.get_obj().as_json_str());
            }
        }
    }
    //queue_consumer.commit();
}
