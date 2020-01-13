use crate::datatype::*;
use crate::individual::*;
use crate::parser::*;
use cbor::types::Type;
use cbor::{Config, Decoder};
use std::io::Cursor;

#[derive(PartialEq, Debug)]
pub enum TagId {
    None = 255,
    TextRu = 42,
    TextEn = 43,
    StandardDateTime = 0,
    EpochDateTime = 1,
    PositiveBigint = 2,
    NegativeBigint = 3,
    DecimalFraction = 4,
    CborEncoded = 24,
    URI = 32,
}

pub fn parse_cbor(raw: &mut RawObj) -> Result<String, i8> {
    if raw.data.is_empty() || raw.raw_type != RawType::CBOR {
        return Err(-1);
    }

    let input = Cursor::new(raw.data.to_owned());

    let mut config = Config::default();
    if raw.data.len() > 200000 {
        config.max_len_array = 10000;
    }

    let mut d = Decoder::new(config, input);

    if let Ok(len) = d.object() {
        raw.len_predicates = len as u32;
        if let Ok(type_info) = d.typeinfo() {
            if let Ok(predicate) = d._text(&type_info) {
                if predicate == "@" {
                    if let Ok(type_info) = d.typeinfo() {
                        if let Ok(uri) = d._text(&type_info) {
                            raw.cur = d.into_reader().position();
                            return Ok(uri);
                        }
                    }
                } else {
                    return Err(-1);
                }
            }
        }
    }

    Err(-1)
}

pub fn parse_cbor_to_predicate(expect_predicate: &str, iraw: &mut Individual) -> bool {
    if iraw.raw.cur >= iraw.raw.data.len() as u64 {
        return false;
    }

    let mut is_found = false;
    let mut cur = Cursor::new(iraw.raw.data.as_slice());
    cur.set_position(iraw.raw.cur);

    let mut config = Config::default();
    let len = iraw.raw.data.len();
    if len > 200000 {
        config.max_len_array = 10000;
    }
    let mut d = Decoder::new(config, cur);

    for _ in iraw.raw.cur_predicates..iraw.raw.len_predicates {
        if let Ok(type_info) = d.typeinfo() {
            if let Ok(predicate) = d._text(&type_info) {
                debug!("predicate {:?}", &predicate);

                if predicate == expect_predicate {
                    is_found = true;
                }
                if !add_value(&predicate, &mut d, &mut iraw.obj) {
                    return false;
                }
            }
        }

        if is_found {
            iraw.raw.cur = d.into_reader().position();
            return true;
        }
    }

    false
}

fn add_value(predicate: &str, d: &mut Decoder<Cursor<&[u8]>>, indv: &mut IndividualObj) -> bool {
    if let Ok((type_info, tag)) = d.typeinfo_and_tag() {
        match type_info.0 {
            Type::Bool => {
                if let Ok(b) = d._bool(&type_info) {
                    indv.add_bool(&predicate, b);
                }
            }
            Type::Bytes => {
                if let Ok(t) = d._text(&type_info) {
                    if tag == TagId::URI as u64 {
                        indv.add_uri(&predicate, &t);
                    } else {
                        let mut lang = Lang::NONE;

                        if tag == TagId::TextRu as u64 || tag == TagId::TextEn as u64 {
                            if tag == TagId::TextRu as u64 {
                                lang = Lang::RU;
                            } else if tag == TagId::TextEn as u64 {
                                lang = Lang::EN;
                            }
                        }

                        indv.add_string(predicate, &t, lang);
                    }
                }
            }
            Type::Text => {
                if let Ok(t) = d._text(&type_info) {
                    if tag == TagId::URI as u64 {
                        indv.add_uri(&predicate, &t);
                    } else {
                        let mut lang = Lang::NONE;

                        if tag == TagId::TextRu as u64 || tag == TagId::TextEn as u64 {
                            if tag == TagId::TextRu as u64 {
                                lang = Lang::RU;
                            } else if tag == TagId::TextEn as u64 {
                                lang = Lang::EN;
                            }
                        }

                        indv.add_string(predicate, &t, lang);
                    }
                }
            }
            Type::UInt8 | Type::Int8 | Type::UInt16 | Type::Int16 | Type::UInt32 | Type::Int32 | Type::Int64 | Type::UInt64 => {
                if let Ok(mut i) = d._i64(&type_info) {
                    if i < 0 {
                        i += 1; // ?! this cbor decoder returned not correct negative number
                    }

                    if tag == TagId::EpochDateTime as u64 {
                        indv.add_datetime(&predicate, i);
                    } else {
                        indv.add_integer(&predicate, i);
                    }
                }
            }
            Type::Array => {
                if let Ok(len) = d._array(&type_info) {
                    if tag == TagId::DecimalFraction as u64 {
                        if let Ok((type_info, _tag)) = d.typeinfo_and_tag() {
                            if let Ok(mut m) = d._i64(&type_info) {
                                if m < 0 {
                                    m += 1; // ?! this cbor decoder returned not correct negative number
                                }
                                if let Ok((type_info, _tag)) = d.typeinfo_and_tag() {
                                    if let Ok(mut e) = d._i64(&type_info) {
                                        if e < 0 {
                                            e += 1; // ?! this cbor decoder returned not correct negative number
                                        }
                                        indv.add_decimal_d(&predicate, m as i64, e);
                                    }
                                }
                            }
                        }
                    } else {
                        for _x in 0..len {
                            add_value(predicate, d, indv);
                        }
                    }
                } else {
                    return false;
                }
            }
            _ => {
                error!("parse cbor:unknown type {:?}, predicate={}, id={}", type_info.0, predicate, indv.uri);
                return false;
            }
        }
    }
    true
}
