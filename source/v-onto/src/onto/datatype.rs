#[derive(PartialEq, Debug, Clone)]
#[repr(u8)]
pub enum DataType {
    Uri = 1,
    String = 2,
    Integer = 4,
    Datetime = 8,
    Decimal = 32,
    Boolean = 64,
    Binary = 128,
}

impl DataType {
    pub fn from_str(l: &str) -> Option<DataType> {
        match l {
            "Uri" => Some(DataType::Uri),
            "String" => Some(DataType::String),
            "Integer" => Some(DataType::Integer),
            "Datetime" => Some(DataType::Datetime),
            "Decimal" => Some(DataType::Decimal),
            "Boolean" => Some(DataType::Boolean),
            "Binary" => Some(DataType::Binary),
            _ => None,
        }
    }

    pub fn from_u64(l: u64) -> Option<DataType> {
        match l {
            1 => Some(DataType::Uri),
            2 => Some(DataType::String),
            4 => Some(DataType::Integer),
            8 => Some(DataType::Datetime),
            32 => Some(DataType::Decimal),
            64 => Some(DataType::Boolean),
            128 => Some(DataType::Binary),
            _ => None,
        }
    }
}

#[derive(PartialEq, Debug, Clone)]
#[repr(u8)]
pub enum Lang {
    NONE = 0,
    /// Русский
    RU = 1,
    /// Английский
    EN = 2,
}

impl Lang {
    pub fn from_str(l: &str) -> Lang {
        match l {
            "ru" => Lang::RU,
            "en" => Lang::EN,
            _ => Lang::NONE,
        }
    }

    pub fn to_string(&self) -> &str {
        match self {
            Lang::RU => "ru",
            Lang::EN => "en",
            Lang::NONE => "none",
        }
    }
}
