/**
 * filltext query service
 */

import core.stdc.stdlib, core.sys.posix.signal, core.sys.posix.unistd, core.runtime;
import core.thread, core.atomic;
import kaleidic.nanomsg.nano, commando;
import std.stdio, std.socket, std.conv, std.array, std.outbuffer, std.json;
import veda.common.logger, properd, veda.core.common.context, veda.core.impl.thread_context, veda.common.type, veda.core.common.define;
import veda.onto.resource, veda.onto.lang, veda.onto.individual, veda.core.common.type, veda.core.impl.app_context_creator;
import veda.search.common.isearch, veda.search.xapian.xapian_search, veda.authorization.authorization, veda.authorization.az_lib;

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

private nothrow string req_prepare(string request, Context context)
{
	try {
		SearchResult res;
		Logger log = context.get_logger();
		JSONValue jsn;

		try {
			jsn = parseJSON(request);
		} catch (Throwable tr)                                   {
			log.trace("ERR! ft_query: fail parse request=%s, err=%s", request, tr.msg);
			return "[\"err:invalid request\"]";
		}

		if (jsn.type == JSON_TYPE.ARRAY) {
			if (jsn.array.length == 8) {
				string _ticket    = jsn.array[ 0 ].str;
				string _query     = jsn.array[ 1 ].str;
				string _sort      = jsn.array[ 2 ].str;
				string _databases = jsn.array[ 3 ].str;
				bool _reopen    = false;
				if (jsn.array[ 4 ].type == JSON_TYPE.TRUE)
					_reopen = true;

				int _top   = cast(int) jsn.array[ 5 ].integer;
				int _limit = cast(int) jsn.array[ 6 ].integer;
				int _from  = cast(int) jsn.array[ 7 ].integer;

				string user_uri;

				if (_ticket !is null && _ticket.length > 3) {
					if (_ticket[ 0 ] == 'U' && _ticket[ 1 ] == 'U' && _ticket[ 2 ] == '=') {
						// в данном случае вместо тикета передается id пользователя
						user_uri = _ticket[ 3..$ ];
					} else   {
						Ticket *ticket;
						ticket = context.get_ticket(_ticket, false);
						if (ticket is null) {
							context.get_logger.trace("ERR! ticket not fount: ticket_id = %s", _ticket);
						} else   {
							if (ticket.result != ResultCode.Ok) {
								res.result_code = ticket.result;
							} else {
							
							if (ticket.user_uri is null || ticket.user_uri.length == 0)
								context.get_logger.trace("ERR! ft_query: user not found in ticket object, ticket_id=%s, query=%s", _ticket, _query);
							else
								user_uri = ticket.user_uri;
							}
						}
					}
				} else   {
					user_uri = "cfg:Guest";
				}

				if (user_uri !is null) {
					try {
						if (_reopen) {
							context.reopen_ro_fulltext_indexer_db();

							Individual indv = context.get_individual("cfg:OntoVsn");
							if (indv.getStatus() == ResultCode.Ok) {
								long new_onto_vsn = indv.getFirstInteger("v-s:updateCounter");
								if (new_onto_vsn != onto_vsn) {
									context.onto_load();
									onto_vsn = new_onto_vsn;
								}
							}
						}

						res = context.get_individuals_ids_via_query(user_uri, _query, _sort, _databases, _from, _top, _limit, OptAuthorize.YES, false);
					} catch (Throwable tr)   {
						context.get_logger.trace("ERR! get_individuals_ids_via_query, %s", tr.msg);
						context.get_logger.trace("REQUEST: user=%s, query=%s, sort=%s, databases=%s, from=%d, top=%d, limit=%d", user_uri, _query,
						                         _sort,
						                         _databases, _from, _top,
						                         _limit);
					}
				}

				//context.get_logger.trace("REQUEST: user=%s, query=%s, sort=%s, databases=%s, from=%d, top=%d, limit=%d", user_uri, _query, _sort, _databases, _from, _top, _limit);
			}
		}

		string response = to_json_str(res);

		//context.get_logger.trace("RESPONCE: %s", response);

		return response;
	} catch (Throwable tr)   {
		try {
			log.trace("ERR! ft_query request prepare %s", tr.msg);
		} catch (Throwable tr) {}
		return "ERR";
	}
}

private string to_json_str(SearchResult res)
{
	OutBuffer bb = new OutBuffer();

	bb.write("{\"result\":[");

	foreach (idx, rr; res.result) {
		if (idx > 0)
			bb.write(',');

		bb.write('"');
		bb.write(rr);
		bb.write('"');
	}

	bb.writef("], \"count\":%d,\"estimated\":%d,\"processed\":%d,\"cursor\":%d,\"result_code\":%d}", res.count, res.estimated, res.processed,
	          res.cursor,
	          res.result_code);
	return bb.toString();
}

private Authorization get_acl_client(Logger log)
{
	return new AuthorizationUseLib(log);
}

private long count;
private Logger log;
private long onto_vsn;
private Ticket sticket;

void main(string[] args)
{
	string bind_url = null;

	try {
		ArgumentParser.parse(args, (ArgumentSyntax syntax)
		                     {
		                         syntax.config.caseSensitive = commando.CaseSensitive.yes;
		                         syntax.option('b', "bind", &bind_url, Required.no,
		                                       "Set binding url, example: --bind=tcp://127.0.0.1:23000");
							 });
	} catch (ArgumentParserException ex)   {
		stderr.writefln(ex.msg);
		return;
	}

	if (bind_url is null || bind_url.length < 10) {
		try {
			string[ string ] properties;
			properties = readProperties("./veda.properties");
			bind_url   = properties.as!(string)("ft_query_service_url") ~ "\0";
		} catch (Throwable ex)   {
			log.trace("ERR! unable read ./veda.properties");
			return;
		}
	}

	string[] tpcs      = bind_url.split(":");
	string log_sufix = "";
	if (tpcs.length == 3) {
		log_sufix = tpcs[ 2 ];
	}

	Thread.sleep(dur!("seconds")(1));

	int sock;
	log = new Logger("veda-core-ft-query-" ~ log_sufix, "log", "");

	Context ctx = create_new_ctx("ft-query", log);
	sticket = ctx.sys_ticket();
	ctx.set_az(get_acl_client(log));
	ctx.set_vql(new XapianSearch(ctx));

	Individual indv = ctx.get_individual("cfg:OntoVsn");
	if (indv.getStatus() == ResultCode.Ok)
		onto_vsn = indv.getFirstInteger("v-s:updateCounter");

	sock = nn_socket(AF_SP, NN_REP);
	if (sock < 0) {
		log.trace("ERR! cannot create socket");
		return;
	}
	if (nn_bind(sock, cast(char *) (bind_url ~ "\0")) < 0) {
		log.trace("ERR! cannot bind to socket, url=%s", bind_url);
		return;
	}
	log.trace("success bind to %s", bind_url);

	while (!f_listen_exit) {
		try {
			count++;

			char *buf  = cast(char *) 0;
			int bytes = nn_recv(sock, &buf, NN_MSG, 0);
			if (bytes >= 0) {
				string req = cast(string) buf[ 0..bytes ];
				//stderr.writefln("RECEIVED [%d](%s) cont=%d", bytes, req, count);

				string rep = req_prepare(req, ctx);

				nn_freemsg(buf);

				bytes = nn_send(sock, cast(char *) rep, rep.length, 0);
				//stderr.writefln("SENDING (%s) %d bytes", rep, bytes);
			}
		} catch (Throwable tr)   {
			log.trace("ERR! MAIN LOOP", tr.info);
		}
	}
}

