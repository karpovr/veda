/**
 * storage service
 *      protocol - nanomsg
 *		request: "T,url" - get ticket of url, response: JSON format
 *		request: "I,url" - get individual of url, response: JSON format
 *		request: "t,url" - get ticket of url, response: BINOBJ format
 *		request: "i,url" - get individual of url, response: BINOBJ format
 */

import core.stdc.stdlib, core.sys.posix.signal, core.sys.posix.unistd, core.runtime;
import std.stdio, std.socket, std.conv, std.array, std.outbuffer, std.json;
import kaleidic.nanomsg.nano, commando;
import core.thread, core.atomic;
import veda.common.logger, veda.util.properd;
import veda.storage.lmdb.lmdb_driver, veda.storage.tarantool.tarantool_storage, veda.storage.common, veda.common.type, veda.onto.individual,
       veda.onto.bj8individual.individual8json;

const string individuals_db_path = "./data/lmdb-individuals";
const string tickets_db_path     = "./data/lmdb-tickets";

static this()
{
    bsd_signal(SIGINT, &handleTermination3);
}

bool f_listen_exit = false;

extern (C) void handleTermination3(int _signal)
{
    stderr.writefln("!SYS: caught signal: %s", text(_signal));

    f_listen_exit = true;
}

private nothrow string req_prepare(string request, KeyValueDB tickets_storage_r, KeyValueDB inividuals_storage_r, Logger log)
{
    try
    {
        JSONValue jsn;

        string[]  rel      = request.split(",");
        string    response = "[]";

        if (rel.length > 2)
        {
            string[] filters;
            if (rel.length > 3)
            {
                filters = rel[ 2..$ ];
            }

            Individual indv;
            if (rel[ 0 ] == "T")
            {
                tickets_storage_r.get_individual(rel[ 1 ], indv);
            }
            else if (rel[ 0 ] == "I")
            {
                inividuals_storage_r.get_individual(rel[ 1 ], indv);
            }
            else if (rel[ 0 ] == "t")
            {
                return tickets_storage_r.get_binobj(rel[ 1 ]);
            }
            else if (rel[ 0 ] == "i")
            {
                return inividuals_storage_r.get_binobj(rel[ 1 ]);
            }
            else
            {
                return "{ERR:\"invalid query:" ~ request ~ "\"}";
            }

            if (indv.getStatus() == ResultCode.NotFound)
            {
                return "[]";
            }
            else if (indv.getStatus() == ResultCode.Ok)
            {
                response = individual_to_json(indv, filters).toString();
            }
            else
            {
                return "{ERR:\"fail indv to json:" ~ response ~ "\"}";
            }
        }
        else
        {
            return "{ERR:\"invalid query:" ~ request ~ "\"}";
        }

        return response;
    }
    catch (Throwable tr)
    {
        try { log.trace("ERR! lmdb-srv request prepare %s", tr.msg); } catch (Throwable tr) {}
        return "ERR";
    }
}

private long   count;
private Logger log;

void main(string[] args)
{
    string bind_url      = null;
    string tarantool_url = null;

    try
    {
        ArgumentParser.parse(args, (ArgumentSyntax syntax)
        {
            syntax.config.caseSensitive = commando.CaseSensitive.yes;
            syntax.option('b', "bind", &bind_url, Required.no,
                          "Set binding url, example: --bind=tcp://127.0.0.1:24000");
        });
    }
    catch (ArgumentParserException ex)
    {
        stderr.writefln(ex.msg);
        return;
    }

    if (bind_url is null || bind_url.length < 10)
    {
        try
        {
            string[ string ] properties;
            properties    = readProperties("./veda.properties");
            bind_url      = properties.as!(string)("ro_storage_url") ~ "\0";
            tarantool_url = properties.as!(string)("tarantool_url");
        }
        catch (Throwable ex)
        {
            log.trace("ERR! unable read ./veda.properties");
            return;
        }
    }

    int sock;
    log = new Logger("veda-ro-storage", "log", "");

    KeyValueDB tickets_storage_r;
    KeyValueDB inividuals_storage_r;

    if (tarantool_url is null)
    {
        log.trace("INFO! use LMDB");

        tickets_storage_r    = new LmdbDriver(tickets_db_path, DBMode.R, "tickets", log);
        inividuals_storage_r = new LmdbDriver(individuals_db_path, DBMode.R, "inividuals", log);
    }
    else
    {
        log.trace("INFO! use tarantool");

        TarantoolStorage tts = new TarantoolStorage("ro-storage", log);

        tickets_storage_r    = tts.get_tickets_storage_r();
        inividuals_storage_r = tts.get_inividuals_storage_r();
    }

    sock = nn_socket(AF_SP, NN_REP);
    if (sock < 0)
    {
        log.trace("ERR! cannot create socket");
        return;
    }
    if (nn_bind(sock, cast(char *)(bind_url ~ "\0")) < 0)
    {
        log.trace("ERR! cannot bind to socket, url=%s", bind_url);
        return;
    }
    log.trace("success bind to %s", bind_url);

    while (!f_listen_exit)
    {
        try
        {
            count++;

            char *buf  = cast(char *)0;
            int  bytes = nn_recv(sock, &buf, NN_MSG, 0);
            if (bytes >= 0)
            {
                string req = cast(string)buf[ 0..bytes ];
                //stderr.writefln("RECEIVED [%d](%s) cont=%d", bytes, req, count);

                string rep = req_prepare(req, tickets_storage_r, inividuals_storage_r, log);

                nn_freemsg(buf);

                if (rep is null || rep.length == 0)
                    rep = "\0";

                bytes = nn_send(sock, cast(char *)rep.dup(), rep.length, 0);
                //stderr.writefln("SENDING (%s) %d bytes", rep, bytes);
            }
        }
        catch (Throwable tr)
        {
            log.trace("ERR! MAIN LOOP", tr.info);
        }
    }
}

