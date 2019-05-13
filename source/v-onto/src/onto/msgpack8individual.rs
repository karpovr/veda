use msgpack::decode::*;
use msgpack::Marker;
use std::io::Cursor;

extern crate rmp as msgpack;

use crate::datatype::{DataType, Lang};
use crate::individual::Individual;
use crate::resource::{Resource, Value};

const MSGPACK_MAGIC_HEADER: u8 = 146;

pub fn parse_to_predicate(expect_predicate: &str, indv: &mut Individual) -> bool {
    if indv.cur >= indv.binobj.len() as u64 {
        return false;
    }

    let mut is_found = false;
    let mut cur = Cursor::new(indv.binobj.as_slice());
    cur.set_position(indv.cur);

    for _ in indv.cur_predicates..indv.len_predicates {
        let mut predicate;

        match read_string_from_msgpack(&mut cur) {
            Ok(p) => predicate = p,
            Err(_) => {
                error!("@1");
                return false;
            }
        }

        //println!("@D predicate = {}", predicate);

        if predicate == expect_predicate {
            is_found = true;
        }

        let values = indv.resources.entry(predicate).or_default();

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
                                            Ok(res) => {
                                                values.push(Resource {
                                                    rtype: DataType::Boolean,
                                                    order: i_values as u16,
                                                    value: Value::Bool(res),
                                                });
                                            }
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Datetime as u8 {
                                        match read_int(&mut cur) {
                                            Ok(res) => {
                                                values.push(Resource {
                                                    rtype: DataType::Datetime,
                                                    order: i_values as u16,
                                                    value: Value::Int(res),
                                                });
                                            }
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Integer as u8 {
                                        match read_int(&mut cur) {
                                            Ok(res) => {
                                                values.push(Resource {
                                                    rtype: DataType::Integer,
                                                    order: i_values as u16,
                                                    value: Value::Int(res),
                                                });
                                            }
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Uri as u8 {
                                        match read_string_from_msgpack(&mut cur) {
                                            Ok(p) => {
                                                values.push(Resource {
                                                    rtype: DataType::Uri,
                                                    order: i_values as u16,
                                                    value: Value::Str(p, Lang::NONE),
                                                });
                                            }
                                            Err(e) => {
                                                error!("value: expected {}, err={:?}", v_type, e);
                                                return false;
                                            }
                                        }
                                    } else if v_type == DataType::Binary as u8 {
                                        if read_binobj_into_resources(&mut cur, values) == false {
                                            error!("value: faile read binobj");
                                            return false;
                                        }
                                    } else if v_type == DataType::String as u8 {
                                        match read_string_from_msgpack(&mut cur) {
                                            Ok(p) => {
                                                values.push(Resource {
                                                    rtype: DataType::String,
                                                    order: i_values as u16,
                                                    value: Value::Str(p, Lang::NONE),
                                                });
                                            }
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
                                                Ok(exponent) => {
                                                    values.push(Resource {
                                                        rtype: DataType::Decimal,
                                                        order: i_values as u16,
                                                        value: Value::Num(mantissa, exponent),
                                                    });
                                                }
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
                                            Ok(p) => {
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

                                                values.push(Resource {
                                                    rtype: DataType::String,
                                                    order: i_values as u16,
                                                    value: Value::Str(p, lang),
                                                });
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

        //if indv.cur >= indv.binobj.len() as u64 {
        //    return true;
        //}

        //println!("@D values {:?}", values);

        if is_found == true {
            //            indv.cur = cur.position();
            indv.cur = cur.position();
            return true;
        } // else {
          //println!("@D predicate not found");
          //}
    }

    indv.cur = cur.position();
    return true;
}

pub fn msgpack2individual(indv: &mut Individual) -> bool {
    if indv.binobj.len() == 0 {
        return false;
    }

    let binobj: &[u8] = indv.binobj.as_slice();
    let msg_type = binobj[0];

    if msg_type != MSGPACK_MAGIC_HEADER {
        return false;
    }

    let mut cur = Cursor::new(binobj);

    if let Ok(v) = read_marker(&mut cur) {
        if let Marker::FixArray(size) = v {
            if size != 2 {
                return false;
            }
        } else {
            return false;
        }
    } else {
        return false;
    }

    // read individual URI
    match read_string_from_msgpack(&mut cur) {
        Ok(p) => indv.uri = p,
        Err(_) => return false,
    }

    if let Ok(size) = read_map_len(&mut cur) {
        indv.len_predicates = size as u32;
        indv.cur = cur.position();
        return true;
    } else {
        return false;
    }
}

fn read_binobj_into_resources<'a>(cur: &mut Cursor<&[u8]>, values: &mut Vec<Resource>) -> bool {
    let m_pos = cur.position();
    let size: u32;

    if let Ok(v) = read_marker(cur) {
        match v {
            Marker::FixStr(s) => {
                size = s as u32;
                cur.set_position(m_pos);
            }
            Marker::Str16 | Marker::Str32 => {
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
            return true;
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
            return false;
        }
    }
}

fn read_string_from_msgpack<'a>(cur: &mut Cursor<&[u8]>) -> Result<String, i64> {
    let m_pos = cur.position();
    let size: u32;

    if let Ok(v) = read_marker(cur) {
        match v {
            Marker::FixStr(s) => {
                size = s as u32;
                cur.set_position(m_pos);
            }
            Marker::Str16 | Marker::Str32 => {
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
        Ok(v) => return Ok(v.to_string()),
        Err(e) => {
            if let DecodeStringError::InvalidUtf8(buf, _err) = e {
                let res = String::from_utf8_lossy(buf);
                return Ok(res.to_string());
            }
            error!("fail read str, err={:?}", e);
            return Err(-1);
        }
    }
}
