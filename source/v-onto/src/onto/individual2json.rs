use crate::datatype::{DataType, Lang};
use crate::individual::*;
use crate::resource::{Resource, Value};
use serde::ser::{Serialize, SerializeMap, SerializeStruct, Serializer};

impl Individual {
    pub fn as_json_str(&mut self) -> String {
        if let Ok(b) = serde_json::to_value(&self) {
            return b.to_string();
        }

        "".to_owned()
    }
}

impl Serialize for Individual {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(self.resources.len()))?;
        map.serialize_entry("@", &self.uri)?;
        for (k, v) in &self.resources {
            map.serialize_entry(&k, &v)?;
        }
        map.end()
    }
}

impl Serialize for Resource {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        //serializer.serialize_some (&self.value)

        let mut tup = serializer.serialize_struct("E", 0)?;

        match &self.value {
            Value::Int(i) => {
                tup.serialize_field("data", &*i)?;
            }
            Value::Bool(b) => {
                tup.serialize_field("data", &*b)?;
            }
            Value::Str(s, l) => {
                tup.serialize_field("data", &*s)?;

                if self.rtype == DataType::String && *l != Lang::NONE {
                    tup.serialize_field("lang", &*l)?;
                }
            }
            _ => {}
        }
        tup.serialize_field("type", &self.rtype)?;

        tup.end()
    }
}

impl Serialize for Value {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match &self {
            Value::Int(i) => serializer.serialize_i64(*i),
            Value::Bool(b) => serializer.serialize_bool(*b),
            Value::Str(s, l) => {
                //serializer.serialize_newtype_variant("type", 0, "data", s)

                let mut tup = serializer.serialize_struct("E", 0)?;
                //tup.serialize_element(&*s)?;
                tup.serialize_field("data", &*s)?;

                if *l != Lang::NONE {
                    tup.serialize_field("lang", &*l)?;
                }
                tup.end()
            }
            _ => serializer.serialize_none(),
        }
    }
}

impl Serialize for Lang {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match &self {
            Lang::NONE => serializer.serialize_str("None"),
            Lang::RU => serializer.serialize_str("RU"),
            Lang::EN => serializer.serialize_str("EN"),
        }
    }
}

impl Serialize for DataType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match &self {
            DataType::Uri => serializer.serialize_str("Uri"),
            DataType::String => serializer.serialize_str("String"),
            DataType::Integer => serializer.serialize_str("Integer"),
            DataType::Datetime => serializer.serialize_str("Datetime"),
            DataType::Decimal => serializer.serialize_str("Decimal"),
            DataType::Boolean => serializer.serialize_str("Boolean"),
            DataType::Binary => serializer.serialize_str("Binary"),
        }
    }
}
