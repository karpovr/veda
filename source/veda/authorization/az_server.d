module veda.authorization.az_server;
/**
 * authorization module as service
 */

import core.stdc.stdlib, core.sys.posix.signal, core.sys.posix.unistd, core.runtime, core.thread, core.atomic;
import std.stdio, std.socket, std.conv, std.array, std.outbuffer, std.json, std.string, std.datetime.stopwatch;
import kaleidic.nanomsg.nano, commando, veda.util.properd, veda.core.common.define;
import veda.common.logger, veda.authorization.authorization, veda.authorization.az_lib, veda.common.type, veda.core.common.type, veda.util.queue;

extern (C) ubyte authorize_r(immutable(char) *_uri, immutable(char) *_user_uri, ubyte _request_access, bool _is_check_for_reload,
                             void function(immutable(char) *_trace_acl), void function(immutable(char) *_trace_group), void function(
                                                                                                                                     immutable(char)
                                                                                                                                     *_trace_info));

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

const byte TRACE_ACL   = 1;
const byte TRACE_GROUP = 2;
const byte TRACE_INFO  = 3;

private nothrow string az_prepare(string request, Authorization athrz, Logger log)
{
    try
    {
        OutBuffer trace_acl;
        OutBuffer trace_group;
        OutBuffer trace_info;

        long      response_offset = 0;

        char[]    response = new char[ request.length ];
        byte[ 3 ] order_trace;

        string user_uri;
        //stderr.writefln("request=|%s| len=%d", request, request.length);

        JSONValue jsn;

        try { jsn = parseJSON(request); }
        catch (Throwable tr)
        {
            log.trace("ERR! az_server: fail parse request=%s, err=%s", request, tr.msg);
            return "[\"err:invalid request\"]";
        }

        response[ response_offset++ ] = '[';

        if (jsn.type == JSON_TYPE.ARRAY)
        {
            foreach (idx, el; jsn.array)
            {
                string uri;
                ubyte  request_access;

                if (idx == 0)
                {
                    if (el.type != JSON_TYPE.STRING)
                    {
                        break;
                    }
                    user_uri = el.str;
                }
                else
                {
                    if (idx > 1)
                        response[ response_offset++ ] = ',';
                    response[ response_offset++ ] = '"';
                    if (el.type == JSON_TYPE.ARRAY)
                    {
                        if (el.array.length >= 2 && el.array.length <= 5)
                        {
                            uri = el.array[ 0 ].str;

                            string s_access = el.array[ 1 ].str;
                            ubyte  access;

                            if (el.array.length > 2)
                            {
                                for (int ii = 2; ii < el.array.length; ii++)
                                {
                                    if (el.array[ ii ].str == "TRACE-ACL")
                                    {
                                        order_trace[ ii - 2 ] = TRACE_ACL;
                                        trace_acl             = new OutBuffer();
                                    }
                                    else if (el.array[ ii ].str == "TRACE-GROUP")
                                    {
                                        order_trace[ ii - 2 ] = TRACE_GROUP;
                                        trace_group           = new OutBuffer();
                                    }
                                    else if (el.array[ ii ].str == "TRACE-INFO")
                                    {
                                        order_trace[ ii - 2 ] = TRACE_INFO;
                                        trace_info            = new OutBuffer();
                                    }
                                }
                            }

                            ubyte res = athrz.authorize(uri, user_uri, access_from_pretty_string(
                                                                                                 s_access), true, trace_acl, trace_group,
                                                        trace_info);

                            //stderr.writefln("uri=%s user_uri=%s response_access=%s", uri, user_uri, access_to_pretty_string(res));

                            if (res & Access.can_create)
                                response[ response_offset++ ] = 'C';
                            if (res & Access.can_read)
                                response[ response_offset++ ] = 'R';
                            if (res & Access.can_update)
                                response[ response_offset++ ] = 'U';
                            if (res & Access.can_delete)
                                response[ response_offset++ ] = 'D';
                        }
                        else
                        {
                        }
                    }
                    response[ response_offset++ ] = '"';
                }
            }
        }
        else
        {
            log.trace("ERR! bad request: unknown json");
            return "[\"err:unknown json\"]";
        }

        if (trace_group !is null || trace_acl !is null || trace_info !is null)
        {
            string[] all_res;

            all_res ~= cast(string)response[ 2..response_offset - 1 ];

            foreach (oo; order_trace)
            {
                if (oo > 0)
                {
                    if (oo == TRACE_ACL)
                        all_res ~= trace_acl.toString();
                    else if (oo == TRACE_GROUP)
                        all_res ~= trace_group.toString();
                    else if (oo == TRACE_INFO)
                        all_res ~= trace_info.toString();
                }
            }
            JSONValue jout = JSONValue(all_res);
            string    sout = jout.toString();
            return sout;
        }

        response[ response_offset++ ] = ']';
        response[ response_offset++ ] = 0;
        //stderr.writefln ("response=%s", response);
        return cast(string)response[ 0..response_offset ];
    }
    catch (Throwable tr)
    {
        try{ log.trace("ERR! az_prepare %s", tr.msg); } catch (Throwable tr) {}
        return "[\"err:exception:" ~ tr.msg ~ "\"]";
    }
}

private long   count;
private Logger log;
void main(string[] args)
{
    string bind_url               = null;
    string test_user_url          = null;
    string experimental_authorize = null;

    try
    {
        ArgumentParser.parse(args, (ArgumentSyntax syntax)
                             {
                                 syntax.config.caseSensitive = commando.CaseSensitive.yes;
                                 syntax.option('b', "bind", &bind_url, Required.no,
                                               "Set binding url, example: --bind=tcp://127.0.0.1:22000");
                                 syntax.option('t', "test_user_uri", &test_user_url, Required.no,
                                               "Unload az result for user_uri, example: --test_user_uri=td:RomanKarpov");
                                 syntax.option('a', "authorize_core", &experimental_authorize, Required.no,
                                               "set authorize core, example: --authorize_core=experimental");
                             });
    }
    catch (ArgumentParserException ex)
    {
        stderr.writefln(ex.msg);
        return;
    }

    log = new Logger("veda-core-authorization", "log", "");

    int sock;

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

    Authorization athrz;

    string[ string ] properties;
    properties = readProperties("./veda.properties");

    string authorization_db_type    = properties.as!(string)("authorization_db_type");
    long   authorization_cache_size = properties.as!(long)("authorization_cache_size");
    string authorization_lib        = properties.as!(string)("authorization_lib");

    athrz = new AuthorizationUseLib(log);

    if (test_user_url !is null)
    {
        writefln("UNLOAD AZ RESULT: user_uri=%s", test_user_url);

        auto prepare_batch_queue = new Queue(uris_db_path, "uris-db", Mode.R, log);
        prepare_batch_queue.open();

        if (prepare_batch_queue.is_ready)
        {
            long count          = 0;
            long count_prepared = 0;

            auto prepare_batch_cs = new Consumer(prepare_batch_queue, tmp_path, process_name, Mode.RW, log);
            if (!prepare_batch_cs.open(false))
            {
                writefln("not found uncompleted batch");
            }
            else
            {
                count          = prepare_batch_cs.count_popped;
                count_prepared = prepare_batch_cs.count_popped;
                writefln("found uncompleted batch");
            }

            if (prepare_batch_cs !is null)
            {
                StopWatch sw; sw.start;

                while (true)
                {
                    string data = prepare_batch_cs.pop();
                    if (data is null)
                    {
                        writefln("batch queue is empty, exit");
                        prepare_batch_cs.remove();
                        prepare_batch_cs = null;
                        break;
                    }

                    count++;

                    if (data.indexOf("membership") < 0 && data.indexOf("_d:mondi_position_") < 0 && data.indexOf("_d:mondi_employee_") < 0
                        && data.indexOf("_position") < 0 && data.indexOf("_person") < 0 && data.indexOf("_employee_") < 0
                        && data.indexOf("-r") < 0 && data.indexOf("right") < 0)
                    {
                        if (count % 1000 == 0)
                        {
                            ubyte request_access = 15;

                            ubyte res = 0;

                            res = athrz.authorize(data, test_user_url, request_access, false, null, null, null);

                            count_prepared++;
                            writefln("%d;%d;%s;%s;%s", count, count_prepared, data, access_to_string(request_access), access_to_string(res));
                        }
                    }


                    prepare_batch_cs.commit_and_next(true);
                    //break;
                }

                sw.stop();
                long t = cast(long)sw.peek.total !"seconds";
                writefln("UNLOAD AZ RESULT: total time %d sec, count skipped=%d", t, count - count_prepared);
            }
        }
        else
        {
            writefln("QUEUE %s not ready", uris_db_path);
        }

        writefln("UNLOAD AZ RESULT: EXIT");
        return;
    }


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

                string rep = az_prepare(req, athrz, log);

                nn_freemsg(buf);

                bytes = nn_send(sock, cast(char *)rep, rep.length, 0);
                //stderr.writefln("SENDING (%s) %d bytes", rep, bytes);
            }
        }
        catch (Throwable tr)
        {
            log.trace("ERR! MAIN LOOP", tr.info);
        }
    }
}
