use std::mem::size_of;

pub const HEADER_SIZE: usize = 25;

#[derive(PartialEq, Debug)]
pub enum ErrorQueue {
    NotReady = -911,
    AlreadyOpen = -8,
    FailWrite = -7,
    InvalidChecksum = -6,
    FailReadTailMessage = -5,
    FailOpen = -4,
    FailRead = -3,
    NotFound = -2,
    Other = -1,
}

#[derive(PartialEq, Copy, Clone)]
pub enum Mode {
    Read = 0,
    ReadWrite = 1,
    Default = 2,
}

#[derive(PartialEq, Debug)]
#[repr(u8)]
pub enum MsgType {
    String = b'S',
    Object = b'O',
}

impl From<u8> for MsgType {
    fn from(t: u8) -> Self {
        if t == b'O' {
            return MsgType::Object;
        } else {
            return MsgType::String;
        }
    }
}

impl MsgType {
    fn as_u8(&self) -> u8 {
        if *self == MsgType::Object {
            return b'O';
        } else {
            return b'S';
        }
    }
}

impl ErrorQueue {
    pub fn as_str(&self) -> &'static str {
        match *self {
            ErrorQueue::NotFound => "not found",
            ErrorQueue::Other => "other error",
            ErrorQueue::AlreadyOpen => "already open",
            ErrorQueue::FailOpen => "fail open",
            ErrorQueue::FailRead => "fail read",
            ErrorQueue::FailWrite => "fail write",
            ErrorQueue::NotReady => "not ready",
            ErrorQueue::FailReadTailMessage => "fail read tail message",
            ErrorQueue::InvalidChecksum => "invalid checksum",
        }
    }
}

#[derive(Debug)]
pub struct Header {
    pub start_pos: u64,
    pub msg_length: u32,
    pub magic_marker: u32,
    pub count_pushed: u32,
    pub crc: u32,
    pub msg_type: MsgType,
}

impl Header {
    pub fn create_from_buf(buf: &Vec<u8>) -> Self {
        Header {
            start_pos: u64::from_ne_bytes([buf[0], buf[1], buf[2], buf[3], buf[4], buf[5], buf[6], buf[7]]),
            msg_length: u32::from_ne_bytes([buf[8], buf[9], buf[10], buf[11]]),
            magic_marker: u32::from_ne_bytes([buf[12], buf[13], buf[14], buf[15]]),
            count_pushed: u32::from_ne_bytes([buf[16], buf[17], buf[18], buf[19]]),
            msg_type: MsgType::from(buf[20]),
            crc: u32::from_ne_bytes([buf[21], buf[22], buf[23], buf[24]]),
        }
    }

    pub fn to_buf(&self, buf: &mut [u8; HEADER_SIZE]) {
        let mut l = 0;
        let mut r = size_of::<u64>();
        buf[l..r].clone_from_slice(&u64::to_ne_bytes(self.start_pos));
        l = r;
        r = r + size_of::<u32>();
        buf[l..r].clone_from_slice(&u32::to_ne_bytes(self.msg_length));
        l = r;
        r = r + size_of::<u32>();
        buf[l..r].clone_from_slice(&[0xEE, 0xFE, 0xEF, 0xEE]);
        l = r;
        r = r + size_of::<u32>();
        buf[l..r].clone_from_slice(&u32::to_ne_bytes(self.count_pushed));
        buf[r] = self.msg_type.as_u8();
        buf[r + 1] = 0;
        buf[r + 2] = 0;
        buf[r + 3] = 0;
        buf[r + 4] = 0;
    }
}
