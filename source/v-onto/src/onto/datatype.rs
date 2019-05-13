#[derive(Debug)]
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

#[derive(Debug)]
#[repr(u8)]
pub enum Lang {
    NONE = 0,
    /// Русский
    RU = 1,
    /// Английский
    EN = 2,
}
