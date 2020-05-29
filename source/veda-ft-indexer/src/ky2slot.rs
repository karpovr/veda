use crate::error::Result;
use crc32fast::Hasher;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Seek, SeekFrom, Write};

const XAPIAN_INFO_PATH: &str = "./data/xapian-info";

pub struct Key2Slot {
    data: HashMap<String, u32>,
    last_size_key2slot: usize,
}

impl Default for Key2Slot {
    fn default() -> Self {
        Key2Slot {
            data: Default::default(),
            last_size_key2slot: 0,
        }
    }
}

impl Key2Slot {
    pub(crate) fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    pub fn get_slot(&self, key: &str) -> Option<u32> {
        if key.is_empty() {
            return None;
        }

        if let Some(c) = key.chars().nth(0) {
            if c == '#' {
                if let Ok(v) = key[1..].parse::<u32>() {
                    return Some(v);
                } else {
                    error!("invalid slot: {}", key);
                    return None;
                }
            }
        }

        if let Some(slot) = self.data.get(key) {
            Some(slot.to_owned())
        } else {
            error!("key2slot, slot not found, key={}", key);
            None
        }
    }

    pub fn get_slot_and_set_if_not_found(&mut self, field: &str) -> u32 {
        if let Some(slot) = self.get_slot(field) {
            return slot;
        }

        // create new slot
        let slot = (self.data.len() + 1) as u32;
        self.data.insert(field.to_owned(), slot);
        if let Err(e) = self.store() {
            error!("fail store key2slot, err={:?}", e);
        } else {
            info!("create new slot {}={}", field, slot);
        }
        slot
    }

    pub(crate) fn load() -> Result<Key2Slot> {
        let mut ff = OpenOptions::new().read(true).open(XAPIAN_INFO_PATH.to_owned() + "/key2slot")?;
        ff.seek(SeekFrom::Start(0))?;

        let mut key2slot = Key2Slot::default();

        if let Some(line) = BufReader::new(ff).lines().next() {
            if let Ok(ll) = line {
                let (field, slot) = scan_fmt!(&ll, "\"{}\",{}", String, u32);

                if field.is_some() && slot.is_some() {
                    key2slot.data.insert(field.unwrap(), slot.unwrap());
                } else {
                    error!("fail parse key2slot, line={}", ll);
                }
            }
        }

        Ok(key2slot)
    }

    pub(crate) fn store(&mut self) -> Result<()> {
        let (data, hash) = self.serialize();

        if data.len() == self.last_size_key2slot {
            return Ok(());
        }

        let mut ff = OpenOptions::new().read(true).write(true).create(true).open(XAPIAN_INFO_PATH.to_owned() + "/key2slot")?;
        ff.seek(SeekFrom::Start(0))?;
        ff.write(format!("\"{}\",{}\n{}", hash, data.len(), data).as_bytes())?;

        Ok(())
    }

    fn serialize(&self) -> (String, String) {
        let mut outbuff = String::new();

        for (key, value) in self.data.iter() {
            outbuff.push('"');
            outbuff.push_str(key);
            outbuff.push('"');
            outbuff.push(',');
            outbuff.push_str(&value.to_string());
            outbuff.push('\n');
        }

        let mut hash = Hasher::new();
        hash.update(outbuff.as_bytes());

        let hash_hex = format!("{:X}", hash.finalize());

        return (outbuff, hash_hex);
    }
}
