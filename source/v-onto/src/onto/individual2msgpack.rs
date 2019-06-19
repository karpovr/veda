extern crate rmp as msgpack;

use msgpack::encode::*;

use crate::datatype::*;
use crate::individual::*;
use crate::resource::*;

fn write_resource(out: &mut Vec<u8>, r: &Resource) -> Result<(), Error> {
    match r.rtype {
        DataType::Integer => {
            write_array_len(out, 2)?;
            write_u8(out, r.rtype.clone() as u8)?;
            write_sint(out, r.get_int())?;
        }
        DataType::Binary => {
            write_array_len(out, 2)?;
            write_u8(out, r.rtype.clone() as u8)?;
            write_bin(out, r.get_binary())?;
        }
        DataType::Boolean => {
            write_array_len(out, 2)?;
            write_u8(out, r.rtype.clone() as u8)?;
            write_bool(out, r.get_bool())?;
        }
        DataType::Datetime => {
            write_array_len(out, 2)?;
            write_u8(out, r.rtype.clone() as u8)?;
            write_sint(out, r.get_int())?;
        }
        DataType::Decimal => {
            write_array_len(out, 3)?;
            write_u8(out, r.rtype.clone() as u8)?;
            let dec = r.get_num();
            write_sint(out, dec.0)?;
            write_sint(out, dec.1)?;
        }
        DataType::String => {
            let s = r.get_str();
            let l = r.get_lang();

            if l == Lang::NONE {
                write_array_len(out, 2)?;
            } else {
                write_array_len(out, 2)?;
            }
            write_u8(out, r.rtype.clone() as u8)?;
            write_str(out, s)?;

            if l != Lang::NONE {
                write_u8(out, l as u8)?;
            }
        }
        DataType::Uri => {
            write_array_len(out, 2)?;
            write_u8(out, r.rtype.clone() as u8)?;
            write_str(out, r.get_str())?;
        }
    }

    Ok(())
}

pub fn to_msgpack(indv: &Individual, out: &mut Vec<u8>) -> Result<(), Error> {
    write_map_len(out, indv.resources.len() as u32 + 1)?;
    write_str(out, "@")?;
    write_str(out, &indv.uri)?;
    for (predicate, resources) in &indv.resources {
        write_str(out, &predicate)?;
        write_array_len(out, resources.len() as u32)?;

        for r in resources {
            write_resource(out, r)?;
        }
    }

    Ok(())
}
