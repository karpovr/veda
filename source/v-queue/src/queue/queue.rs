use crate::fs2::FileExt;
use crate::record::*;
use crc32fast::Hasher;
use std::fs::*;
use std::io::prelude::*;
use std::io::SeekFrom;
use std::io::{BufRead, BufReader};
use std::path::*;

pub struct Queue {
    pub base_path: String,
    mode: Mode,
    pub is_ready: bool,
    pub name: String,
    pub ff_queue: File,
    ff_info_push: File,
    ff_info_queue: File,
    right_edge: u64,
    pub count_pushed: u32,
    pub id: u32,
}

impl Queue {
    pub fn new(base_path: &str, queue_name: &str, mode: Mode) -> Result<Queue, ErrorQueue> {
        if Path::new(&base_path).exists() == false {
            if let Err(e) = create_dir_all(base_path.to_owned()) {
                error!("queue:{} create path, err={}", queue_name, e);
                return Err(ErrorQueue::FailWrite);
            }
        }

        let file_name_info_queue = base_path.to_owned() + "/" + queue_name + "_info_queue";
        if let Ok(fqi) = OpenOptions::new().read(true).write(true).create(true).open(file_name_info_queue) {
            let tmp_f1 = fqi.try_clone().unwrap();
            let tmp_f2 = fqi.try_clone().unwrap();

            let mut queue = Queue {
                base_path: base_path.to_string(),
                mode: mode.clone(),
                is_ready: true,
                name: queue_name.to_owned(),
                count_pushed: 0,
                right_edge: 0,
                ff_queue: fqi,
                ff_info_queue: tmp_f1,
                ff_info_push: tmp_f2,
                id: 0,
            };

            let info_is_ok = queue.get_info_queue();

            if mode == Mode::ReadWrite {
                let file_name_lock = queue.base_path.to_owned() + "/" + queue_name + "_queue.lock";

                match OpenOptions::new().read(true).write(true).create(true).open(file_name_lock) {
                    Ok(file) => {
                        if let Err(e) = file.lock_exclusive() {
                            error!("queue:{}:{} attempt lock, err={}", queue.name, queue.id, e);
                            return Err(ErrorQueue::AlreadyOpen);
                        }
                    }
                    Err(e) => {
                        error!("queue:{}:{} prepare lock, err={}", queue.name, queue.id, e);
                        return Err(ErrorQueue::FailOpen);
                    }
                }

                if info_is_ok {
                    queue.id = queue.id + 1;
                    queue.count_pushed = 0;
                    queue.right_edge = 0;
                }

                let part_name = queue.name.to_owned() + "-" + &queue.id.to_string();

                if Path::new(&part_name).exists() == false {
                    if let Err(e) = create_dir_all(queue.base_path.to_owned() + "/" + &part_name) {
                        error!("queue:{}:{} create path, err={}", queue.name, queue.id, e);
                        return Err(ErrorQueue::FailWrite);
                    }
                }

                if let Err(e) = queue.open_part(queue.id) {
                    error!("queue:{}:{} open part, err={:?}", queue.name, queue.id, e);
                    return Err(ErrorQueue::FailOpen);
                }

                if let Err(e) = queue.put_info_queue() {
                    error!("queue:{}:{} open, write info, err={:?}", queue.name, queue.id, e);
                    return Err(ErrorQueue::FailWrite);
                }
            }

            if info_is_ok {
                if let Err(e) = queue.get_info_of_part(queue.id, true) {
                    error!("queue:{}:{} open, get info of part: {}", queue.name, queue.id, e.as_str());
                }
            }

            return Ok(queue);
        }

        return Err(ErrorQueue::NotReady);
    }

    pub fn push(&mut self, data: &[u8], msg_type: MsgType) -> Result<u64, ErrorQueue> {
        if self.is_ready == false || self.mode == Mode::Read || data.len() > std::u32::MAX as usize / 2 {
            return Err(ErrorQueue::NotReady);
        }

        let header = Header {
            start_pos: self.right_edge,
            msg_length: data.len() as u32,
            magic_marker: 0xEEFEEFEE,
            count_pushed: self.count_pushed + 1,
            crc: 0,
            msg_type: msg_type,
        };

        let mut bheader = [0; HEADER_SIZE];
        header.to_buf(&mut bheader);

        let mut hash = Hasher::new();
        hash.update(&bheader);
        hash.update(data);

        let bhash = u32::to_ne_bytes(hash.finalize());

        bheader[21] = bhash[0];
        bheader[22] = bhash[1];
        bheader[23] = bhash[2];
        bheader[24] = bhash[3];

        if let Err(e) = self.ff_queue.write(&bheader) {
            error!("queue:{}:{} push, write header, err={}", self.name, self.id, e);
            return Err(ErrorQueue::FailWrite);
        }
        if let Err(e) = self.ff_queue.write(&data) {
            error!("queue:{}:{} push, write body, err={}", self.name, self.id, e);
            return Err(ErrorQueue::FailWrite);
        }

        self.right_edge = self.right_edge + bheader.len() as u64 + data.len() as u64;
        self.count_pushed = self.count_pushed + 1;

        if let Err(_) = self.put_info_push() {
            self.right_edge = self.right_edge - bheader.len() as u64 - data.len() as u64;
            self.count_pushed = self.count_pushed - 1;
        }

        Ok(self.right_edge)
    }

    fn put_info_push(&mut self) -> Result<(), ErrorQueue> {
        if let Ok(_) = self.ff_info_push.seek(SeekFrom::Start(0)) {
        } else {
            error!("fail put info push, set queue.ready = false");
            self.is_ready = false;
            return Err(ErrorQueue::FailWrite);
        }

        let p = format!("{};{};{};", self.name, self.right_edge, self.count_pushed);
        let mut hash = Hasher::new();
        hash.update(p.as_bytes());

        if let Err(e) = self.ff_info_push.write(format!("{}{}\n", p, hash.finalize()).as_bytes()) {
            error!("fail put info push, set queue.ready = false, err={}", e);
            self.is_ready = false;
            return Err(ErrorQueue::FailWrite);
        }

        Ok(())
    }

    fn put_info_queue(&mut self) -> Result<(), ErrorQueue> {
        if let Ok(_) = self.ff_info_queue.seek(SeekFrom::Start(0)) {
        } else {
            error!("fail put info queue, set queue.ready = false");
            self.is_ready = false;
            return Err(ErrorQueue::FailWrite);
        }

        let p = format!("{};{};", self.name, self.id);
        let mut hash = Hasher::new();
        hash.update(p.as_bytes());

        if let Err(e) = self.ff_info_queue.write(format!("{}{}\n", p, hash.finalize()).as_bytes()) {
            error!("fail put info queue, set queue.ready = false, err={}", e);
            self.is_ready = false;
            return Err(ErrorQueue::FailWrite);
        }

        Ok(())
    }

    fn open_info_push(&mut self, part_id: u32) -> Result<(), ErrorQueue> {
        let ipp = self.base_path.to_owned() + "/" + &self.name + "-" + &part_id.to_string() + "/" + &self.name + "_info_push";

        let ffiq;
        if self.mode == Mode::ReadWrite {
            ffiq = OpenOptions::new().read(true).write(true).create(true).open(ipp.to_owned());
        } else {
            ffiq = OpenOptions::new().read(true).open(ipp.to_owned());
        }

        if let Ok(ff) = ffiq {
            self.ff_info_push = ff;
        } else {
            error!("[{}] fail open info push, part {}", self.name, part_id);
            self.is_ready = false;
            return Err(ErrorQueue::FailOpen);
        }

        return Ok(());
    }

    pub fn open_part(&mut self, part_id: u32) -> Result<(), ErrorQueue> {
        if self.is_ready == false {
            return Err(ErrorQueue::NotReady);
        }

        if let Err(e) = self.open_info_push(part_id) {
            return Err(e);
        }

        let qpp = self.base_path.to_owned() + "/" + &self.name + "-" + &part_id.to_string() + "/" + &self.name + "_queue";
        let ffq;
        if self.mode == Mode::ReadWrite {
            ffq = OpenOptions::new().read(true).write(true).create(true).open(qpp.to_owned());
        } else {
            ffq = OpenOptions::new().read(true).open(qpp.to_owned());
        }

        if let Ok(f) = ffq {
            self.ff_queue = f;
        } else {
            error!("[{}] fail open part {}", self.name, part_id);
            self.is_ready = false;
            return Err(ErrorQueue::FailOpen);
        }

        self.id = part_id;

        info!("[{}] open part {}", self.name, part_id);

        return self.get_info_of_part(self.id, false);
    }

    pub fn get_info_queue(&mut self) -> bool {
        let mut res = false;

        let mut id = 0;

        &self.ff_info_queue.seek(SeekFrom::Start(0));
        for line in BufReader::new(&self.ff_info_queue).lines() {
            res = true;
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

    pub fn get_info_of_part(&mut self, part_id: u32, reopen: bool) -> Result<(), ErrorQueue> {
        if self.id != part_id || reopen {
            if let Err(e) = self.open_info_push(part_id) {
                return Err(e);
            }
        }

        let mut res = true;
        let mut right_edge = 0;
        let mut count_pushed = 0;

        &self.ff_info_push.seek(SeekFrom::Start(0));
        for line in BufReader::new(&self.ff_info_push).lines() {
            if let Ok(ll) = line {
                let (queue_name, position, pushed, _crc) = scan_fmt!(&ll.to_owned(), "{};{};{};{}", String, u64, u32, String);

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
                return Err(ErrorQueue::Other);
            }

            break;
        }

        if res == true {
            self.right_edge = right_edge;
            self.count_pushed = count_pushed;
            return Ok(());
        }

        //info!("queue ({}): count_pushed:{}, right_edge:{}, id:{}, ready:{}", self.name, self.count_pushed, self.right_edge, self.id, self.is_ready);

        return Err(ErrorQueue::Other);
    }
}
