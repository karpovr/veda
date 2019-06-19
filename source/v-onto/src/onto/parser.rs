use crate::cbor2individual::*;
use crate::individual::*;
use crate::msgpack2individual::*;

#[derive(PartialEq, Debug)]
pub enum RawType {
    CBOR,
    JSON,
    MSGPACK,
    UNKNOWN,
}

pub fn parse_to_predicate(expect_predicate: &str, raw: &mut RawObj, indv: &mut Individual) -> bool {
    if raw.raw_type == RawType::MSGPACK {
        return parse_msgpack_to_predicate(expect_predicate, raw, indv);
    } else if raw.raw_type == RawType::CBOR {
        return parse_cbor_to_predicate(expect_predicate, raw, indv);
    }

    return false;
}

const MSGPACK_MAGIC_HEADER: u8 = 146;

pub fn parse_raw(raw: &mut RawObj) -> Result<String, i8> {
    if raw.data.is_empty() {
        return Err(-1);
    }

    let traw: &[u8] = raw.data.as_slice();

    if traw[0] == MSGPACK_MAGIC_HEADER {
        raw.raw_type = RawType::MSGPACK;
    } else {
        raw.raw_type = RawType::CBOR;
    }

    if raw.raw_type == RawType::MSGPACK {
        return parse_msgpack(raw);
    } else if raw.raw_type == RawType::CBOR {
        return parse_cbor(raw);
    }

    Err(-1)
}
