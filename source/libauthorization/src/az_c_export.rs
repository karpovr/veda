use std::ffi::CStr;
use std::ffi::CString;
use std::os::raw::c_char;
use std::ptr;
//use v_az_lmdb::_authorize;
use v_authorization::common::Trace;
use v_common::az_lmdb::az_lmdb::f_authorize;

const TRACE_ACL: u8 = 0;
const TRACE_GROUP: u8 = 1;
const TRACE_INFO: u8 = 2;

#[no_mangle]
pub unsafe extern "C" fn get_trace(_uri: *const c_char, _user_uri: *const c_char, _request_access: u8, trace_mode: u8, _is_check_for_reload: bool) -> *const c_char {
    let c_uri: &CStr = CStr::from_ptr(_uri);
    let uri;
    match c_uri.to_str() {
        Ok(value) => uri = value,
        Err(e) => {
            eprintln!("ERR! invalid param uri {:?}", e);
            return ptr::null();
        }
    }

    let c_user_uri: &CStr = CStr::from_ptr(_user_uri);
    let user_uri;
    match c_user_uri.to_str() {
        Ok(value) => user_uri = value,
        Err(e) => {
            eprintln!("ERR! invalid param user_uri {:?}", e);
            return ptr::null();
        }
    }

    let _trace_acl = &mut String::new();
    let is_acl = trace_mode == TRACE_ACL;

    let _trace_group = &mut String::new();
    let is_group = trace_mode == TRACE_GROUP;

    let _trace_info = &mut String::new();
    let is_info = trace_mode == TRACE_INFO;

    let mut trace = Trace {
        acl: _trace_acl,
        is_acl,
        group: _trace_group,
        is_group,
        info: _trace_info,
        is_info,
        str_num: 0,
    };

    if f_authorize(&uri, &user_uri, _request_access, _is_check_for_reload, Some(&mut trace)).is_ok() {};

    let mut trace_res = &mut String::new();

    if trace_mode == TRACE_ACL {
        trace_res = trace.acl;
    } else if trace_mode == TRACE_GROUP {
        trace_res = trace.group;
    } else if trace_mode == TRACE_INFO {
        trace_res = trace.info;
    }

    //	eprintln! ("trace_res={}", trace_res);

    //	let bytes = trace_res.into_bytes();
    let cres = CString::new(trace_res.clone()).unwrap();

    // http://jakegoulding.com/rust-ffi-omnibus/string_return/
    //cres.into_raw()

    let p = cres.as_ptr();

    std::mem::forget(cres);

    p
}

#[no_mangle]
pub unsafe extern "C" fn authorize_r(_uri: *const c_char, _user_uri: *const c_char, request_access: u8, is_check_for_reload: bool) -> u8 {
    let c_uri: &CStr = CStr::from_ptr(_uri);
    let uri;
    match c_uri.to_str() {
        Ok(value) => uri = value,
        Err(e) => {
            eprintln!("ERR! invalid param uri {:?}", e);
            return 0;
        }
    }

    let c_user_uri: &CStr = CStr::from_ptr(_user_uri);
    let user_uri;
    match c_user_uri.to_str() {
        Ok(value) => user_uri = value,
        Err(e) => {
            eprintln!("ERR! invalid param user_uri {:?}", e);
            return 0;
        }
    }

    let mut trace = Trace {
        acl: &mut String::new(),
        is_acl: false,
        group: &mut String::new(),
        is_group: false,
        info: &mut String::new(),
        is_info: false,
        str_num: 0,
    };

    for attempt in 1..10 {
        if attempt > 1 {
            eprintln!("ERR! AZ: attempt {:?}", attempt)
        }

        match f_authorize(uri, user_uri, request_access, is_check_for_reload, Some(&mut trace)) {
            Ok(res) => return res,
            Err(_e) => {}
        }
    }
    0
}
