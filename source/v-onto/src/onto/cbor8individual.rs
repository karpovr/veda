use crate::datatype::*;
use crate::individual::{Individual, RawObj};
use crate::parser::*;
use cbor::types::Type;
use cbor::{Config, Decoder};
use std::io::Cursor;

#[derive(PartialEq, Debug)]
pub enum TagId {
    NONE = 255,
    TEXT_RU = 42,
    TEXT_EN = 43,
    STANDARD_DATE_TIME = 0,
    EPOCH_DATE_TIME = 1,
    POSITIVE_BIGINT = 2,
    NEGATIVE_BIGINT = 3,
    DECIMAL_FRACTION = 4,
    BIGDECIMAL = 5,
    EXPECTED_BASE64_URL_ENCODED = 21,
    EXPECTED_BASE64_ENCODED = 22,
    EXPECTED_BASE16_ENCODED = 23,
    CBOR_ENCODED = 24,
    URI = 32,
    BASE64_URL_ENCODED = 33,
    BASE64_ENCODED = 34,
    REGEXP = 35,
    MIME_MESSAGE = 36,
}

pub fn parse_cbor(raw: &mut RawObj) -> Result<String, i8> {
    if raw.data.len() == 0 || raw.raw_type != RawType::CBOR {
        return Err(-1);
    }

    let input = Cursor::new(raw.data.to_owned());
    let mut d = Decoder::new(Config::default(), input);

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

    return Err(-1);
}

pub fn parse_cbor_to_predicate(expect_predicate: &str, raw: &mut RawObj, indv: &mut Individual) -> bool {
    if raw.cur >= raw.data.len() as u64 {
        return false;
    }

    let mut is_found = false;
    let mut cur = Cursor::new(raw.data.as_slice());
    cur.set_position(raw.cur);
    let mut d = Decoder::new(Config::default(), cur);

    for _ in raw.cur_predicates..raw.len_predicates {
        if let Ok(type_info) = d.typeinfo() {
            if let Ok(predicate) = d._text(&type_info) {
                info!("predicate {:?}", &predicate);

                if predicate == expect_predicate {
                    is_found = true;
                }
                read_values(&predicate, &mut d, indv);
            }
        }
    }
    return false;
}

fn read_values(predicate: &str, d: &mut Decoder<Cursor<&[u8]>>, indv: &mut Individual) {
    if let Ok((type_info, tag)) = d.typeinfo_and_tag() {
        match type_info.0 {
            Type::Text => {
                if let Ok(t) = d._text(&type_info) {
                    if tag == TagId::URI as u64 {
                        indv.add_uri(&predicate, &t, 0);
                    } else {
                        if tag == TagId::TEXT_RU as u64 || tag == TagId::TEXT_EN as u64 {
                            let lang;

                            if tag == TagId::TEXT_RU as u64 {
                                lang = Lang::RU;
                            } else if tag == TagId::TEXT_EN as u64 {
                                lang = Lang::EN;
                            } else {
                                lang = Lang::NONE;
                            }

                            indv.add_string(predicate, &t, lang, 0);
                        }
                    }
                    info!("@V {:?}", t);
                }
            }
            Type::UInt8 => {
                if let Ok(i) = d._u8(&type_info) {
                    info!("@V {:?}", d._u8(&type_info));
                    //indv.add_integer(&predicate, i as i64, 0);
                }
            }
            Type::UInt16 => info!("@V {:?}", d._u16(&type_info)),
            Type::UInt32 => info!("@V {:?}", d._u32(&type_info)),
            Type::Array => {
                let len = d._array(&type_info);
                info!("@V ARRAY {:?}", len);
            }
            Type::Tagged => {
                info!("@V TAG");
            }
            _ => error!("unknown type {:?}", type_info.0),
        }
    }
}
