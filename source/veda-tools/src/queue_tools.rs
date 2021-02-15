use v_module::v_api::app::ResultCode;
use v_module::v_api::IndvOp;
use v_ft_xapian::xapian_reader::XapianReader;
use v_module::module::*;
use v_module::module::{Module, PrepareError};
use v_module::v_onto::individual::Individual;
use v_module::v_onto::individual::*;
use v_module::v_onto::individual2msgpack::to_msgpack;
use v_module::v_onto::parser::*;
use v_queue::consumer::Consumer;
use v_queue::queue::Queue;
use v_queue::record::{Mode, MsgType};
use v_module::v_search::common::FTQuery;

pub fn export_from_query(query: &str) -> Result<(), PrepareError> {
    let mut module = Module::default();

    let mut queue_out = Queue::new("./data/out", "tools-extract", Mode::ReadWrite).expect("!!!!!!!!! FAIL QUEUE");

    if let Some(mut xr) = XapianReader::new("russian", &mut module.storage) {
        let mut ftq = FTQuery::new_with_user("cfg:VedaSystem", query);
        ftq.top = 1000000;
        ftq.limit = 1000000;
        info!("execute query [{:?}]", ftq);
        let res = xr.query(ftq, &mut module.storage);
        if res.result_code == ResultCode::Ok && res.count > 0 {
            for id in &res.result {
                if let Some(indv) = module.get_individual(id, &mut Individual::default()) {
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

        info!("add to export queue: uri={}", new_state_indv.get_id());

        let mut raw1: Vec<u8> = Vec::new();
        if let Err(e) = to_msgpack(&new_indv, &mut raw1) {
            error!("fail serialize, err={:?}", e);
            return Err(PrepareError::Fatal);
        }
        if let Err(e) = queue_out.push(&raw1, MsgType::Object) {
            error!("fail push into queue, err={:?}", e);
            return Err(PrepareError::Fatal);
        }
    }
    Ok(())
}

pub fn queue_to_veda() {}

pub fn queue_to_json(queue_path: String, part_id: u32) {
    let mut queue_consumer = Consumer::new(&queue_path, "queue2json", "individuals-flow").expect("!!!!!!!!! FAIL OPEN QUEUE");

    queue_consumer.id = part_id;
    queue_consumer.queue.open_part(part_id).expect(&format!("fail open part id={}", part_id));

    // read queue current part info
    if let Err(e) = queue_consumer.queue.get_info_of_part(queue_consumer.id, true) {
        error!("get_info_of_part {}: {}", queue_consumer.id, e.as_str());
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

        queue_consumer.next(false);
    }
    //queue_consumer.commit();
}
