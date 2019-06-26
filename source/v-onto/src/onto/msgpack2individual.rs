extern crate rmp as msgpack;

use msgpack::decode::*;
use msgpack::Marker;
use std::io::Cursor;

use crate::datatype::*;
use crate::individual::*;
use crate::parser::*;
use crate::resource::*;

pub fn parse_msgpack(raw: &mut RawObj) -> Result<String, i8> {
    if raw.data.is_empty() || raw.raw_type != RawType::MSGPACK {
        return Err(-1);
    }

    let mut cur = Cursor::new(raw.data.as_slice());

    if let Ok(v) = read_marker(&mut cur) {
        if let Marker::FixArray(size) = v {
            if size != 2 {
                return Err(-1);
            }
        } else {
            return Err(-1);
        }
    } else {
        return Err(-1);
    }

    // read individual URI
    let uri = match read_string_from_msgpack(&mut cur) {
        Ok(p) => p,
        Err(_) => return Err(-1),
    };

    if let Ok(size) = read_map_len(&mut cur) {
        raw.len_predicates = size as u32;
        raw.cur = cur.position();
        return Ok(uri);
    } else {
        return Err(-1);
    }
}

pub fn parse_msgpack_to_predicate(expect_predicate: &str, raw: &mut RawObj, indv: &mut Individual) -> bool {
    if raw.cur >= raw.data.len() as u64 {
        return false;
    }

    let mut is_found = false;
    let mut cur = Cursor::new(raw.data.as_slice());
    cur.set_position(raw.cur);

    for _ in raw.cur_predicates..raw.len_predicates {
        let predicate = match read_string_from_msgpack(&mut cur) {
            Ok(p) => p,
            Err(e) => {
                error!("read_string_from_msgpack, err={}", e);
                return false;
            }
        };

        if predicate == expect_predicate {
            is_found = true;
        }

        match read_array_len(&mut cur) {
            Ok(size) => {
                for i_values in 0..size {
                    match read_marker(&mut cur) {
                        Ok(v) => match v {
                            Marker::FixArray(size) => {
                                if size != 2 && size != 3 {
                                    error!("parsing values, unexpected array size, len={:?}", size);
                                    return false;
                                }

                                let v_type: u8;
                                if let Ok(t) = read_int(&mut cur) {
                                    v_type = t;
                                } else {
                                    error!("parsing type");
                                    return false;
                                }

                                if size == 2 {
                                    if v_type == DataType::Boolean as u8 {
                                        match read_bool(&mut cur) {
                                            Ok(res) => indv.add_bool(&predicate, res, i_values),
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Datetime as u8 {
                                        match read_int(&mut cur) {
                                            Ok(res) => indv.add_datetime(&predicate, res, i_values),
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Integer as u8 {
                                        match read_int(&mut cur) {
                                            Ok(res) => indv.add_integer(&predicate, res, i_values),
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Uri as u8 {
                                        match read_string_from_msgpack(&mut cur) {
                                            Ok(res) => indv.add_uri(&predicate, &res, i_values),
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Binary as u8 {
                                        let values = indv.resources.entry(predicate.to_owned()).or_default();
                                        if !read_raw_into_resources(&mut cur, values) {
                                            error!("value: fail read raw");
                                            return false;
                                        }
                                    } else if v_type == DataType::String as u8 {
                                        match read_string_from_msgpack(&mut cur) {
                                            Ok(res) => indv.add_string(&predicate, &res, Lang::NONE, i_values),
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        };
                                    } else {
                                        error!("unknown type {}", v_type);
                                        return false;
                                    }
                                } else if size == 3 {
                                    if v_type == DataType::Decimal as u8 {
                                        match read_int(&mut cur) {
                                            Ok(mantissa) => match read_int(&mut cur) {
                                                Ok(exponent) => indv.add_decimal_d(&predicate, mantissa, exponent, i_values),
                                                Err(e) => {
                                                    error!("value: fail read exponent, err={:?}", e);
                                                    return false;
                                                }
                                            },
                                            Err(e) => {
                                                error!("value: fail read mantissa, err={:?}", e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::String as u8 {
                                        let mut lang = Lang::NONE;

                                        match read_string_from_msgpack(&mut cur) {
                                            Ok(res) => {
                                                match read_int(&mut cur) {
                                                    Ok(res) => {
                                                        let r_lang: i64 = res;

                                                        if r_lang == 1 {
                                                            lang = Lang::RU;
                                                        } else if r_lang == 2 {
                                                            lang = Lang::EN;
                                                        }
                                                    }
                                                    Err(e) => {
                                                        error!("value: fail read mantissa, err={:?}", e);
                                                        return false;
                                                    }
                                                }

                                                indv.add_string(&predicate, &res, lang, i_values);
                                            }
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    }
                                }
                            }
                            marker => {
                                error!("parsing values: unexpected marker={:?}", marker);
                                return false;
                            }
                        },
                        Err(e) => {
                            error!("parsing values: err={:?}", e);
                            return false;
                        }
                    }
                }
            }
            Err(e) => {
                error!("parsing {:?}", e);
                return false;
            }
        }

        if is_found {
            //            indv.cur = cur.position();
            raw.cur = cur.position();
            return true;
        }
    }

    raw.cur = cur.position();
    true
}

fn read_raw_into_resources(cur: &mut Cursor<&[u8]>, values: &mut Vec<Resource>) -> bool {
    let m_pos = cur.position();
    let size: u32;

    if let Ok(v) = read_marker(cur) {
        match v {
            Marker::FixStr(s) => {
                size = u32::from(s);
                cur.set_position(m_pos);
            }
            Marker::Str8 | Marker::Str16 | Marker::Str32 => {
                cur.set_position(m_pos);

                match read_str_len(cur) {
                    Ok(s) => size = s,
                    Err(e) => {
                        error!("fail read str len , err={:?}", e);
                        return false;
                    }
                }
                cur.set_position(m_pos);
            }
            _marker => return false,
        }
    } else {
        return false;
    }

    let mut out = vec![0u8; size as usize];

    match read_str(cur, &mut out) {
        Ok(v) => {
            values.push(Resource {
                rtype: DataType::Binary,
                order: 0,
                value: Value::Binary(v.as_bytes().to_vec()),
            });
            true
        }
        Err(e) => {
            if let DecodeStringError::InvalidUtf8(buf, _err) = e {
                values.push(Resource {
                    rtype: DataType::Binary,
                    order: 0,
                    value: Value::Binary(buf.to_vec()),
                });
                return true;
            }
            false
        }
    }
}

fn read_string_from_msgpack(cur: &mut Cursor<&[u8]>) -> Result<String, i64> {
    let m_pos = cur.position();
    let size: u32;

    if let Ok(v) = read_marker(cur) {
        match v {
            Marker::FixStr(s) => {
                size = u32::from(s);
                cur.set_position(m_pos);
            }
            Marker::Str8 | Marker::Str16 | Marker::Str32 => {
                cur.set_position(m_pos);
                match read_str_len(cur) {
                    Ok(s) => size = s,
                    Err(e) => {
                        error!("fail read str len , err={:?}", e);
                        return Err(-1);
                    }
                }
                cur.set_position(m_pos);
            }
            Marker::Null => {
                //cur.set_position(m_pos);
                return Ok("".to_string());
            }
            marker => {
                error!("marker={:?}", marker);
                return Err(-1);
            }
        }
    } else {
        return Err(-1);
    }

    let mut out = vec![0u8; size as usize];
    match read_str(cur, &mut out) {
        Ok(v) => Ok(v.to_string()),
        Err(e) => {
            if let DecodeStringError::InvalidUtf8(buf, _err) = e {
                let res = String::from_utf8_lossy(buf);
                return Ok(res.to_string());
            }
            error!("fail read str, err={:?}", e);
            Err(-1)
        }
    }
}
