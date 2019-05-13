/**
 * VQL -> xapian
 */

module veda.search.xapian.xapian_vql;

import std.string, std.concurrency, std.stdio, std.datetime, std.conv, std.algorithm, std.regex, std.uni, utf = std.utf;
import dt                                                                                                     = std.datetime.stopwatch;
import veda.bind.xapian_d_header;
import veda.core.util.utils, veda.onto.onto, veda.common.logger;
import veda.search.common.isearch, veda.search.common.vel;
import veda.common.type, veda.core.common.type, veda.core.common.context, veda.core.common.define, veda.core.common.log_msg;


class XapianVQL
{
    private Logger log;
    protected byte err;
    private auto   r_is_uuid = ctRegex!(`^[a-z0-9_-]+:[a-z0-9_-]*$`, "i");

    this(Logger _log)
    {
        log = _log;
    }

    public XapianMultiValueKeyMaker get_sorter(string sort, ref int[ string ] key2slot, bool trace)
    {
        XapianMultiValueKeyMaker sorter;

        if (sort !is null && sort.length > 0)
        {
            sorter = new_MultiValueKeyMaker(&err);
            foreach (field; split(sort, ","))
            {
                bool asc_desc;

                long bp = indexOf(field, '\'');
                long ep = lastIndexOf(field, '\'');
                long dp = lastIndexOf(field, " desc");

                if (ep > bp && ep - bp > 0)
                {
                    string key = field[ bp + 1 .. ep ];

                    if (dp > ep)
                        asc_desc = false;
                    else
                        asc_desc = true;

                    int slot = get_slot(key2slot, key, log);
                    if (slot >= 0)
                    {
                        if (trace)
                            log.trace("sort key=%s, slot=%d", key, slot);
                        sorter.add_value(slot, asc_desc, &err);
                    }
                }
            }
        }
        return sorter;
    }

    enum TokenType
    {
        TEXT,
        NUMBER,
        DATE,
        BOOLEAN
    }

    private TokenType get_token_type(string token, out double value)
    {
        TokenType res = TokenType.TEXT;

        //log.trace ("token=[%s]", token);

        token = token.strip();

        if (token == "true")
        {
            value = 1;
            return TokenType.BOOLEAN;
        }
        else if (token == "false")
        {
            value = 0;
            return TokenType.BOOLEAN;
        }
        else if (token.length == 19 && token[ 4 ] == '-' && token[ 7 ] == '-' && token[ 10 ] == 'T' && token[ 13 ] == ':' && token[ 16 ] == ':')
        {
            value = stdTimeToUnixTime(SysTime.fromISOExtString(token).stdTime);
            return TokenType.DATE;
        }
        else if (token.length == 24 && token[ 4 ] == '-' && token[ 7 ] == '-' && token[ 10 ] == 'T' && token[ 13 ] == ':' && token[ 16 ] ==
                 ':' && token[ 19 ] == '.')
        {
            value = stdTimeToUnixTime(SysTime.fromISOExtString(token).stdTime);
            return TokenType.DATE;
        }
        else
        {
            bool is_digit = false;
            try
            {
                string tt = token.dup;
                value = parse!double (tt);
                return TokenType.NUMBER;
            }
            catch (Exception ex)
            {
            }
        }

        return res;
    }

    public string transform_vql_to_xapian(Context ctx, TTA tta, string p_op, out string l_token, out string op, out XapianQuery query,
                                          ref int[ string ] key2slot, out double _rd, int level, XapianQueryParser qp, bool trace)
    {
        //log.trace ("tta in= %s", tta);
        prepare_subproperties(ctx, tta);
        //log.trace ("tta out= %s", tta);
        return _transform_vql_to_xapian(ctx, tta, p_op, l_token, op, query, key2slot, _rd, level, qp, trace);
    }

    private void prepare_subproperties(Context ctx, TTA tta)
    {
        string ls;
        string rs;

        if (tta.L !is null)
        {
            if (tta.L.token_decor == Decor.RANGE)
            {
                string el = tta.L.op;
                if (el[ 0 ] == '\'' && el.length > 2 && el[ $ - 1 ] == '\'')
                    el = el[ 1..$ - 1 ];

                Names subproperties = ctx.get_onto().get_sub_properies(el);
                //log.trace("@0, subroperties of [%s]=%s", el, subproperties);

                TTA    tmpR   = tta.R;
                string tmp_op = tta.op;

                // L1, L2, L3
                // (L == R || (L1 == R || (L2 == R || L3 == R)))
                //
                TTA curL  = new TTA(tmp_op, new TTA(el, null, null), tmpR);
                TTA nextR = new TTA("||", null, null);
                tta.L  = curL;
                tta.R  = nextR;
                tta.op = "||";
                //log.trace ("#1 tta=%s", tta);

                int idx = 0;
                foreach (key, value; subproperties)
                {
                    //log.trace ("#2 nextR=%s", nextR);
                    //log.trace ("key=%s", key);
                    curL = new TTA(tmp_op, new TTA(key, null, null), tmpR);

                    idx++;
                    if (idx < subproperties.length)
                    {
                        nextR.L = curL;
                        nextR.R = new TTA("||", null, null);
                        nextR   = nextR.R;
                    }
                    else
                    {
                        nextR.op = curL.op;
                        nextR.L  = curL.L;
                        nextR.R  = curL.R;
                    }

                    //log.trace ("#3 nextR=%s", nextR);
                }
            }

            prepare_subproperties(ctx, tta.L);
        }

        if (tta.R !is null)
            prepare_subproperties(ctx, tta.R);
    }

    private string _transform_vql_to_xapian(Context ctx, TTA tta, string p_op, out string l_token, out string op, out XapianQuery query,
                                            ref int[ string ] key2slot, out double _rd, int level, XapianQueryParser qp, bool trace)
    {
        //if (level == 0)
        //	log.trace ("----------------------------");

        //log.trace ("%d TTA=%s", level, tta);

        try
        {
            if (key2slot.length == 0)
            {
                log.trace("!!! WARN: key2slot is EMPTY, tta=%s", tta);
                return null;
            }

            string      dummy;
            double      rd, ld;
            XapianQuery query_r;
            XapianQuery query_l;

            if (tta.op == ">" || tta.op == "<")
            {
                if (tta.L is null || tta.R is null)
                {
                    log.trace("_transform_vql_to_xapian, invalid tta=[%s]", tta);
                    throw new XapianError(err, "invalid tta=" ~ text(tta));
                }

                string    ls = _transform_vql_to_xapian(ctx, tta.L, tta.op, dummy, dummy, query_l, key2slot, ld, level + 1, qp, trace);
                string    rs = _transform_vql_to_xapian(ctx, tta.R, tta.op, dummy, dummy, query_r, key2slot, rd, level + 1, qp, trace);

                double    value;
                TokenType rs_type = get_token_type(rs, value);
                if (rs_type == TokenType.DATE || rs_type == TokenType.NUMBER)
                {
                    l_token = ls;
                    op      = tta.op;
                    _rd     = value;
                    //writeln("@p RS=", rs);
                    //writeln("@p _rd=", _rd);
                    return rs;
                }
            }
            else if (tta.op == "==" || tta.op == "!=" || tta.op == "===")
            {
                bool is_strict_equality = false;
                if (tta.op == "===")
                {
                    is_strict_equality = true;
                    tta.op             = "==";
                }

                if (tta.L is null || tta.R is null)
                {
                    log.trace("_transform_vql_to_xapian, invalid tta=[%s]", tta);
                    throw new XapianError(err, "invalid tta=" ~ text(tta));
                }

                string ls = _transform_vql_to_xapian(ctx, tta.L, tta.op, dummy, dummy, query_l, key2slot, ld, level + 1, qp, trace);
                string rs = _transform_vql_to_xapian(ctx, tta.R, tta.op, dummy, dummy, query_r, key2slot, rd, level + 1, qp, trace);

                //log.trace("%d query_l=%s", level, query_l);
                //log.trace("%d query_r=%s", level, query_r);
                //log.trace("%d ls=%s", level, ls);
                //log.trace("%d rs=%s", level, rs);

                if (!is_strict_equality && rs.indexOf(':') > 0)
                {
                    Names subclasses = ctx.get_onto().get_sub_classes(rs);

                    if (subclasses.length > 0)
                    {
                        foreach (classz; subclasses.keys)
                            rs ~= " OR " ~ classz;

                        rs = to_lower_and_replace_delimeters(rs);
                    }
                }

                if (query_l is null && query_r is null)
                {
                    string xtr;
                    if (ls != "*")
                    {
                        if (ls == "@")
                        {
                            feature_flag flags = feature_flag.FLAG_DEFAULT | feature_flag.FLAG_WILDCARD;

                            string       query_str = "uid_" ~ to_lower_and_replace_delimeters(rs);

                            if (tta.op == "!=")
                            {
                                flags     = flags | feature_flag.FLAG_PURE_NOT;
                                query_str = "NOT " ~ query_str;
                            }

                            query = qp.parse_query(cast(char *)query_str, query_str.length, flags, &err);

                            if (err == XapianQueryParserError)
                            {
                                log.trace("WARN: The search query has been changed: [%s]->[\"%s\"]", query_str, query_str);
                                query_str = "\"" ~ query_str ~ "\"";
                                query     = qp.parse_query(cast(char *)query_str, query_str.length, flags, &err);
                            }

                            if (err != 0)
                                throw new XapianError(err, "parse_query1 query=" ~ query_str);
                        }
                        else
                        {
                            int slot;
                            if (rs !is null && rs[ 0 ] == '*' && is_good_token(rs))
                                slot = get_slot(key2slot, ls ~ "#F", log);
                            else
                                slot = get_slot(key2slot, ls, log);

                            //log.trace("@p slot=%d, predicate=%s", slot, ls);

                            if (slot > 0)
                            {
                                double    value;
                                TokenType rs_type = get_token_type(rs, value);
                                if (rs_type == TokenType.BOOLEAN)
                                {
                                    xtr = "X" ~ text(slot) ~ "D";
                                    string query_str = "F";
                                    if (value == 1)
                                        query_str = "T";
                                    feature_flag flags = feature_flag.FLAG_DEFAULT | feature_flag.FLAG_PHRASE |
                                                         feature_flag.FLAG_LOVEHATE;

                                    query = qp.parse_query(cast(char *)query_str, query_str.length, flags, cast(char *)xtr,
                                                           xtr.length, &err);

                                    if (err == XapianQueryParserError)
                                    {
                                        log.trace("WARN: The search query has been changed: [%s]->[\"%s\"]", query_str, query_str);

                                        query_str = "\"" ~ query_str ~ "\"";
                                        query     = qp.parse_query(cast(char *)query_str, query_str.length, flags, cast(char *)xtr,
                                                                   xtr.length, &err);
                                    }


                                    if (query is null)
                                        throw new XapianError(err, "parse_query '" ~ tta.toString() ~ "'");

                                    if (err != 0)
                                        throw new XapianError(err, "parse_query1.1 query=" ~ query_str);
                                }
                                else
                                {
                                    if (tta.R.token_decor == Decor.QUOTED || (indexOf(rs, '*') >= 0 && is_good_token(rs)))
                                    {
                                        if ((indexOf(rs, '*') >= 0) && (rs[ 0 ] == '+' && !is_good_token(rs)))
                                        {
                                            rs = replaceAll(rs, regex(r"[*]", "g"), "");
                                        }

                                        char[] query_str = rs.dup;
                                        if (rs[ 0 ] == '*')
                                            reverse(query_str);

                                        if (!matchFirst(query_str, r_is_uuid).empty)
                                            query_str = cast(char[]) to_lower_and_replace_delimeters(cast(string)query_str);

                                        xtr = "X" ~ text(slot) ~ "X";

                                        feature_flag flags = feature_flag.FLAG_DEFAULT | feature_flag.FLAG_WILDCARD | feature_flag.FLAG_PHRASE |
                                                             feature_flag.FLAG_LOVEHATE;
                                        if (tta.op == "!=")
                                        {
                                            /*	TODO
                                             *  вероятно получаются не оптимальными запросы вида
                                             *  '*' == 'rdf' && '*' != 'List*'
                                             *  @query=Xapian::Query((rdf:(pos=1) AND (<alldocuments> AND_NOT (list:(pos=1) SYNONYM lists:(pos=1)))))
                                             */
                                            flags     = flags | feature_flag.FLAG_PURE_NOT;
                                            query_str = "NOT " ~ query_str;
                                        }

                                        query = qp.parse_query(cast(char *)query_str, query_str.length, flags, cast(char *)xtr,
                                                               xtr.length, &err);

                                        if (err == XapianQueryParserError)
                                        {
                                            log.trace("WARN: The search query has been changed: [%s]->[\"%s\"]", query_str, query_str);

                                            query_str = "\"" ~ query_str ~ "\"";
                                            query     = qp.parse_query(cast(char *)query_str, query_str.length, flags, cast(char *)xtr,
                                                                       xtr.length, &err);
                                        }

                                        if (err != 0)
                                            throw new XapianError(err,
                                                                  cast(string)("parse_query2('x'=*) query='" ~ query_str ~ "', xtr='" ~ xtr ~ "'"));
                                    }
                                    else
                                    {
                                        if (tta.R.token_decor == Decor.RANGE)
                                        {
                                            string[] vals = rs.split(",");
                                            if (vals.length == 2)
                                            {
                                                double    c_from, c_to;

                                                TokenType tt = get_token_type(vals[ 0 ], c_from);
                                                if (tt == TokenType.DATE || tt == TokenType.NUMBER)
                                                {
                                                    tt = get_token_type(vals[ 1 ], c_to);
                                                    if (tt == TokenType.DATE || tt == TokenType.NUMBER)
                                                    {
                                                        query = new_Query_range(xapian_op.OP_VALUE_RANGE, slot, c_from, c_to, &err);
                                                        if (query is null)
                                                            throw new XapianError(err, "parse_query '" ~ tta.toString() ~ "'");
                                                    }
                                                }
                                            }
                                            else if (vals.length == 1)
                                            {
                                                string el = rs;
                                                if (el[ 0 ] == '\'' && el.length > 2 && el[ $ - 1 ] == '\'')
                                                    el = el[ 1..$ - 1 ];

                                                string query_str = el;
                                                xtr = "X" ~ text(slot) ~ "X";

                                                if (!is_strict_equality && rs.indexOf(':') > 0)
                                                {
                                                    Names subclasses = ctx.get_onto().get_sub_classes(el);
                                                    foreach (classz; subclasses.keys)
                                                        query_str ~= " OR " ~ classz;
                                                }

                                                feature_flag flags = feature_flag.FLAG_DEFAULT | feature_flag.FLAG_WILDCARD |
                                                                     feature_flag.FLAG_PHRASE |
                                                                     feature_flag.FLAG_LOVEHATE;

                                                query = qp.parse_query(cast(char *)query_str, query_str.length, flags, cast(char *)xtr,
                                                                       xtr.length, &err);

                                                if (err == XapianQueryParserError)
                                                {
                                                    log.trace("WARN: The search query has been changed: [%s]->[\"%s\"]", query_str, query_str);

                                                    query_str = "\"" ~ query_str ~ "\"";
                                                    query     = qp.parse_query(cast(char *)query_str, query_str.length, flags, cast(char *)xtr,
                                                                               xtr.length, &err);
                                                }

                                                if (err != 0)
                                                    throw new XapianError(err,
                                                                          cast(string)("parse_query2.1('x'=*) query='" ~ query_str ~ "', xtr='" ~ xtr
                                                                                       ~ "'"));

                                                log.trace("_transform_vql_to_xapian: query_str=[%s], query=|%s|", query_str,
                                                          get_query_description(query));
                                            }
                                        }
                                        else
                                        {
                                            double d_val;

                                            try
                                            {
                                                d_val = parse!double (rs);
                                            }
                                            catch (Exception ex)
                                            {
                                                writeln("Ex!: ", __FUNCTION__, ":", text(__LINE__), ", ", ex.msg ~ " [", rs, "]");
                                            }


                                            char *str_val;
                                            uint *str_val_length;
                                            sortable_serialise(d_val, &str_val, &str_val_length, &err);

                                            uint   len = *str_val_length;

                                            string tt = cast(string)str_val[ 0..len ];
                                            //writeln("@ length=", len, ", tt=", tt, ", d_val=", d_val);
                                            xtr   = "X" ~ text(slot) ~ "X" ~ tt;
                                            query = new_Query(cast(char *)xtr, cast(uint)xtr.length, &err);
                                            if (query is null)
                                                throw new XapianError(err, "parse_query '" ~ tta.toString() ~ "'");
                                        }

                                        if (err != 0)
                                            log.trace("XAPIAN:_transform_vql_to_xapian:parse_query3 ('x'=x) [%s], err=%s", xtr,
                                                      get_xapian_err_msg(err));
                                    }
                                }
                            }
                        }
                    }
                    else
                    {
                        if (!matchFirst(rs, r_is_uuid).empty)
                            xtr = to_lower_and_replace_delimeters(rs);
                        else
                            xtr = rs.dup;

                        if (indexOf(xtr, '*') > 0 && is_good_token(xtr))
                        {
                            feature_flag flags = feature_flag.FLAG_DEFAULT | feature_flag.FLAG_WILDCARD | feature_flag.FLAG_PHRASE;
                            if (tta.op == "!=")
                            {
                                //	TODO
                                //	вероятно получаются не оптимальны запросы вида
                                //	'*' == 'rdf' && '*' != 'List*'
                                //	@query=Xapian::Query((rdf:(pos=1) AND (<alldocuments> AND_NOT (list:(pos=1) SYNONYM lists:(pos=1)))))
                                //

                                flags = flags | feature_flag.FLAG_PURE_NOT;
                                xtr   = "NOT " ~ xtr;
                            }

                            query = qp.parse_query(cast(char *)xtr, xtr.length, flags, &err);

                            if (err == XapianQueryParserError)
                            {
                                log.trace("WARN: The search query has been changed: [%s]->[\"%s\"]", xtr, xtr);
                                xtr   = "\"" ~ xtr ~ "\"";
                                query = qp.parse_query(cast(char *)xtr, xtr.length, flags, &err);
                            }

                            if (err != 0)
                            {
                                throw new XapianError(err, "parse_query4('*'=*) '" ~ xtr ~ "'");
                            }
                        }
                        else
                        {
                            query = qp.parse_query(cast(char *)xtr, xtr.length, &err);

                            if (err == XapianQueryParserError)
                            {
                                log.trace("WARN: The search query has been changed: [%s]->[\"%s\"]", xtr, xtr);
                                xtr = "\"" ~ xtr ~ "\"";
                                query
                                    = qp.parse_query(cast(char *)xtr, xtr.length, &err);
                            }
                            if (err != 0)
                                throw new XapianError(err, "parse_query5('*'=x) '" ~ xtr ~ "'");
                        }
                    }
                }

                if (query_l !is null)
                    destroy_Query(query_l);
                if (query_r !is null)
                    destroy_Query(query_r);
            }
            else if (tta.op == "&&")
            {
                //writeln("#3.0 &&, p_op=", p_op);
                string t_op_l;
                string t_op_r;
                string token_L;

                string tta_R;
                if (tta.R !is null)
                    tta_R = _transform_vql_to_xapian(ctx, tta.R, tta.op, token_L, t_op_r, query_r, key2slot, rd, level + 1, qp, trace);

                if (t_op_r !is null)
                    op = t_op_r;

                string tta_L;
                if (tta.L !is null)
                    tta_L = _transform_vql_to_xapian(ctx, tta.L, tta.op, dummy, t_op_l, query_l, key2slot, ld, level + 1, qp, trace);

                if (t_op_l !is null)
                    op = t_op_l;

                //writeln("@p && token_L=", token_L);
                //writeln("@p query_l=", get_query_description(query_l));
                //writeln("@p query_r=", get_query_description(query_r));


                if (token_L !is null && tta_L !is null)
                {
                    //writeln("@p #E0.1 &&");
                    // это range
                    //writeln("@p token_L=", token_L);
                    //writeln("@p tta_R=", tta_R);
                    //writeln("@p tta_L=", tta_L);
                    //writeln("@p t_op_l=", t_op_l);
                    //writeln("@p t_op_r=", t_op_r);

                    double c_to, c_from;

                    if (t_op_r == ">")
                        c_from = rd;
                    if (t_op_r == "<")
                        c_to = rd;

                    if (t_op_l == ">")
                        c_from = ld;
                    if (t_op_l == "<")
                        c_to = ld;

                    //writeln("@p c_from=", c_from);
                    //writeln("@p c_to=", c_to);

                    int slot = get_slot(key2slot, token_L, log);

                    query_r = new_Query_range(xapian_op.OP_VALUE_RANGE, slot, c_from, c_to, &err);

                    if (query_l is null)
                    {
                        query   = query_r;
                        query_r = null;
                    }
                    else
                    {
                        if (query_r !is null)
                            query = query_l.add_right_query(xapian_op.OP_AND, query_r, &err);
                    }

                    if (query is null)
                        throw new XapianError(err, "parse_query '" ~ tta.toString() ~ "'");

                    if (query_r !is null)
                        destroy_Query(query_r);

                    if (query_l !is null)
                        destroy_Query(query_l);
                }
                else
                {
                    //writeln("#E0.2 &&");
                    if (query_r !is null)
                    {
                        //writeln("#E0.2 && query_l=", get_query_description(query_l));
                        //writeln("#E0.2 && query_r=", get_query_description(query_r));
                        if (query_l is null)
                        {
                            query   = query_r;
                            query_r = null;
                        }
                        else
                        {
                            if (query_r !is null)
                                query = query_l.add_right_query(xapian_op.OP_AND, query_r, &err);
                        }

                        if (query is null)
                            throw new XapianError(err, "parse_query '" ~ tta.toString() ~ "'");
                        //writeln("#3.1 && query=", get_query_description(query));
                    }
                    else
                    {
                        query   = query_l;
                        query_l = null;
                    }
                    if (query_r !is null)
                        destroy_Query(query_r);

                    if (query_l !is null)
                        destroy_Query(query_l);
                }

                if (tta_R !is null && tta_L is null)
                {
                    _rd = rd;
                    return tta_R;
                }

                if (tta_L !is null && tta_R is null)
                {
                    _rd = ld;
                    return tta_L;
                }
            }
            else if (tta.op == "||")
            {
                if (tta.R !is null)
                    _transform_vql_to_xapian(ctx, tta.R, tta.op, dummy, dummy, query_r, key2slot, rd, level + 1, qp, trace);

                if (tta.L !is null)
                    _transform_vql_to_xapian(ctx, tta.L, tta.op, dummy, dummy, query_l, key2slot, ld, level + 1, qp, trace);

                if (query_l !is null)
                {
                    if (query_r !is null)
                        query = query_l.add_right_query(xapian_op.OP_OR, query_r, &err);
                }

                if (query is null)
                    throw new XapianError(err, "parse_query '" ~ tta.toString() ~ "'");

                if (query_r !is null)
                    destroy_Query(query_r);

                if (query_l !is null)
                    destroy_Query(query_l);
            }
            else
            {
//		query = new_Query_equal (xapian_op.OP_FILTER, int slot, cast(char*)tta.op, tta.op.length);
                //writeln("#5 tta.op=", tta.op);
                return tta.op;
            }
            //log.trace ("%d return, tta=%s, query=%s", level, tta, get_query_description(query));
            return null;
        }
        catch (Throwable tr)
        {
            log.trace("EX: _transform_vql_to_xapian, tta=[%s], err=[%s \n%s]", tta, tr.msg, tr.info);
            throw tr;
            //return null;
        }
    }

    public SearchResult exec_xapian_query_and_queue_authorize(string user_uri,
                                                              XapianEnquire xapian_enquire,
                                                              int from,
                                                              int top,
                                                              int limit,
                                                              void delegate(string uri) add_out_element,
                                                              Context context,
                                                              bool trace, OptAuthorize op_auth
                                                              )
    {
        dt.StopWatch sw;

        sw.start;

        SearchResult sr;

        if (top == 0)
            top = 10000;

        if (limit == 0)
            limit = 10000;

        int          read_count = 0;

        dt.StopWatch sw_az;

        byte         err;

        if (user_uri is null)
        {
            log.trace("exec_xapian_query_and_queue_authorize:user_uri is null");
            sr.result_code = ResultCode.TicketNotFound;
            sw.stop;
            sr.total_time = sw.peek.total !"msecs";
            return sr;
        }

        //writeln (cast(void*)xapian_enquire, " count_authorize=", count_authorize);

        XapianMSet matches = xapian_enquire.get_mset(from, limit, &err);
        if (err < 0)
        {
            log.trace("exec_xapian_query_and_queue_authorize:get_mset, err=(%s)", get_xapian_err_msg(err));

            if (err == -1)
                sr.result_code = ResultCode.DatabaseModifiedError;
            else
                sr.result_code = ResultCode.InternalServerError;

            //            sr.err         = err;
            sw.stop;
            sr.total_time = sw.peek.total !"msecs";
            return sr;
        }

        int processed = 0;

        if (matches !is null)
        {
            sr.estimated = matches.get_matches_estimated(&err);

            XapianMSetIterator it = matches.iterator(&err);

            bool               acl_db_reopen = true;

            while (it.is_next(&err) == true)
            {
                if (err < 0)
                {
                    if (err == -1)
                        break;
                    else
                        sr.result_code = ResultCode.InternalServerError;

                    log.trace("exec_xapian_query_and_queue_authorize:mset:is_next, err=(%s), user_uri=%s", get_xapian_err_msg(err), user_uri);
//                    sr.err = err;
                    sw.stop;
                    sr.total_time = sw.peek.total !"msecs";

                    destroy_MSetIterator(it);
                    destroy_MSet(matches);

                    return sr;
                }

                char *data_str;
                uint *data_len;
                it.get_document_data(&data_str, &data_len, &err);
                if (err < 0)
                {
                    if (err == -1)
                        break;
                    else
                        sr.result_code = ResultCode.InternalServerError;

                    log.trace("exec_xapian_query_and_queue_authorize:get_document_data, err=(%s), user_uri=%s", get_xapian_err_msg(err), user_uri);
//                    sr.err = err;
                    sw.stop;
                    sr.total_time = sw.peek.total !"msecs";

                    destroy_MSetIterator(it);
                    destroy_MSet(matches);

                    return sr;
                }

                processed++;

                string subject_id = data_str[ 0..*data_len ].idup;

                if (trace)
                    log.trace("found subject_id:[%s]", subject_id);

                bool is_passed = true;

                if (op_auth == OptAuthorize.YES)
                {
                    sw_az.start;
                    is_passed = context.get_az().authorize(subject_id, user_uri, Access.can_read, acl_db_reopen);
                    sw_az.stop;
                }

                if (is_passed)
                {
                    //log.trace("found subject_id:[%s] authorized", subject_id);

                    add_out_element(subject_id);
                    read_count++;
                    if (read_count >= top)
                        break;
                }
                else
                {
                    if (trace)
                        log.trace("subject_id:[%s] not authorized, user_uri=[%s]", subject_id, user_uri);
                }

                acl_db_reopen = false;

                auto authorize_time = sw_az.peek.total !"msecs";

                if (authorize_time > 5000)
                {
                    log.trace("WARN! authorization time > 5 s, break iterator loop, user_uri=[%s]", user_uri);
                    break;
                }

                it.next(&err);
            }

            destroy_MSetIterator(it);
            destroy_MSet(matches);
        }

        sr.processed   = processed;
        sr.count       = read_count;
        sr.result_code = ResultCode.Ok;
        sr.cursor      = from + processed;
        sw.stop;
        sr.total_time     = sw.peek.total !"msecs";
        sr.authorize_time = sw_az.peek.total !"msecs";
        sr.query_time     = sr.total_time - sr.authorize_time;

        return sr;
    }

    string get_query_description(XapianQuery query)
    {
        if (query !is null)
        {
            char *descr_str;
            uint *descr_len;
            query.get_description(&descr_str, &descr_len, &err);
            if (descr_len !is null && *descr_len > 0)
            {
                string str = cast(immutable)descr_str[ 0..*descr_len ].dup;
                writeln("QUERY:", str);
                return str;
            }
            else
                return "no content";
        }
        return "NULL";
    }

    bool is_good_token(string str)
    {
        int  count_alpha  = 0;
        int  count_number = 0;
        long count        = utf.count(str);

        for (size_t idx; idx < count; idx)
        {
            dchar dd = utf.decode(str, idx);
            if (isAlpha(dd))
                count_alpha++;
            if (isNumber(dd))
                count_number++;
        }

        //log.trace ("@get_count_alpha, str=[%s], count_alpha=[%d]", str, count_alpha);

        if (count_alpha + count_number < 3)
            return false;

        if (count_alpha + count_number < 4 && count_number == 3)
            return false;

        return true;
    }
}
