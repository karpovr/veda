use crate::datatype::{DataType, Lang};

#[derive(Debug)]
pub enum Value {
    Int(i64),
    Str(String, Lang),
    Bool(bool),
    Num(i64, i64),
    Binary(Vec<u8>),
}

#[derive(Debug)]
pub struct Resource {
    pub rtype: DataType,
    pub order: u16,
    pub value: Value,
}
