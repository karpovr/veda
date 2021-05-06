use ffi_convert::*;
use std::ffi::CStr;
use std::os::raw::c_char;
use std::ptr;
use v_queue::consumer::Consumer;
use v_queue::record::Mode;

pub struct ConsumerInfo {
    pub current_count: u32,
    pub total_count: u32,
    pub err: Option<String>,
}

#[repr(C)]
#[derive(CReprOf, AsRust, CDrop, RawPointerConverter)]
#[target_type(ConsumerInfo)]
pub struct CConsumerInfo {
    pub current_count: u32,
    pub total_count: u32,
    #[nullable]
    pub err: *const libc::c_char,
}

fn new_with_data(current: u32, total: u32) -> CConsumerInfo {
    let ci = ConsumerInfo {
        current_count: current,
        total_count: total,
        err: None,
    };
    if let Ok(p) = CConsumerInfo::c_repr_of(ci) {
        return p;
    }

    CConsumerInfo {
        current_count: 0,
        total_count: 0,
        err: ptr::null(),
    }
}

fn new_with_err(err_text: String) -> CConsumerInfo {
    let ci = ConsumerInfo {
        current_count: 0,
        total_count: 0,
        err: Some(err_text),
    };
    if let Ok(p) = CConsumerInfo::c_repr_of(ci) {
        return p;
    }

    CConsumerInfo {
        current_count: 0,
        total_count: 0,
        err: ptr::null(),
    }
}

#[no_mangle]
pub unsafe extern "C" fn get_info_of_consumer(_base_path: *const c_char, _consumer_name: *const c_char, _queue_name: *const c_char) -> CConsumerInfo {
    let c_base_path: &CStr = CStr::from_ptr(_base_path);
    let base_path;
    match c_base_path.to_str() {
        Ok(value) => base_path = value,
        Err(e) => {
            return new_with_err(format!("ERR! invalid param base_path {:?}", e));
        }
    }

    let c_queue_name: &CStr = CStr::from_ptr(_queue_name);
    let queue_name;
    match c_queue_name.to_str() {
        Ok(value) => queue_name = value,
        Err(e) => {
            return new_with_err(format!("ERR! invalid param queue_name {:?}", e));
        }
    }

    let c_consumer_name: &CStr = CStr::from_ptr(_consumer_name);
    let consumer_name;
    match c_consumer_name.to_str() {
        Ok(value) => consumer_name = value,
        Err(e) => {
            return new_with_err(format!("ERR! invalid param consumer_name {:?}", e));
        }
    }

    match Consumer::new_with_mode(base_path, consumer_name, queue_name, Mode::Read) {
        Ok(mut queue_consumer) => {
            queue_consumer.open(false);
            queue_consumer.get_info();
            if queue_consumer.queue.get_info_of_part(queue_consumer.id, false).is_ok() {
                println!("@4.4 queue_consumer.count_popped={}, queue_consumer.queue.count_pushed={}", queue_consumer.count_popped, queue_consumer.queue.count_pushed);
                return new_with_data(queue_consumer.count_popped, queue_consumer.queue.count_pushed);
            }
        }
        Err(e) => {
            println!("@ Err={:?}", e);
        }
    }

    return new_with_err("unknown".to_owned());
}
