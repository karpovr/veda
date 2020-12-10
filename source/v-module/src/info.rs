use crc32fast::Hasher;
use std::fs::*;
use std::io::{BufRead, BufReader};
use std::io::{Error, ErrorKind, Seek, SeekFrom, Write};
use std::path::Path;

pub struct ModuleInfo {
    _base_path: String,
    name: String,
    ff_info: File,
    is_ready: bool,
    is_writer: bool,
}

impl ModuleInfo {
    pub fn new(base_path: &str, info_name: &str, is_writer: bool) -> std::io::Result<ModuleInfo> {
        if !Path::new(&base_path).exists() {
            if let Err(e) = create_dir_all(base_path.to_owned()) {
                error!("queue:{} create dir [{}], err={}", info_name, base_path, e);
                return Err(e);
            }
        }

        let info_path = base_path.to_owned() + "/module-info/";
        if !Path::new(&info_path).exists() {
            if let Err(e) = create_dir_all(info_path.to_owned()) {
                error!("queue:{} create dir [{}], err={}", info_name, info_path, e);
                return Err(e);
            }
        }

        let file_name_info = info_path + info_name + "_info";

        let ff = if is_writer {
            match OpenOptions::new().read(true).write(is_writer).create(true).open(file_name_info) {
                Ok(ff) => Ok(ff),
                Err(e) => Err(e),
            }
        } else {
            match OpenOptions::new().read(true).open(file_name_info) {
                Ok(ff) => Ok(ff),
                Err(e) => Err(e),
            }
        };

        if let Ok(f) = ff {
            let mut mi = ModuleInfo {
                _base_path: base_path.to_owned(),
                name: info_name.to_owned(),
                ff_info: f,
                is_ready: true,
                is_writer,
            };

            if mi.read_info().is_none() {
                if let Err(e) = mi.put_info(0, 0) {
                    info!("fail write module info, err={}", e);
                }
            }

            Ok(mi)
        } else {
            Err(ff.err().unwrap())
        }
    }

    pub fn put_info(&mut self, op_id: i64, committed_op_id: i64) -> std::io::Result<()> {
        if !self.is_ready {
            return Err(Error::new(ErrorKind::Other, "module_info not ready"));
        }

        if !self.is_writer {
            return Err(Error::new(ErrorKind::Other, "module_info open as read only"));
        }

        //self.ff_info.set_len(0)?;
        self.ff_info.seek(SeekFrom::Start(0))?;

        let p = format!("{};{};{};", self.name, op_id, committed_op_id);
        let mut hash = Hasher::new();
        hash.update(p.as_bytes());

        if let Err(e) = self.ff_info.write(format!("{}{:X}\n", p, hash.finalize()).as_bytes()) {
            error!("fail put info push, set queue.ready = false, err={}", e);
            self.is_ready = false;
            return Err(e);
        }

        //self.ff_info.sync_data();
        //info!("op_id={}", op_id);

        Ok(())
    }

    pub fn read_info(&mut self) -> Option<(i64, i64)> {
        let mut res = false;
        let mut op_id = 0;
        let mut committed_op_id = 0;

        if self.ff_info.seek(SeekFrom::Start(0)).is_err() {
            return None;
        }

        if let Some(line) = BufReader::new(&self.ff_info).lines().next() {
            res = true;
            if let Ok(ll) = line {
                let (module_name, _op_id, _committed_op_id, _crc) = scan_fmt!(&ll, "{};{};{};{}", String, i64, i64, String);

                match module_name {
                    Some(q) => {
                        if q != self.name {
                            res = false;
                        }
                    }
                    None => res = false,
                }

                match _op_id {
                    Some(q) => op_id = q,
                    None => res = false,
                }

                match _committed_op_id {
                    Some(q) => committed_op_id = q,
                    None => res = false,
                }
            } else {
                return None;
            }
        }

        if res {
            return Some((op_id, committed_op_id));
        }

        None
    }
}
