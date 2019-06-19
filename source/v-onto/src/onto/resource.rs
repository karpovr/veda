use crate::datatype::{DataType, Lang};

#[derive(Debug, Clone)]
pub enum Value {
    Int(i64),
    Str(String, Lang),
    Bool(bool),
    Num(i64, i64),
    Binary(Vec<u8>),
}

#[derive(Debug, Clone)]
pub struct Resource {
    pub rtype: DataType,
    pub order: u16,
    pub value: Value,
}

impl Resource {
    pub fn get_binary(&self) -> &[u8] {
        if let Value::Binary(v) = &self.value {
            v
        } else {
            &[]
        }
    }

    pub fn get_str(&self) -> &str {
        if let Value::Str(s, _) = &self.value {
            &s
        } else {
            ""
        }
    }

    pub fn get_lang(&self) -> Lang {
        if let Value::Str(_, l) = &self.value {
            l.clone()
        } else {
            Lang::NONE
        }
    }

    pub fn get_int(&self) -> i64 {
        if let Value::Int(t) = self.value {
            t
        } else {
            0
        }
    }

    pub fn get_bool(&self) -> bool {
        if let Value::Bool(t) = self.value {
            t
        } else {
            false
        }
    }

    pub fn get_num(&self) -> (i64, i64) {
        if let Value::Num(m, e) = self.value {
            (m, e)
        } else {
            (0, 0)
        }
    }
}

impl From<Value> for i64 {
    fn from(v: Value) -> Self {
        if let Value::Int(t) = v {
            t.clone()
        } else {
            0
        }
    }
}

impl From<Value> for bool {
    fn from(v: Value) -> Self {
        if let Value::Bool(t) = v {
            t.clone()
        } else {
            false
        }
    }
}
