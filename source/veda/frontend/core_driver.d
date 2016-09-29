module veda.frontend.core_driver;

import std.stdio, std.datetime, std.conv, std.string, std.variant, std.concurrency;
import vibe.data.json;
import veda.core.srv.server, veda.core.common.context, veda.core.impl.thread_context, veda.core.common.know_predicates, veda.core.common.define;
import veda.type, veda.onto.onto, veda.onto.lang, veda.onto.individual, veda.onto.resource, veda.core.log_msg;
import veda.frontend.cbor8vjson, veda.frontend.individual8vjson;

// ////// logger ///////////////////////////////////////////
import util.logger;
logger _log;
logger log()
{
    if (_log is null)
        _log = new logger("veda-core-" ~ process_name, "pacahon_driver", "DRIVER");
    return _log;
}
// ////// ////// ///////////////////////////////////////////

enum Command
{
    Get     = 1,
    Is      = 2,
    Put     = 3,
    Execute = 4,
    Wait    = 5
}

enum Function
{
    Individual,
    Individuals,
    PropertyOfIndividual,
    IndividualsToQuery,
    IndividualsIdsToQuery,
    NewTicket,
    TicketValid,
    PModule,
    Trace,
    Backup,
    CountIndividuals,
    Rights,
    RightsOrigin
}

public void core_thread(string node_id)
{
    Context                      context;
    string                       thread_name = "veda" ~ text(std.uuid.randomUUID().toHash())[ 0..5 ];

    core.thread.Thread.getThis().name = thread_name;

    context = new PThreadContext(node_id, thread_name, P_MODULE.nop);

    writeln("--- START VEDA STORAGE THREAD LISTENER --- " ~ thread_name);

    immutable(Individual) _empty_iIndividual = (immutable(Individual)).init;
    Resources _empty_Resources = Resources.init;

    while (true)
    {
        receive(
                (Command cmd, Function fn, bool to_binlog, int worker_id, Tid tid)
                {
                    if (tid != Tid.init)
                    {
                        if (cmd == Command.Execute && fn == Function.Backup)
                        {
                            context.backup(to_binlog);
                            send(tid, true, worker_id);
                        }
                    }
                },
                (Command cmd, Function fn, int worker_id, Tid tid)
                {
                    if (tid != Tid.init)
                    {
                        if (cmd == Command.Execute && fn == Function.CountIndividuals)
                        {
                            long count = context.count_individuals();
                            send(tid, count, worker_id);
                        }
                    }
                },
                (Command cmd, Function fn, immutable(string)[] arg1, string arg2, int worker_id, Tid tid)
                {
                    if (tid != Tid.init)
                    {
                        if (cmd == Command.Get && fn == Function.Individuals)
                        {
                            ResultCode rc = ResultCode.Internal_Server_Error;

                            immutable(Json)[] res = Json[].init;
                            try
                            {
                                Ticket *ticket = context.get_ticket(arg2);
                                rc = ticket.result;
                                if (rc == ResultCode.OK)
                                {
                                    foreach (indv; context.get_individuals(ticket, arg1.dup))
                                    {
                                        Json jj = individual_to_json(indv);
                                        res ~= cast(immutable)jj;
                                    }
                                }
                            }
                            catch (Throwable ex) { writeln(ex.msg); }

                            send(tid, res, rc, worker_id);
                        }
                    }
                },
                (Command cmd, Function fn, string query, string sort, string databases, string _ticket, bool reopen, int top, int limit,
                 int worker_id, Tid tid)
                {
                    if (tid != Tid.init)
                    {
                        if (cmd == Command.Get && fn == Function.IndividualsIdsToQuery)
                        {
                            ResultCode rc = ResultCode.Internal_Server_Error;
                            immutable(string)[] res;

                            try
                            {
                                Ticket *ticket = context.get_ticket(_ticket);
                                rc = ticket.result;
                                if (rc == ResultCode.OK)
                                {
                                    if (reopen)
                                        context.reopen_ro_fulltext_indexer_db();

                                    res = context.get_individuals_ids_via_query(ticket, query, sort, databases, top, limit);
                                }
                            }
                            catch (Throwable ex) { writeln(ex.msg); }
                            send(tid, res, rc, worker_id);
                        }
                    }
                },
                (Command cmd, Function fn, string arg1, string arg2, string _ticket, bool reopen, int worker_id, Tid tid)
                {
                    if (tid != Tid.init)
                    {
                        if (cmd == Command.Get && fn == Function.Individual)
                        {
                            if (trace_msg[ 500 ] == 1)
                                log.trace("get_individual #start : %s", arg1);

                            ResultCode rc = ResultCode.Internal_Server_Error;

                            immutable(Json)[] res = Json[].init;

                            try
                            {
                                Individual[ string ] onto_individuals =
                                    context.get_onto_as_map_individuals();

                                Individual individual = onto_individuals.get(arg1, Individual.init);

                                if (individual != Individual.init)
                                {
                                    rc = ResultCode.OK;
                                    res ~= cast(immutable)individual_to_json(individual);
                                }
                                else
                                {
                                    Ticket *ticket = context.get_ticket(_ticket);
                                    rc = ticket.result;
                                    if (rc == ResultCode.OK)
                                    {
                                        if (reopen)
                                        {
                                            context.reopen_ro_acl_storage_db();
                                            context.reopen_ro_subject_storage_db();
                                        }

                                        //Individual ii = context.get_individual(ticket, arg1);
                                        string cb = context.get_individual_as_cbor(ticket, arg1, rc);
                                        if (rc == ResultCode.OK)
                                        {
                                            Json rr = Json.emptyObject;
                                            cbor2json(&rr, cb);
                                            res ~= cast(immutable)rr;
                                        }
                                        //if (ii.getStatus() == ResultCode.OK)
                                        //    res ~= cast(immutable)individual_to_json(ii);
                                        //else
                                        //    rc = ii.getStatus();
                                    }
                                }
                            }
                            catch (Throwable ex)
                            {
                                log.trace("ERR! LINE:[%s], FILE:[%s], MSG:[%s]", ex.line, ex.file, ex.info);
                            }

                            if (trace_msg[ 500 ] == 1)
                                log.trace("get_individual #end : %s", arg1);

                            send(tid, res, rc, worker_id);
                        }
                    }
                },
                (Command cmd, Function fn, string arg1, string arg2, Tid tid)
                {
                    if (tid != Tid.init)
                    {
                        if (cmd == Command.Get && fn == Function.Rights)
                        {
                            ResultCode rc;

                            Ticket *ticket = context.get_ticket(arg2);
                            ubyte res;
                            rc = ticket.result;
                            if (rc == ResultCode.OK)
                            {
                                res = context.get_rights(ticket, arg1);
                            }
                            send(tid, res);
                        }
                        else if (cmd == Command.Get && fn == Function.RightsOrigin)
                        {
                            immutable(Individual)[] res;
                            void trace(string resource_group, string subject_group, string right)
                            {
                                Individual indv_res = Individual.init;

                                indv_res.uri = "_";
                                indv_res.addResource(rdf__type,
                                                     Resource(DataType.Uri, veda_schema__PermissionStatement));
                                indv_res.addResource(veda_schema__permissionObject,
                                                     Resource(DataType.Uri, resource_group));
                                indv_res.addResource(veda_schema__permissionSubject,
                                                     Resource(DataType.Uri, subject_group));
                                indv_res.addResource(right, Resource(true));

                                res ~= indv_res.idup;
                            }

                            ResultCode rc;

                            Ticket *ticket = context.get_ticket(arg2);
                            rc = ticket.result;
                            if (rc == ResultCode.OK)
                            {
                                context.get_rights_origin(ticket, arg1, &trace);
                            }
                            send(tid, res);
                        }
                    }
                },
                (Variant v) { writeln("pacahon_driver::Received some other type. ", v); }
                );
    }
}

