#[macro_use]
extern crate log;

use std::thread;
use v_common::module::info::ModuleInfo;
use v_common::module::module_impl::{get_cmd, init_log, Module, PrepareError};
use v_common::module::veda_backend::Backend;
use v_common::onto::individual::Individual;
use v_common::storage::common::StorageMode;
use v_common::v_api::api_client::IndvOp;
use v_common::v_queue::consumer::Consumer;
use v_common::v_queue::queue::Queue;
use v_common::v_queue::record::{Mode, MsgType};

pub const MSTORAGE_ID: i64 = 1;

struct Context {
    queue_out: Queue,
}

fn main() -> Result<(), i32> {
    let base_path = "./data";

    init_log("QUEUE_2_IDS");

    let mut module = Module::default();
    let mut backend = Backend::create(StorageMode::ReadOnly, false);
    while !backend.mstorage_api.connect() {
        info!("waiting for start of main module...");
        thread::sleep(std::time::Duration::from_millis(100));
    }

    let module_info = ModuleInfo::new(base_path, "queue2ids", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", module_info.err());
        return Err(-1);
    }

    let queue_out = Queue::new(&format!("{base_path}/ids"), "ids", Mode::ReadWrite).expect("!!!!!!!!! FAIL CREATE QUEUE [IDS]");

    let mut ctx = Context {
        queue_out,
    };

    let mut queue_consumer = Consumer::new("./data/queue", "queue2ids", "individuals-flow").expect("!!!!!!!!! FAIL OPEN QUEUE [INDIVIDUALS]");

    module.listen_queue(
        &mut queue_consumer,
        &mut ctx,
        &mut (before_batch as fn(&mut Backend, &mut Context, batch_size: u32) -> Option<u32>),
        &mut (prepare as fn(&mut Backend, &mut Context, &mut Individual, my_consumer: &Consumer) -> Result<bool, PrepareError>),
        &mut (after_batch as fn(&mut Backend, &mut Context, prepared_batch_size: u32) -> Result<bool, PrepareError>),
        &mut (heartbeat as fn(&mut Backend, &mut Context) -> Result<(), PrepareError>),
        &mut backend,
    );
    Ok(())
}

fn heartbeat(_module: &mut Backend, _ctx: &mut Context) -> Result<(), PrepareError> {
    Ok(())
}

fn before_batch(_module: &mut Backend, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Backend, _ctx: &mut Context, _prepared_batch_size: u32) -> Result<bool, PrepareError> {
    Ok(false)
}

fn prepare(_module: &mut Backend, ctx: &mut Context, queue_element: &mut Individual, _my_consumer: &Consumer) -> Result<bool, PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("skip queue message: cmd is none");
        return Ok(true);
    }
    let cmd = cmd.unwrap();

    if cmd == IndvOp::Put && !queue_element.is_exists("prev_state") {
        if let Some(id) = queue_element.get_first_literal("uri") {
            if let Err(e) = ctx.queue_out.push(id.as_bytes(), MsgType::String) {
                error!("fail push {} to queue, error={:?}", id, e);
                return Err(PrepareError::Fatal);
            }
        }
    }

    Ok(true)
}
