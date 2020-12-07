use crate::index_schema::*;
use crate::init_db_path;
use crate::key2slot::*;
use crate::vql::*;
use crate::xapian_vql::*;
use std::collections::HashMap;
use std::io::{Error, ErrorKind};
use std::time::Instant;
use std::time::SystemTime;
use v_api::app::OptAuthorize;
use v_api::app::ResultCode;
use v_module::info::ModuleInfo;
use v_module::onto::load_onto;
use v_onto::individual::Individual;
use v_onto::onto::Onto;
use v_onto::onto_index::OntoIndex;
use v_search::common::{FTQuery, QueryResult};
use v_storage::storage::VStorage;
use xapian_rusty::*;

const MAX_WILDCARD_EXPANSION: i32 = 20_000;
const BASE_PATH: &str = "./data";

pub struct DatabaseQueryParser {
    db: Database,
    qp: QueryParser,
}

impl DatabaseQueryParser {
    fn add_database(&mut self, db_name: &str, opened_db: &mut HashMap<String, Database>) -> Result<()> {
        if let Some(add_db) = opened_db.get_mut(db_name) {
            self.db.add_database(add_db)?;
        }
        Ok(())
    }
}

pub struct XapianReader {
    using_dbqp: HashMap<Vec<String>, DatabaseQueryParser>,
    opened_db: HashMap<String, Database>,
    xapian_stemmer: Stem,
    xapian_lang: String,
    index_schema: IndexerSchema,
    mdif: ModuleInfo,
    key2slot: Key2Slot,
    onto: Onto,
    db2path: HashMap<String, String>,
    committed_op_id: i64,
    onto_modified: SystemTime,
}

impl XapianReader {
    pub fn new(lang: &str, storage: &mut VStorage) -> Option<Self> {
        let indexer_module_info = ModuleInfo::new(BASE_PATH, "fulltext_indexer", true);
        if indexer_module_info.is_err() {
            error!("{:?}", indexer_module_info.err());
            return None;
        }

        let mut onto = Onto::default();
        load_onto(storage, &mut onto);

        let mut xr = XapianReader {
            using_dbqp: Default::default(),
            opened_db: Default::default(),
            xapian_stemmer: Stem::new(lang).unwrap(),
            xapian_lang: lang.to_string(),
            index_schema: Default::default(),
            mdif: indexer_module_info.unwrap(),
            key2slot: Key2Slot::load().unwrap_or_default(),
            onto,
            db2path: init_db_path(),
            committed_op_id: 0,
            onto_modified: SystemTime::now(),
        };

        xr.load_index_schema(storage);

        Some(xr)
    }

    pub fn query(&mut self, request: FTQuery, storage: &mut VStorage) -> QueryResult {
        let mut ctx = vec![];
        fn add_out_element(id: &str, ctx: &mut Vec<String>) {
            ctx.push(id.to_owned());
        }

        if let Ok(mut res) = self.query_use_collect_fn(&request, add_out_element, OptAuthorize::YES, storage, &mut ctx) {
            res.result = ctx;
            debug!("res={:?}", res);
            return res;
        }
        QueryResult::default()
    }

    pub fn query_use_collect_fn<T>(
        &mut self,
        request: &FTQuery,
        add_out_element: fn(uri: &str, ctx: &mut T),
        op_auth: OptAuthorize,
        storage: &mut VStorage,
        ctx: &mut T,
    ) -> Result<QueryResult> {
        let total_time = Instant::now();
        let mut sr = QueryResult::default();

        let wtta = TTA::parse_expr(&request.query);

        if wtta.is_none() {
            error!("fail parse query (phase 1) [{}], tta is empty", request.query);
            sr.result_code = ResultCode::BadRequest;
            return Ok(sr);
        }

        if self.key2slot.is_need_reload()? {
            self.key2slot = Key2Slot::load()?;
        }

        let mut tta = wtta.unwrap();

        let db_names = self.get_dn_names(&tta, &request.databases);

        debug!("db_names={:?}", db_names);
        debug!(
            "user_uri=[{}] query=[{}] str_sort=[{}], db_names=[{:?}], from=[{}], top=[{}], limit=[{}]",
            request.user, request.query, request.sort, request.databases, request.from, request.top, request.limit
        );
        debug!("TTA [{}]", tta);

        if let Some((_, new_committed_op_id)) = self.mdif.read_info() {
            if new_committed_op_id > self.committed_op_id {
                info!("search:reopen_db: new committed_op_id={} > prev committed_op_id={}", new_committed_op_id, self.committed_op_id);
                self.reopen_dbs()?;
                self.committed_op_id = new_committed_op_id;
            } else {
                debug!("search:check reopen_db: new committed_op_id={}, prev committed_op_id={}", new_committed_op_id, self.committed_op_id);
            }
        }

        self.open_dbqp_if_need(&db_names)?;

        if let Some(t) = OntoIndex::get_modified() {
            if t > self.onto_modified {
                load_onto(storage, &mut self.onto);
                self.onto_modified = t;
            }
        }

        let mut query = Query::new()?;
        if let Some(dbqp) = self.using_dbqp.get_mut(&db_names) {
            let mut _rd: f64 = 0.0;
            transform_vql_to_xapian(&mut tta, "", None, None, &mut query, &self.key2slot, &mut _rd, 0, &mut dbqp.qp, &self.onto)?;
        }

        debug!("query={:?}", query.get_description());

        if query.is_empty() {
            sr.result_code = ResultCode::Ok;
            warn!("query is empty [{}]", request.query);
            return Ok(sr);
        }

        if let Some(dbqp) = self.using_dbqp.get_mut(&db_names) {
            let mut xapian_enquire = dbqp.db.new_enquire()?;

            xapian_enquire.set_query(&mut query)?;

            if let Some(s) = get_sorter(&request.sort, &self.key2slot)? {
                xapian_enquire.set_sort_by_key(s, true)?;
            }

            sr = exec_xapian_query_and_queue_authorize(&request.user, &mut xapian_enquire, request.from, request.top, request.limit, add_out_element, op_auth, ctx);
        }

        debug!("res={:?}", sr);
        sr.total_time = total_time.elapsed().as_millis() as i64;
        sr.query_time = sr.total_time - sr.authorize_time;

        Ok(sr)
    }

    pub fn load_index_schema(&mut self, storage: &mut VStorage) {
        fn add_out_element(id: &str, ctx: &mut Vec<String>) {
            ctx.push(id.to_owned());
        }

        let mut ctx = vec![];

        match self.query_use_collect_fn(
            &FTQuery::new_with_user("cfg:VedaSystem", "'rdf:type' === 'vdi:ClassIndex'"),
            add_out_element,
            OptAuthorize::NO,
            storage,
            &mut ctx,
        ) {
            Ok(res) => {
                if res.result_code == ResultCode::Ok && res.count > 0 {
                    for id in ctx.iter() {
                        let mut indv = &mut Individual::default();
                        if storage.get_individual(id, &mut indv) {
                            self.index_schema.add_schema_data(&self.onto, indv);
                        }
                    }
                } else {
                    error!("fail load index schema, err={:?}", res.result_code);
                }
            }
            Err(e) => match e {
                XError::Xapian(code) => {
                    error!("fail load index schema, err={} ({})", get_xapian_err_type(code), code);
                }
                XError::Io(e) => {
                    error!("fail load index schema, err={:?}", e);
                }
            },
        }
    }

    fn reopen_dbs(&mut self) -> Result<()> {
        for (_, el) in self.using_dbqp.iter_mut() {
            el.db.reopen()?;
            el.qp.set_database(&mut el.db)?;
        }

        for (_, db) in self.opened_db.iter_mut() {
            db.reopen()?;
        }

        Ok(())
    }

    fn _close_dbs(&mut self) -> Result<()> {
        for (_, el) in self.using_dbqp.iter_mut() {
            el.db.close()?;
        }

        for (_, db) in self.opened_db.iter_mut() {
            db.close()?;
        }

        Ok(())
    }

    fn open_db_if_need(&mut self, db_name: &str) -> Result<()> {
        if !self.opened_db.contains_key(db_name) {
            if let Some(path) = self.db2path.get(db_name) {
                let db = Database::new_with_path(&("./".to_owned() + path), UNKNOWN)?;
                self.opened_db.insert(db_name.to_owned(), db);
            } else {
                return Err(XError::from(Error::new(ErrorKind::Other, "db2path invalid")));
            }
        }
        Ok(())
    }

    fn open_dbqp_if_need(&mut self, db_names: &[String]) -> Result<()> {
        if !self.using_dbqp.contains_key(db_names) {
            for el in db_names {
                self.open_db_if_need(el)?;
            }

            let mut dbqp = DatabaseQueryParser {
                db: Database::new()?,
                qp: QueryParser::new()?,
            };

            for el in db_names {
                self.open_db_if_need(el)?;
                dbqp.add_database(el, &mut self.opened_db)?;
            }

            dbqp.qp.set_max_wildcard_expansion(MAX_WILDCARD_EXPANSION)?;

            self.xapian_stemmer = Stem::new(&self.xapian_lang)?;

            dbqp.qp.set_stemmer(&mut self.xapian_stemmer)?;

            dbqp.qp.set_database(&mut dbqp.db)?;

            self.using_dbqp.insert(db_names.to_vec(), dbqp);
        }
        /*
           committed_op_id = get_info().committed_op_id;
        */
        Ok(())
    }

    fn get_dn_names(&self, tta: &TTA, db_names_str: &str) -> Vec<String> {
        let mut db_names = vec![];

        if db_names_str.is_empty() {
            let mut databases = HashMap::new();
            self.db_names_from_tta(&tta, &mut databases);

            for (key, value) in databases.iter() {
                if !(*value) {
                    if key != "not-indexed" {
                        db_names.push(key.to_owned());
                    }

                    // при автоопределении баз, если находится база deleted, то другие базы исключаются
                    if key == "deleted" {
                        db_names.clear();
                        db_names.push(key.to_owned());
                        break;
                    }
                }
            }
        } else {
            for el in db_names_str.split(',') {
                db_names.push(String::from(el).trim().to_owned());
            }
        }

        if db_names.is_empty() {
            db_names.push("base".to_owned());
        }

        db_names
    }

    fn db_names_from_tta(&self, tta: &TTA, db_names: &mut HashMap<String, bool>) -> String {
        let mut ll = String::default();
        let mut rr = String::default();

        if let Some(l) = &tta.l {
            ll = self.db_names_from_tta(l, db_names)
        };

        if let Some(r) = &tta.r {
            rr = self.db_names_from_tta(r, db_names);
        }

        if !ll.is_empty() && !rr.is_empty() {
            if ll == "rdf:type" {
                let dbn = self.index_schema.get_dbname_of_class(&rr);
                db_names.insert(dbn.to_owned(), false);
            } else if ll == "v-s:deleted" {
                db_names.insert("deleted".to_owned(), false);
            }
        }

        tta.op.to_owned()
    }
}
