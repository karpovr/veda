use std::fs::*;
use std::io::prelude::*;
use std::io::SeekFrom;
use std::io::{BufRead, BufReader};

extern crate crc32fast;
use crc32fast::Hasher;

#[macro_use]
extern crate scan_fmt;

#[macro_use]
extern crate log;

pub const QUEUE_PATH: &str = "./data/queue";
pub const HEADER_SIZE: usize = 25;

#[derive(Debug)]
pub struct Header {
    start_pos: u64,
    pub msg_length: u32,
    magic_marker: u32,
    count_pushed: u32,
    crc: u32,
    msg_type: u8,
}

pub struct Consumer {
    is_ready: bool,
    name: String,
    queue: Queue,
    ff_info_pop_w: File,
    pub count_popped: u64,
    pos_record: u64,
    pub id: u32,

    // tmp
    pub header: Header,
    hash: Hasher,
}

impl Consumer {
    pub fn new(consumer_name: &str, queue_name: &str) -> Result<Consumer, i64> {
        match Queue::new(queue_name) {
            Ok(q) => match OpenOptions::new().read(true).write(true).create(true).open(QUEUE_PATH.to_owned() + "/" + queue_name + "_info_pop_" + consumer_name) {
                Ok(ff) => Ok({
                    let mut consumer = Consumer {
                        is_ready: true,
                        name: consumer_name.to_owned(),
                        ff_info_pop_w: ff,
                        queue: q,
                        count_popped: 0,
                        pos_record: 0,
                        hash: Hasher::new(),
                        header: Header {
                            start_pos: 0,
                            msg_length: 0,
                            magic_marker: 0,
                            count_pushed: 0,
                            crc: 0,
                            msg_type: 0,
                        },
                        id: 0,
                    };

                    if consumer.get_info() == true {
                        if consumer.queue.open_part(consumer.id) == true {
                            &consumer.queue.ff_queue_r.seek(SeekFrom::Start(consumer.pos_record));
                        } else {
                            return Err(-1);
                        }
                    } else {
                        return Err(-1);
                    }

                    consumer
                }),
                Err(_e) => Err(-1),
            },
            Err(_e) => Err(-1),
        }
    }

    pub fn open(&mut self, is_new: bool) -> bool {
        if self.queue.is_ready == false {
            error!("Consumer open: queue not ready, set consumer.ready = false");
            self.is_ready = false;
            return false;
        }

        let info_pop_file_name = QUEUE_PATH.to_owned() + "/" + &self.queue.name + "_info_pop_" + &self.name;

        if let Ok(ff) = OpenOptions::new().read(true).write(true).truncate(true).create(is_new).open(&info_pop_file_name) {
            self.ff_info_pop_w = ff;
        } else {
            error!("Consumer open: fail open file [{}], set consumer.ready = false", info_pop_file_name);
            self.is_ready = false;
            return false;
        }
        return true;
    }

    pub fn get_info(&mut self) -> bool {
        let mut res = true;

        &self.ff_info_pop_w.seek(SeekFrom::Start(0));
        for line in BufReader::new(&self.ff_info_pop_w).lines() {
            if let Ok(ll) = line {
                let (queue_name, consumer_name, position, count_popped, id) = scan_fmt!(&ll.to_owned(), "{};{};{};{};{}", String, String, u64, u64, u32);

                if let Some(q) = queue_name {
                    if q != self.queue.name {
                        res = false;
                    }
                } else {
                    res = false;
                }

                match consumer_name {
                    Some(q) => {
                        if q != self.name {
                            res = false;
                        }
                    }
                    None => res = false,
                }

                match position {
                    Some(pos) => {
                        // if pos > self.queue.right_edge {
                        //   res = false;
                        //  } else {
                        self.pos_record = pos;
                        //  }
                    }
                    None => res = false,
                }

                match count_popped {
                    Some(cc) => {
                        //  if cc > self.queue.count_pushed {
                        //      res = false;
                        //  } else {
                        self.count_popped = cc;
                        //  }
                    }
                    None => res = false,
                }

                match id {
                    Some(cc) => self.id = cc,
                    None => res = false,
                }
            } else {
                res = false;
                return res;
            }

            break;
        }

        info!("consumer ({}): count_pushed:{}, position:{}, id:{}, success:{}", self.name, self.count_popped, self.pos_record, self.id, res);
        return res;
    }

    pub fn pop_header(&mut self) -> bool {
        if self.count_popped >= self.queue.count_pushed {
            if self.queue.get_info_of_part(self.id) == false {
                error!("queue:consumer({}):pop, queue {} not ready", self.name, self.queue.name);
                return false;
            }
        }

        if self.count_popped >= self.queue.count_pushed {
            //info!("@end of part {}, queue.id={}", self.id, self.queue.id);

            if self.queue.id == self.id {
                self.queue.get_info_queue();
            }

            if self.queue.id > self.id {
                self.id = self.id + 1;

                debug!("next part {}", self.id);

                if self.queue.get_info_of_part(self.id) == false {
                    error!("queue:consumer({}):pop, queue {} not ready", self.name, self.queue.name);
                    return false;
                }

                self.count_popped = 0;
                self.pos_record = 0;

                self.open(true);
                self.put_info();

                self.queue.open_part(self.id);
            }
        }
        //self.queue.ff_queue_r.seek(SeekFrom::Start(self.pos_record));

        let mut buff = vec![0; HEADER_SIZE];
        match self.queue.ff_queue_r.read(&mut buff[..]) {
            Ok(len) => {
                //println!("@len={}, id={}", len, self.id);
                if len < HEADER_SIZE {
                    //self.is_ready = false;
                    //error!("fail read message header: len={}", len);
                    return false;
                }
            }
            Err(_) => {
                error!("fail read message header");
                //self.is_ready = false;
                return false;
            }
        }

        let header = Header {
            start_pos: u64::from_ne_bytes([buff[0], buff[1], buff[2], buff[3], buff[4], buff[5], buff[6], buff[7]]),
            msg_length: u32::from_ne_bytes([buff[8], buff[9], buff[10], buff[11]]),
            magic_marker: u32::from_ne_bytes([buff[12], buff[13], buff[14], buff[15]]),
            count_pushed: u32::from_ne_bytes([buff[16], buff[17], buff[18], buff[19]]),
            msg_type: buff[20],
            crc: u32::from_ne_bytes([buff[21], buff[22], buff[23], buff[24]]),
        };

        buff[21] = 0;
        buff[22] = 0;
        buff[23] = 0;
        buff[24] = 0;
        self.hash = Hasher::new();
        self.hash.update(&mut buff[..]);

        self.header = header;
        return true;
    }

    pub fn pop_body(&mut self, msg: &mut [u8]) -> bool {
        if self.is_ready == false {
            return false;
        }

        if let Ok(readed_size) = self.queue.ff_queue_r.read(msg) {
            if readed_size != msg.len() {
                let mut f_err = true;

                // attempt read again
                if self.count_popped == self.queue.count_pushed {
                    if let Ok(_) = self.queue.ff_queue_r.seek(SeekFrom::Start(self.pos_record)) {
                        if let Ok(readed_size) = self.queue.ff_queue_r.read(msg) {
                            if readed_size == msg.len() {
                                warn!(
                                    "success attempt read, [name:{}, id:{}, pos:{}, pop:{}, push:{}]",
                                    self.name, self.id, self.pos_record, self.count_popped, self.queue.count_pushed
                                );
                                f_err = false;
                            }
                        }
                    }
                }

                if f_err == true {
                    error!(
                        "invalid message body length: expected:{}, readed:{}, [name:{}, id:{}, pos:{}, pop:{}, push:{}]",
                        msg.len(),
                        readed_size,
                        self.name,
                        self.id,
                        self.pos_record,
                        self.count_popped,
                        self.queue.count_pushed
                    );
                    self.is_ready = false;
                    return false;
                }
            }
            debug!("msg={:?}", msg);
            self.pos_record = self.pos_record + HEADER_SIZE as u64 + readed_size as u64;
            self.hash.update(msg);

            let crc32: u32 = self.hash.clone().finalize();

            if crc32 != self.header.crc {
                error!("CRC fail, set consumer.ready = false");
                self.is_ready = false;
                return false;
            }
        } else {
            return false;
        }

        return true;
    }

    pub fn put_info(&mut self) {
        if let Ok(_) = self.ff_info_pop_w.seek(SeekFrom::Start(0)) {
        } else {
            error!("fail put info, set consumer.ready = false");
            self.is_ready = false;
        }
        if let Ok(_) = self.ff_info_pop_w.write(format!("{};{};{};{};{}\n", self.queue.name, self.name, self.pos_record, self.count_popped, self.id).as_bytes()) {
        } else {
            error!("fail put info, set consumer.ready = false");
            self.is_ready = false;
        }
    }

    pub fn commit_and_next(&mut self) -> bool {
        if self.is_ready == false {
            error!("commit");
            return false;
        }

        self.count_popped = self.count_popped + 1;
        if let Ok(_) = self.ff_info_pop_w.seek(SeekFrom::Start(0)) {
        } else {
            return false;
        }

        if let Ok(_) = self.ff_info_pop_w.write(format!("{};{};{};{};{}\n", self.queue.name, self.name, self.pos_record, self.count_popped, self.id).as_bytes()) {
            return true;
        };

        return false;
    }
}

pub struct Queue {
    is_ready: bool,
    name: String,
    ff_queue_r: File,
    ff_info_push_w: File,
    ff_info_queue_w: File,
    pub count_pushed: u64,
    right_edge: u64,
    id: u32,
}

impl Queue {
    pub fn new(queue_name: &str) -> Result<Queue, i64> {
        if let Ok(fqi) = OpenOptions::new().read(true).write(true).create(true).open(QUEUE_PATH.to_owned() + "/" + queue_name + "_info_queue") {
            let tmp_f1 = fqi.try_clone().unwrap();
            let tmp_f2 = fqi.try_clone().unwrap();

            let mut queue = Queue {
                is_ready: true,
                name: queue_name.to_owned(),
                ff_queue_r: fqi,
                count_pushed: 0,
                right_edge: 0,
                ff_info_queue_w: tmp_f1,
                ff_info_push_w: tmp_f2,
                id: 0,
            };

            if queue.get_info_queue() == true {
                queue.get_info_of_part(queue.id);
            }

            return Ok(queue);
        }

        return Err(-1);
    }

    pub fn open_part(&mut self, part_id: u32) -> bool {
        if self.is_ready == false {
            return false;
        }

        if let Ok(ff) = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(QUEUE_PATH.to_owned() + "/" + &self.name + "-" + &part_id.to_string() + "/" + &self.name + "_info_push")
        {
            self.ff_info_push_w = ff;
        } else {
            self.is_ready = false;
            return false;
        }

        info!("[{}] open part {}", self.name, part_id);

        if let Ok(f) = File::open(QUEUE_PATH.to_owned() + "/" + &self.name + "-" + &part_id.to_string() + "/" + &self.name + "_queue") {
            self.ff_queue_r = f;
        } else {
            self.is_ready = false;
            return false;
        }

        return self.get_info_of_part(self.id);
    }

    pub fn get_info_queue(&mut self) -> bool {
        let mut res = true;

        let mut id = 0;

        &self.ff_info_queue_w.seek(SeekFrom::Start(0));
        for line in BufReader::new(&self.ff_info_queue_w).lines() {
            if let Ok(ll) = line {
                let (queue_name, _id, _crc) = scan_fmt!(&ll.to_owned(), "{};{};{}", String, u32, String);

                match queue_name {
                    Some(q) => {
                        if q != self.name {
                            res = false;
                        }
                    }
                    None => res = false,
                }

                match _id {
                    Some(q) => id = q,
                    None => res = false,
                }
            } else {
                return false;
            }

            break;
        }

        if res == true {
            self.id = id;
        }

        //info!("@ read info_queue: name={}, id={}", self.name, self.id);

        return res;
    }

    pub fn get_info_of_part(&mut self, part_id: u32) -> bool {
        if self.id != part_id {
            if let Ok(ff) = OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .open(QUEUE_PATH.to_owned() + "/" + &self.name + "-" + &part_id.to_string() + "/" + &self.name + "_info_push")
            {
                self.ff_info_push_w = ff;
            } else {
                return false;
            }
        }

        let mut res = true;
        let mut right_edge = 0;
        let mut count_pushed = 0;

        &self.ff_info_push_w.seek(SeekFrom::Start(0));
        for line in BufReader::new(&self.ff_info_push_w).lines() {
            if let Ok(ll) = line {
                let (queue_name, position, pushed, _crc) = scan_fmt!(&ll.to_owned(), "{};{};{};{}", String, u64, u64, String);

                match queue_name {
                    Some(q) => {
                        if q != self.name {
                            res = false;
                        }
                    }
                    None => res = false,
                }

                match position {
                    Some(q) => right_edge = q,
                    None => res = false,
                }

                match pushed {
                    Some(q) => count_pushed = q,
                    None => res = false,
                }
            } else {
                return false;
            }

            break;
        }

        if res == true {
            self.right_edge = right_edge;
            self.count_pushed = count_pushed;
        }

        //info!("queue ({}): count_pushed:{}, right_edge:{}, id:{}, ready:{}", self.name, self.count_pushed, self.right_edge, self.id, self.is_ready);

        return res;
    }
}
