/**
 *     XAPIAN READER
 */

module veda.search.xapian.xapian_reader;

import std.concurrency, std.outbuffer, std.datetime, std.conv, std.typecons, std.stdio, std.string, std.file, std.container.slist;
import veda.bind.xapian_d_header;
import veda.core.util.utils, veda.core.common.define, veda.core.common.type, veda.core.common.context, veda.common.type;
import veda.core.common.log_msg, veda.common.logger;
import veda.search.common.isearch, veda.search.common.vel, veda.search.common.indexer_property, veda.search.xapian.xapian_vql, veda.util.module_info;

protected byte err;

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface SearchReader
{
    public SearchResult query(string user_uri, string str_query, string str_sort, string db_names, int from, int top, int limit,
                              void delegate(string uri) add_out_element, OptAuthorize op_auth, bool trace);

    public void reopen_dbs();
}

class Database_QueryParser
{
    XapianDatabase    db;
    XapianQueryParser qp;
}


class XapianReader : SearchReader
{
    XapianVQL               xpnvql;
    Logger                  log;
    private                 Database_QueryParser[ string[] ]      using_dbqp;

    private                 XapianDatabase[ string ]              opened_db;

    private XapianStem      xapian_stemmer;
    private string          xapian_lang = "russian";
    private XapianEnquire   xapian_enquire;

    private Context         context;
    private IndexerProperty iproperty;
    ModuleInfoFile          mdif;

    this(Context _context)
    {
        context   = _context;
        xpnvql    = new XapianVQL(context.get_logger());
        log       = context.get_logger();
        iproperty = new IndexerProperty(context);
    }

    private MInfo get_info()
    {
        if (mdif is null)
        {
            mdif = new ModuleInfoFile(text(MODULE.fulltext_indexer), log, OPEN_MODE.READER);
        }
        MInfo info = mdif.get_info();
        return info;
    }

    private string dummy;
    private double d_dummy;

    string getDatabasesOfClass(TTA tta, ref bool[ string ] databasenames, IndexerProperty iproperty)
    {
        if (tta is null)
            return null;

        string ll = getDatabasesOfClass(tta.L, databasenames, iproperty);
        string rr = getDatabasesOfClass(tta.R, databasenames, iproperty);

        if (ll !is null && rr !is null)
        {
            if (ll == "rdf:type")
            {
                string dbn = iproperty.get_dbname_of_class(rr);
                databasenames[ dbn ] = false;
            }
            else if (ll == "v-s:deleted")
            {
                databasenames[ "deleted" ] = false;
            }
        }

        return tta.op;
    }

    private File   *ff_key2slot_r = null;
    private long   last_size_key2slot;
    private int[ string ] old_key2slot;
    private string file_name_key2slot;

    private int[ string ] read_key2slot()
    {
        int[ string ] key2slot;

        if (ff_key2slot_r is null)
        {
            file_name_key2slot = xapian_info_path ~ "/key2slot";
            try
            {
                ff_key2slot_r = new File(file_name_key2slot, "r");
            }
            catch (Exception ex) {}
        }

        if (ff_key2slot_r !is null)
        {
            long cur_size = getSize(file_name_key2slot);

            if (cur_size > last_size_key2slot)
            {
                last_size_key2slot = cur_size;
                ff_key2slot_r.seek(0);
                auto       buf = ff_key2slot_r.rawRead(new char[ cur_size + 128 ]);
                ResultCode rc;
                key2slot     = deserialize_key2slot(cast(string)buf, rc);
                old_key2slot = key2slot;
            }
            else
            {
                return old_key2slot;
            }
//            writeln("@context:read_key2slot:key2slot", key2slot);
        }
        return key2slot;
    }

    public SearchResult query(string user_uri, string str_query, string str_sort, string _db_names, int from, int top, int limit,
                              void delegate(string uri) add_out_element, OptAuthorize op_auth, bool trace)
    {
        SearchResult sr;

        if (str_query.length > 0)
        {
            if (str_query[ 0 ] == '@')
            {
                str_query = str_query[ 0..$ ];
                trace     = true;
            }
        }

        int[ string ] key2slot = read_key2slot();

        if (key2slot == (int[ string ]).init)
            return sr;

        //log.trace ("@key2slot=%s", key2slot);

        XapianQuery query;
        TTA         tta = parse_expr(str_query);

        if (tta is null)
        {
            log.trace("fail parse query (phase 1) [%s], tta is null", str_query);
            sr.result_code = ResultCode.BadRequest;
            return sr;
        }

        if (tta.L !is null && tta.L.op == "emulateError" && tta.R !is null && tta.R.op !is null)
        {
            try
            {
                int errcode = to!int (tta.R.op);

                sr.result_code = cast(ResultCode)errcode;

                log.trace("WARN! request emulate error code = [%s]", text(sr.result_code));

                return sr;
            }
            catch (Exception ex)
            {
            }
        }

        string[] db_names;

        if (_db_names is null || _db_names.length == 0)
        {
            // если не указанны базы данных, то попробуем определить их из текста запроса
            if (op_auth == OptAuthorize.YES)
                iproperty.load();

            bool[ string ] databasenames = iproperty.get_dbnames();

            getDatabasesOfClass(tta, databasenames, iproperty);

            foreach (key, value; databasenames)
            {
                if (value == false)
                {
                    if (key != "not-indexed")
                        db_names ~= key;

                    // при автоопределении баз, если находится база deleted, то другие базы исключаются
                    if (key == "deleted")
                    {
                        db_names = [ key ];
                        break;
                    }
                }
            }
        }
        else
        {
            db_names = split(_db_names, ',');
            int idx = 0;
            foreach (el; db_names)
            {
                if (el[ 0 ] == ' ' || el[ $ - 1 ] == ' ')
                {
                    auto dbn = strip(el);
                    if (dbn != "not-indexed")
                        db_names[ idx ] = strip(el);
                }
                idx++;
            }
        }

        if (db_names.length == 0)
            db_names = [ "base" ];

        if (trace)
            log.trace("[Q:%X] user_uri=[%s] query=[%s] str_sort=[%s], db_names=[%s], from=[%d], top=[%d], limit=[%d]", cast(void *)str_query,
                      user_uri, str_query,
                      str_sort, _db_names, from, top,
                      limit);

        if (trace)
            log.trace("[Q:%X] TTA [%s]", cast(void *)str_query, tta.toString());

        long cur_committed_op_id = get_info().committed_op_id;
        if (cur_committed_op_id > committed_op_id)
        {
            //log.trace("search:reopen_db: cur_committed_op_id(%d) > committed_op_id(%d)", cur_committed_op_id, committed_op_id);
            reopen_dbs();
        }
        else
        {
            //log.trace ("search:check reopen_db: cur_committed_op_id=%d, committed_op_id=%d", cur_committed_op_id, committed_op_id);
        }

        Database_QueryParser db_qp = get_dbqp(db_names);

        int                  state         = -1;
        int                  attempt_count = 1;

        while (state < 0)
        {
            try
            {
                xpnvql.transform_vql_to_xapian(context, tta, "", dummy, dummy, query, key2slot, d_dummy, 0, db_qp.qp, trace);
                state = 0;
            }
            catch (XapianError ex)
            {
                log.trace("ERR! fail parse query (phase 2) [%s], err:[%s]", str_query, ex.msg);
                state = ex.code;
            }
            catch (Throwable tr)
            {
                log.trace("ERR! fail parse query (phase 2) [%s], err:[%s]", str_query, tr.msg);
                sr.result_code = ResultCode.BadRequest;
                return sr;
            }

            if (state < 0)
            {
                attempt_count++;
                if (attempt_count > 2)
                {
                    query = null;

                    break;
                }

                reopen_dbs();
                log.trace("[Q:%X] transform_vql_to_xapian, attempt=%d",
                          cast(void *)str_query,
                          attempt_count);
            }
        }

        if (opened_db.keys.length == 0)
            return sr;

        if (trace == 1)
            log.trace("[Q:%X] xapian query [%s]", cast(void *)str_query, xpnvql.get_query_description(query));

        if (query !is null)
        {
            xapian_enquire = db_qp.db.new_Enquire(&err);

            if (err < 0)
            {
                log.trace("ERR! xapian_reader:get err=%s", get_xapian_err_msg(err));
                sr.result_code = ResultCode.BadRequest;
                return sr;
            }

            XapianMultiValueKeyMaker sorter = xpnvql.get_sorter(str_sort, key2slot, trace);

            xapian_enquire.set_query(query, &err);
            if (sorter !is null)
                xapian_enquire.set_sort_by_key(sorter, true, &err);

            sr = xpnvql.exec_xapian_query_and_queue_authorize(user_uri, xapian_enquire, from, top, limit, add_out_element,
                                                              context, trace, op_auth);

            destroy_Enquire(xapian_enquire);
            destroy_Query(query);
            destroy_MultiValueKeyMaker(sorter);

            if (sr.estimated > limit)
            {
                string str_x_query = tta.toString();
                log.trace("WARN! estimated > limit: %d > %d, time=%d ms, user_uri=%s, query=%s", sr.estimated, limit, sr.total_time, user_uri, str_x_query);
            }

            if (sr.total_time > 5_000)
            {
                log.trace("WARN! xapian::get, total_time (%d ms) > 5 sec, user=%s, query=%s, sr=%s", sr.total_time, user_uri, str_query, sr);
            }

            if (sr.result_code == ResultCode.DatabaseModifiedError)
                reopen_dbs();
            else
            {
                if (sr.result_code != ResultCode.Ok)
                    log.trace("ERR! [Q:%X] exec_xapian_query_and_queue_authorize, query=[%s], err=[%s]", cast(void *)str_query, str_query,
                              sr.result_code);
            }
        }
        else
        {
            sr.result_code = ResultCode.BadRequest;
            log.trace("ERR! fail prepare query [%s]", str_query);
        }

        //log.trace("[Q:%X] query [%s], result.count=%d, result.processed=%d", cast(void *)str_query, str_query, sr.count, sr.processed);

        return sr;
    }

    int max_wildcard_expansion = 20_000;

////////////////////////////////////////////////////////
    long committed_op_id;

    Database_QueryParser get_dbqp(string[] db_names)
    {
        Database_QueryParser dbqp = using_dbqp.get(db_names, null);

        if (dbqp is null)
        {
            dbqp    = new Database_QueryParser();
            dbqp.db = new_Database(&err);

            foreach (el; db_names)
            {
                XapianDatabase _db = open_db(el);
                if (_db !is null)
                {
                    dbqp.db.add_database(_db, &err);
                    if (err != 0)
                        log.trace("xapian_reader:add_database:err=%s", get_xapian_err_msg(err));
                }
                else
                    log.trace("xapian_reader:add_database:db not opened:%s", el);
            }

            dbqp.qp = new_QueryParser(&err);
            if (err != 0)
                log.trace("xapian_reader:new_QueryParser:err=%s", get_xapian_err_msg(err));

            dbqp.qp.set_max_wildcard_expansion(max_wildcard_expansion, &err);
            if (err != 0)
                log.trace("xapian_reader:set_max_wildcard_expansion:err=%s", get_xapian_err_msg(err));

            xapian_stemmer = new_Stem(cast(char *)xapian_lang, cast(uint)xapian_lang.length, &err);
            dbqp.qp.set_stemmer(xapian_stemmer, &err);
            if (err != 0)
                log.trace("xapian_reader:set_stemmer:err=%s", get_xapian_err_msg(err));

            dbqp.qp.set_database(dbqp.db, &err);
            if (err != 0)
                log.trace("xapian_reader:set_database:err=%s", get_xapian_err_msg(err));

            using_dbqp[ db_names.idup ] = dbqp;
        }

        committed_op_id = get_info().committed_op_id;

        return dbqp;
    }

    private XapianDatabase open_db(string db_name)
    {
        byte           err;
        XapianDatabase db;

        db = opened_db.get(db_name, null);

        if (db is null)
        {
            string path = get_xapiab_db_path(db_name);

            if (path !is null)
            {
                db = new_Database(path.ptr, cast(uint)path.length, xapian_db_type, &err);

                if (err < 0)
                    log.trace("ERR! xapian_reader:open_db:new_Database[%s]:err=%s", db_name, get_xapian_err_msg(err));
                else
                    opened_db[ db_name ] = db;
            }
            else
                log.trace("ERR! xapian_reader:open_db: not set db_path to [%s]", db_name);
        }

        if (db is null)
            log.trace("ERR! xapian_reader:open_db: not open db [%s]", db_name);

        return db;
    }

    public void reopen_dbs()
    {
        long cur_committed_op_id = get_info().committed_op_id;

        //log.trace("reopen_db, prev committed_op_id=%d, now committed_op_id=%d", committed_op_id, cur_committed_op_id);

        foreach (el; using_dbqp.values)
        {
            el.db.reopen(&err);
            if (err != 0)
                log.trace("ERR! xapian_reader:reopen_db:err=%s", get_xapian_err_msg(err));

            el.qp.set_database(el.db, &err);
            if (err != 0)
                log.trace("ERR! xapian_reader:set_database:err=%s", get_xapian_err_msg(err));
        }
//        foreach (db; opened_db.values)
//        {
//          db.reopen(&err);
//            if (err != 0)
//                writeln("xapian_reader:reopen_db:err", err);
//        }

        committed_op_id = cur_committed_op_id;
    }

    public bool close_dbs()
    {
        foreach (el; using_dbqp.values)
        {
            el.db.close(&err);
            if (err != 0)
            {
                log.trace("xapian_reader:close database:err=%s", get_xapian_err_msg(err));
                return false;
            }
        }
        foreach (db; opened_db.values)
        {
            db.close(&err);
            if (err != 0)
            {
                log.trace("xapian_reader:close database:err=%s", get_xapian_err_msg(err));
                return false;
            }
        }
        return true;
    }
}

