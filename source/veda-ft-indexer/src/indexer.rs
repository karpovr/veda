use crate::index_workplace::IndexDocWorkplace;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::time::Instant;
use std::{fmt, fs};
use v_ft_xapian::index_schema::IndexerSchema;
use v_ft_xapian::key2slot::{Key2Slot, XAPIAN_INFO_PATH};
use v_ft_xapian::to_lower_and_replace_delimiters;
use v_ft_xapian::xapian_reader::XapianReader;
use v_module::info::ModuleInfo;
use v_module::v_api::IndvOp;
use v_module::v_onto::datatype::{DataType, Lang};
use v_module::v_onto::individual::Individual;
use v_module::v_onto::onto::Onto;
use v_module::v_onto::resource::Resource;
use v_module::veda_backend::*;
use xapian_rusty::*;

pub const BATCH_SIZE_OF_TRANSACTION: i64 = 5000;

pub(crate) struct Indexer {
    pub onto: Onto,
    pub index_dbs: HashMap<String, WritableDatabase>,
    pub tg: TermGenerator,
    pub lang: String,
    pub key2slot: Key2Slot,
    pub db2path: HashMap<String, String>,
    pub idx_schema: IndexerSchema,
    pub use_db: String,

    pub committed_op_id: i64,
    pub prepared_op_id: i64,
    pub committed_time: Instant,
    pub xr: XapianReader,
    pub module_info: ModuleInfo,
    pub last_indexed_id: String,
    pub failed_ids: HashSet<String>,
}

impl fmt::Debug for Indexer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "use_db = {}", self.use_db)
    }
}

impl Indexer {
    pub(crate) fn init(&mut self, use_db: &str) -> Result<(), XError> {
        if !use_db.is_empty() {
            warn!("indexer uses only {} db", use_db);
        }

        if let Ok(k) = Key2Slot::load() {
            self.key2slot = k;
        } else {
            fs::create_dir_all(&(XAPIAN_INFO_PATH))?;
            self.key2slot = Default::default();
            warn!("failed to load key2slot file, create new one");
        }

        self.use_db = use_db.to_string();

        for (db_name, path) in self.db2path.iter() {
            let mut db;
            let full_path = &("./".to_owned() + path);
            if Path::new(full_path).is_dir() {
                info!("opened db {}, path = {}", db_name, full_path);
                Database::new_with_path(path, UNKNOWN)?;
                db = WritableDatabase::new(path, DB_OPEN, UNKNOWN)?;
            } else {
                info!("created new db {}, path = {}", db_name, full_path);
                fs::create_dir_all(full_path)?;
                db = WritableDatabase::new(path, DB_CREATE_OR_OPEN, CHERT)?;
            }

            let doc_count = db.get_doccount()?;
            info!("db {}, document count = {}", db_name, doc_count);
            self.index_dbs.insert(db_name.to_owned(), db);
        }

        let mut stem = Stem::new(&self.lang)?;
        self.tg.set_stemmer(&mut stem)?;

        Ok(())
    }

    //    fn reload_index_schema(&mut self, module: &mut Module) {
    //        self.idx_prop.load(true, &self.onto, module);
    //    }

    pub(crate) fn index_msg(&mut self, new_indv: &mut Individual, prev_indv: &mut Individual, cmd: IndvOp, op_id: i64, backend: &mut Backend) -> Result<()> {
        if cmd == IndvOp::Remove {
            return Ok(());
        }

        debug!("prepare {}", new_indv.get_id());

        let is_deleted = new_indv.is_exists_bool("v-s:deleted", true);
        let prev_is_deleted = prev_indv.is_exists_bool("v-s:deleted", true);

        let is_restored = if prev_is_deleted && !is_deleted && self.use_db.is_empty() {
            info!("restore previously deleted individual: {} ", new_indv.get_id());
            true
        } else {
            false
        };

        self.idx_schema.load(false, &self.onto, backend, &mut self.xr);

        if !new_indv.is_empty() {
            let is_draft_of = new_indv.get_first_literal("v-s:is_draft_of");

            if is_draft_of.is_some() {
                info!("individual {} is draft, skip", new_indv.get_id());
                return Ok(());
            }

            let types = new_indv.get_literals("rdf:type").unwrap_or_default();
            let prev_types = prev_indv.get_literals("rdf:type").unwrap_or_default();

            let mut prev_dbname = "base".to_owned();
            for _type in prev_types {
                prev_dbname = self.idx_schema.get_dbname_of_class(&_type).to_string();
                if prev_dbname != "base" {
                    break;
                }
            }

            let uuid = "uid_".to_owned() + &to_lower_and_replace_delimiters(new_indv.get_id());

            // используем информацию о типе, для определения, в какой базе следует проводить индексацию
            let mut dbname = "base".to_owned();
            for _type in types.iter() {
                if _type == "vdi:ClassIndex" {
                    self.idx_schema.add_schema_data(&self.onto, new_indv);
                }

                dbname = self.idx_schema.get_dbname_of_class(_type).to_owned();
                if dbname != "base" {
                    break;
                }
            }

            let is_version = types.contains(&"v-s:Version".to_owned());

            if !is_deleted && is_version {
                if self.index_dbs.contains_key(&dbname) {
                    if let Some(db) = self.index_dbs.get_mut(&dbname) {
                        if db.delete_document(&uuid).is_ok() {
                            info!("individual {} is version, remove", new_indv.get_id());
                        } else {
                            info!("individual {} is version, ignore", new_indv.get_id());
                        }
                    }
                }

                return Ok(());
            }

            if prev_dbname != dbname && !prev_indv.is_empty() && self.use_db.is_empty() {
                info!("[{}] prev_db[{}] != new_db[{}]", new_indv.get_id(), prev_dbname, dbname);
                info!("[{}] remove from [{}]", new_indv.get_id(), prev_dbname);

                if self.index_dbs.contains_key(&prev_dbname) {
                    if let Some(db) = self.index_dbs.get_mut(&prev_dbname) {
                        db.delete_document(&uuid)?;
                    }
                }
            }

            if !is_deleted && dbname == "not-indexed" {
                return Ok(());
            }

            if !self.use_db.is_empty() {
                if is_deleted && self.use_db != "deleted" {
                    return Ok(());
                }

                if dbname != self.use_db && self.use_db != "deleted" {
                    return Ok(());
                }
            }

            let mut iwp = IndexDocWorkplace::new(Document::new()?);
            self.tg.set_document(&mut iwp.doc)?;

            let mut prepared_links = HashSet::new();
            new_indv.parse_all();
            for (predicate, resources) in new_indv.get_obj().get_resources() {
                debug!("predicate = {}", predicate);
                let mut p_text_ru = String::new();
                let mut p_text_en = String::new();

                if !resources.is_empty() {
                    iwp.index_boolean(self, &(predicate.to_owned() + ".isExists"), &Resource::new_bool(true))?;
                }

                for oo in resources {
                    for _type in types.iter() {
                        if let Some(id) = self.idx_schema.get_index_id_of_uri_and_property(_type, predicate) {
                            self.prepare_index(backend, &mut iwp, &id, predicate, oo, predicate, 0, &mut prepared_links)?;
                        } else if let Some(id) = self.idx_schema.get_index_id_of_property(predicate) {
                            self.prepare_index(backend, &mut iwp, &id, predicate, oo, predicate, 0, &mut prepared_links)?;
                        }
                    }

                    match oo.rtype {
                        DataType::Uri => {
                            iwp.index_uri(self, predicate, oo)?;
                        }
                        DataType::String => {
                            if oo.get_lang() == Lang::RU {
                                p_text_ru.push_str(oo.get_str());
                            } else if oo.get_lang() == Lang::EN {
                                p_text_en.push_str(oo.get_str());
                            }

                            iwp.index_string(self, predicate, oo)?;
                        }
                        DataType::Integer => {
                            iwp.index_integer(self, predicate, oo)?;
                        }
                        DataType::Datetime => {
                            iwp.index_date(self, predicate, oo)?;
                        }
                        DataType::Decimal => {
                            iwp.index_double(self, predicate, oo)?;
                        }
                        DataType::Boolean => {
                            iwp.index_boolean(self, predicate, oo)?;
                        }
                        DataType::Binary => {}
                    }
                }

                if !resources.is_empty() {
                    if !p_text_ru.is_empty() {
                        let slot_l1 = self.key2slot.get_slot_and_set_if_not_found(&(predicate.to_owned() + "_ru"));
                        self.tg.index_text_with_prefix(&p_text_ru, &format!("X{}X", slot_l1))?;
                        iwp.doc_add_text_value(slot_l1, &p_text_ru)?;
                    }

                    if !p_text_en.is_empty() {
                        let slot_l1 = self.key2slot.get_slot_and_set_if_not_found(&(predicate.to_owned() + "_en"));
                        self.tg.index_text_with_prefix(&p_text_en, &format!("X{}X", slot_l1))?;
                        iwp.doc_add_text_value(slot_l1, &p_text_en)?;
                    }
                }
            }

            self.tg.index_text(&iwp.all_text)?;

            iwp.doc.add_boolean_term(&uuid)?;
            iwp.doc.set_data(new_indv.get_id())?;

            if self.index_dbs.contains_key("deleted") {
                if is_restored {
                    if let Some(db) = self.index_dbs.get_mut("deleted") {
                        db.delete_document(&uuid)?;
                    }
                }

                if is_deleted {
                    if let Some(db) = self.index_dbs.get_mut("deleted") {
                        db.replace_document(&uuid, &mut iwp.doc)?;
                    }
                    self.tg.set_document(&mut Document::new()?)?;
                }
            }

            if self.index_dbs.contains_key(&dbname) {
                if let Some(db) = self.index_dbs.get_mut(&dbname) {
                    if is_deleted {
                        info!("delete from db [{}], type = {}, uri = {}", dbname, types.first().unwrap_or(&"unknown".to_owned()), new_indv.get_id());
                        db.delete_document(&uuid)?;
                    } else {
                        info!("index to db [{}], type = {}, uri = {}", dbname, types.first().unwrap_or(&"unknown".to_owned()), new_indv.get_id());
                        db.replace_document(&uuid, &mut iwp.doc)?;
                    }
                }
            }

            self.prepared_op_id = op_id;

            if (op_id - self.committed_op_id) % BATCH_SIZE_OF_TRANSACTION == 0 {
                if !self.key2slot.is_empty() {
                    if let Err(e) = self.key2slot.store() {
                        error!("failed to store key2slot file, err = {:?}", e);
                    }
                }

                self.commit_all_db()?;
            }
        }

        Ok(())
    }

    pub(crate) fn commit_all_db(&mut self) -> Result<()> {
        let delta = self.prepared_op_id - self.committed_op_id;
        let duration = self.committed_time.elapsed().as_millis();

        debug!("duration = {}", duration);

        if delta > 0 {
            for (name, db) in self.index_dbs.iter_mut() {
                debug!("commit to {}", name);
                if let Err(e) = db.commit() {
                    //error!("FT:commit:{} fail={}, err={:?}", name, self.prepared_op_id, get_xapian_err_type(e.into()));
                    return Err(e);
                }
            }

            self.committed_op_id = self.prepared_op_id;
            self.committed_time = Instant::now();

            self.module_info.put_info(self.prepared_op_id, self.committed_op_id)?;

            info!("commit, indexed = {}, delta = {}, cps = {:.1}", self.committed_op_id, delta, delta as f64 / (duration as f64 / 1000.0));
        }

        Ok(())
    }

    fn prepare_index(
        &mut self,
        module: &mut Backend,
        iwp: &mut IndexDocWorkplace,
        idx_id: &str,
        predicate: &str,
        rs: &Resource,
        ln: &str,
        level: i32,
        prep: &mut HashSet<String>,
    ) -> Result<()> {
        let key = format!("{}+{}", predicate, rs.get_uri());

        if level > 0 && prep.contains(&key) {
            error!("index loop found, predicate = {}, link = {}, level = {}", predicate, rs.get_uri(), level);
            return Ok(());
        }

        prep.insert(key);

        if let Some(idx) = self.idx_schema.get_copy_of_index(idx_id) {
            if rs.rtype == DataType::String {
                if idx.get_literals_nm("vdi:indexed_field_as_fwildcard").is_some() {
                    iwp.index_string_for_first_wildcard(self, predicate, rs)?;
                }
            } else if rs.rtype == DataType::Uri {
                // 1. считать индивид по ссылке
                if let Some(inner_indv) = module.get_individual(rs.get_uri(), &mut Individual::default()) {
                    for predicate in idx.get_predicates_nm() {
                        if predicate != "vdi:inherited_index" {
                            continue;
                        }
                        if let Some(values) = idx.get_literals_nm(&predicate) {
                            for value in values.iter() {
                                // ссылка на наследуемый индекс, переходим вниз
                                if let Some(inhr_idx) = self.idx_schema.get_index(value) {
                                    debug!("[{}] ссылка на наследуемый индекс, переходим вниз по иерархии индекса [{}]", value, &inhr_idx.get_id());

                                    if let Some(for_properties) = inhr_idx.get_literals_nm("vdi:forProperty") {
                                        for for_property in for_properties.iter() {
                                            if let Some(links) = inner_indv.get_obj().get_resources().get(for_property) {
                                                debug!("forProperty = [{}], links = [{:?}]", for_property, links);
                                                for link in links {
                                                    self.prepare_index(module, iwp, value, &predicate, link, &(ln.to_owned() + "." + &for_property), level + 1, prep)?;
                                                }
                                            }
                                        }
                                    } else {
                                        // в этом индексе не указанно на какое свойство будет индексация,
                                        // значит берем поля указанные vdi:indexed_field в текущем индивиде

                                        if let Some(indexed_fields) = inhr_idx.get_literals_nm("vdi:indexed_field") {
                                            for indexed_field in indexed_fields.iter() {
                                                inner_indv.get_first_literal(indexed_field);
                                                if let Some(rrc) = inner_indv.get_obj().get_resources().get(indexed_field) {
                                                    for rc in rrc {
                                                        debug!("index {}.{} = {:?} ", ln, indexed_field, rc);

                                                        match rc.rtype {
                                                            DataType::Uri => {
                                                                iwp.index_uri(self, &format!("{}.{}", ln, indexed_field), rc)?;
                                                            }
                                                            DataType::String => {
                                                                iwp.index_string(self, &format!("{}.{}", ln, indexed_field), rc)?;
                                                            }

                                                            DataType::Integer => {
                                                                iwp.index_integer(self, &format!("{}.{}", ln, indexed_field), rc)?;
                                                            }

                                                            DataType::Datetime => {
                                                                iwp.index_date(self, &format!("{}.{}", ln, indexed_field), rc)?;
                                                            }

                                                            DataType::Decimal => {
                                                                iwp.index_double(self, &format!("{}.{}", ln, indexed_field), rc)?;
                                                            }

                                                            DataType::Boolean => {
                                                                iwp.index_boolean(self, &format!("{}.{}", ln, indexed_field), rc)?;
                                                            }

                                                            DataType::Binary => {}
                                                        }
                                                    }

                                                    if !rrc.is_empty() {
                                                        iwp.index_boolean(self, &format!("{}.{}.isExists", ln, indexed_field), &Resource::new_bool(true))?;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }
}
