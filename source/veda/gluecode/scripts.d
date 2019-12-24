/**
 * scripts module
 */
module veda.gluecode.scripts;

private import std.stdio, std.conv, std.utf, std.string, std.file, std.datetime, std.container.array, std.algorithm, std.range, core.thread, std.uuid;
private import std.concurrency;
private import veda.common.type, veda.core.common.type, veda.core.common.define, veda.onto.resource, veda.onto.lang, veda.onto.individual;
private import veda.common.logger, veda.core.impl.thread_context, veda.util.queue;
private import veda.core.common.context, veda.onto.onto, veda.util.module_info;
private import veda.vmodule.vmodule, veda.search.common.isearch, veda.search.ft_query.ft_query_client;
private import veda.gluecode.script, veda.gluecode.v8d_bind;

int main(string[] args){
    writeln("args = ", args);
    if (args.length < 1 || (args[ 1 ] != "main" && args[ 1 ] != "lp" && args[ 1 ] != "lp1")) {
        writefln("use %s [main/lp/lp1]", args[ 0 ]);
        return -1;
    }

    string vm_id = args[ 1 ];

    process_name = "scripts-" ~ vm_id;
    Logger log = new Logger("veda-core-" ~ process_name, "log", "");
    log.tracec("use VM id=%s", vm_id);

    auto input_onto_info = new ModuleInfoFile("input-onto", log, OPEN_MODE.READER);
    if (!input_onto_info.is_ready) {
	log.trace("%s ModuleInfo not ready, terminated", "input_onto");
	return -1;
    }

    if (input_onto_info.get_info().committed_op_id == 0) {
    while (input_onto_info.get_info().committed_op_id == 0) {
		log.trace("wait for load ontology...");
        Thread.sleep(dur!("seconds")(1));
    }
	auto op_id_input_onto = input_onto_info.get_info().committed_op_id;

    auto fulltext_indexer_info = new ModuleInfoFile("fulltext_indexer", log, OPEN_MODE.READER);
    if (!fulltext_indexer_info.is_ready) {
	log.trace("%s ModuleInfo not ready, terminated", "fulltext_indexer");
	return -1;
    }

    while (fulltext_indexer_info.get_info().committed_op_id < op_id_input_onto) {
		log.trace("wait for ft indexed ontology...");
        Thread.sleep(dur!("seconds")(1));
    }
    }

    if (vm_id == "main") {
        {
            Thread.sleep(dur!("seconds")(1));

            ScriptProcess p_script = new ScriptProcess(vm_id, SUBSYSTEM.SCRIPTS, MODULE.scripts_main, log);
            p_script.run();
        }
    }else if (vm_id == "lp") {
        Thread.getThis().priority(Thread.PRIORITY_MIN);

        ScriptProcess p_script = new ScriptProcessLowPriority("V8.LowPriority", SUBSYSTEM.SCRIPTS, MODULE.scripts_lp, log);
        p_script.run();
    }else if (vm_id == "lp1") {
        Thread.getThis().priority(Thread.PRIORITY_MIN);

        ScriptProcess p_script = new ScriptProcessLowPriority("V8.LowPriority1", SUBSYSTEM.SCRIPTS, MODULE.scripts_lp1, log);
        p_script.run();
    }

    return 0;
}

class ScriptProcessLowPriority : ScriptProcess
{
    Consumer main_cs_r;
    string   main_queue_cs = "scripts_main0";

    this(string _vm_id, SUBSYSTEM _subsystem_id, MODULE _module_id, Logger log)
    {
        super(_vm_id, _subsystem_id, _module_id, log);
    }

    override ResultCode prepare(string queue_name, string src, INDV_OP cmd, string user_uri, string prev_bin, ref Individual prev_indv,
                                string new_bin,
                                ref Individual new_indv,
                                string event_id, long transaction_id,
                                long op_id, long count_pushed,
                                long count_popped, long op_id_on_start,
                                long count_from_start, uint cs_id){
        if (cmd == INDV_OP.REMOVE)
            return ResultCode.Ok;

        if (main_cs_r is null) {
            log.trace("INFO: open %s, %s, %s", main_queue, my_consumer_path, main_queue_cs);
            main_cs_r = new Consumer(main_queue, my_consumer_path, main_queue_cs, Mode.R, log);
            while (main_cs_r.open(true, Mode.R) == false) {
                log.trace("WARN: main queue consumer not open, sleep and repeate");
                core.thread.Thread.sleep(dur!("seconds")(1));
            }
        }

        main_cs_r.reopen();
        while (main_cs_r.get_id() == cs_id && main_cs_r.count_popped < count_popped) {
            log.tracec("INFO: sleep, scripts_main=%d, my=%d", main_cs_r.count_popped, count_popped);
            core.thread.Thread.sleep(dur!("seconds")(1));
            main_cs_r.reopen();
        }

        return super.prepare(queue_name, src, cmd, user_uri, prev_bin, prev_indv, new_bin, new_indv, event_id, transaction_id, op_id, count_pushed,
                             count_popped, op_id_on_start,
                             count_from_start, cs_id);
    }
}

int MAX_COUNT_LOOPS = 100;

class ScriptProcess : VedaModule
{
    private ScriptsWorkPlace wpl;

    private Search           vql;
    private string           empty_uid;
    private string           vars_for_event_script;
    private string           vars_for_codelet_script;
    private string           before_vars;
    private string           after_vars;

    private ScriptVM         script_vm;
    private string           vm_id;

    this(string _vm_id, SUBSYSTEM _subsystem_id, MODULE _module_id, Logger log)
    {
        super(_subsystem_id, _module_id, log);

        vm_id   = _vm_id;
        g_vm_id = vm_id;
        wpl     = new ScriptsWorkPlace();
    }

    long count_sckip = 0;

    override void thread_id(){
    }

    override void receive_msg(string msg){
        log.trace("receive msg=%s", msg);
    }

    override Context create_context(){
        return null;
    }


    override ResultCode prepare(string queue_name, string src, INDV_OP cmd, string user_uri, string prev_bin, ref Individual prev_indv,
                                string new_bin,
                                ref Individual new_indv,
                                string event_id, long transaction_id,
                                long op_id, long count_pushed,
                                long count_popped, long op_id_on_start,
                                long count_from_start, uint cs_id){
        if (cmd == INDV_OP.REMOVE)
            return ResultCode.Ok;

        if (script_vm is null)
            return ResultCode.NotReady;

        if (src != "?" && queue_name != src)
            return ResultCode.Ok;

        //writeln ("#prev_indv=", prev_indv);
        //writeln ("#new_indv=", new_indv);

        g_count_pushed = count_pushed;
        g_count_popped = count_popped;

        string    individual_id = new_indv.uri;

        bool      prepare_if_is_script = false;

        Resources types  = new_indv.resources.get("rdf:type", Resources.init);
        string    run_at = new_indv.getFirstLiteral("v-s:runAt");

        string[]  indv_types = types.getAsArrayStrings();
        foreach (itype; indv_types) {
            if (itype == "v-s:PermissionStatement" || itype == "v-s:Membership") {
                committed_op_id = op_id;
                return ResultCode.Ok;
            }

            if (itype == "v-s:Event")
                prepare_if_is_script = true;
        }

        if (prepare_if_is_script == false) {
            if (wpl.scripts.get(individual_id, ScriptInfo.init) !is ScriptInfo.init)
                prepare_if_is_script = true;
        }

        if (prepare_if_is_script) {
            prepare_script(wpl, new_indv, script_vm, "", before_vars, vars_for_event_script, after_vars, false);
        }

        set_g_parent_script_id_etc(event_id);
        set_g_prev_state(prev_bin);

        g_document.data   = cast(char *)new_bin;
        g_document.length = cast(int)new_bin.length;

        if (user_uri !is null) {
            g_user.data   = cast(char *)user_uri;
            g_user.length = cast(int)user_uri.length;
        }else  {
            g_user.data   = cast(char *)"cfg:VedaSystem";
            g_user.length = "cfg:VedaSystem".length;
        }

        string sticket = context.sys_ticket().id;
        g_ticket.data   = cast(char *)sticket;
        g_ticket.length = cast(int)sticket.length;

        set_g_super_classes(indv_types, context.get_onto());

        //log.trace("-------------------");
        //log.trace("indv=%s, indv_types=%s, event_scripts_order.length=%d", individual_id, indv_types, wpl.scripts_order.length);
        //log.trace ("queue of scripts:%s", event_scripts_order.array());

        string   last_part_event_id;
        string[] full_path_els;
        if (event_id != null && event_id.length > 0) {
            full_path_els = event_id.split(";");
            if (full_path_els.length > 0)
                last_part_event_id = full_path_els[ 0 ];
        }

        foreach (_script_id; wpl.scripts_order) {
            script_id = _script_id;
            string     run_script_id = individual_id ~ '+' ~ script_id;

            ScriptInfo script = wpl.scripts[ script_id ];

            if (script.compiled_script !is null) {
                if (src == "?") {
                    if (run_at !is null && run_at != vm_id)
                        continue;
                    else if (run_at is null && script.run_at != vm_id)
                        continue;
                }

                g_event_id = run_script_id ~ ";" ~ event_id;

                //log.trace("first check pass script:%s, filters=%s", script_id, script.filters);

                if (is_filter_pass(&script, individual_id, indv_types, context.get_onto()) == false) {
                    //log.trace("skip (filter) script:%s", script_id);
                    continue;
                }

                if (script.unsafe == true)
                    log.trace("WARN! this script is UNSAFE!, %s", script_id);

                //log.trace("filter pass script:%s", script_id);
                //log.trace("look script:%s", script_id);

                log.trace("start: %s, %s, src=%s, op_id=%d, tnx_id=%d, event_id=%s", script_id, individual_id, src, op_id, transaction_id,
                          event_id);

                if (script.unsafe == false) {
                    if (event_id !is null && event_id.length > 1) {
                        //log.trace("@ last_part_event_id=%s", last_part_event_id);

                        if ((last_part_event_id == run_script_id) || last_part_event_id == "IGNORE") {
                            log.trace("ERR! skip script, found looped sequence, path: [%s]", last_part_event_id);
                            continue;
                        }

                        int count_loops;
                        foreach (el; full_path_els) {
                            if (el == run_script_id)
                                count_loops++;
                        }

                        if (count_loops > MAX_COUNT_LOOPS) {
                            log.trace("ERR! skip script, counted (%d) loops in sequencee > %d, path: [%s]", count_loops, MAX_COUNT_LOOPS, event_id);
                            continue;
                        }

                        if (count_loops > 1)
                            log.trace("WARN! found %d loops in sequence, path: [%s]", count_loops, event_id);
                    }
                }

                try
                {
                    tnx.reset();

                    //count++;
                    script.compiled_script.run();
                    tnx.id            = transaction_id;

                    if (script.disallow_changing_source == true)
                        tnx.src = src;
                    else
                        tnx.src = queue_name;

                    ResultCode res = g_context.commit(&tnx, OptAuthorize.NO);

                    //log.trace("tnx: id=%s", tnx.id);
                    foreach (item; tnx.get_queue()) {
                        log.trace("tnx item: cmd=%s, uri=%s, res=%s", item.cmd, item.new_indv.uri, text(item.rc));
                    }

                    if (res != ResultCode.Ok) {
                        log.trace("fail exec event script : %s", script_id);
                        return res;
                    }

                    log.trace("end: %s", script_id);
                }
                catch (Throwable ex)
                {
                    log.trace("WARN! fail execute event script : %s %s %s", script_id, ex.msg, ex.info);
                }
            }
        }

        //log.trace("count:", count);

        // clear_script_data_cache ();
        committed_op_id = op_id;

        return ResultCode.Ok;
    }

    override bool open(){
        context.set_vql(new FTQueryClient(context));

        vql       = context.get_vql();
        script_vm = get_ScriptVM(context);

        if (script_vm !is null)
            return true;

        return false;
    }

    override bool configure(){
        log.trace("configure scripts");

        log.trace("use configuration: %s", node);

        vars_for_event_script =
            "var user_uri = get_env_str_var ('$user');"
            ~ "var parent_script_id = get_env_str_var ('$parent_script_id');"
            ~ "var parent_document_id = get_env_str_var ('$parent_document_id');"
            ~ "var prev_state = get_individual (ticket, '$prev_state');"
            ~ "var super_classes = get_env_str_var ('$super_classes');"
            ~ "var queue_elements_count = get_env_num_var ('$queue_elements_count');"
            ~ "var queue_elements_processed = get_env_num_var ('$queue_elements_processed');"
            ~ "var _event_id = '?';";

        before_vars =
            "var document = get_individual (ticket, '$document');"
            ~ "if (document) {";

        after_vars = "};";

        load_event_scripts();

        return true;
    }

    override bool close(){
        return vql.close_db();
    }

    override void event_of_change(string uri){
        configure();
    }

    public void load_event_scripts(){
        if (script_vm is null)
            return;

        log.trace("start load db scripts");

        Ticket sticket = context.sys_ticket();
        g_ticket.data   = cast(char *)sticket.id;
        g_ticket.length = cast(int)sticket.id.length;

        auto si = context.get_info(MODULE.subject_manager);

        bool is_ft_busy = true;
        while (is_ft_busy) {
            auto mi = context.get_info(MODULE.fulltext_indexer);

            log.trace("wait for the ft-index to finish storage.op_id=%d ft.committed_op_id=%d ...", si.op_id, mi.committed_op_id);

            if (mi.committed_op_id >= si.op_id - 1)
                break;

            core.thread.Thread.sleep(dur!("msecs")(1000));
        }

        Individual[] script_indvs;
        vql.reopen_db();
        vql.query(sticket.user_uri, "'rdf:type' === 'v-s:Event'", null, null, 10000, 10000, OptAuthorize.NO, false, script_indvs);

        foreach (ss; script_indvs)
            prepare_script(wpl, ss, script_vm, "", before_vars, vars_for_event_script, after_vars, false);

        string scripts_ordered_list;
        foreach (_script_id; wpl.scripts_order)
            scripts_ordered_list ~= "," ~ _script_id;

        log.trace("load db scripts, count=%d, scripts_uris=[%s] ", wpl.scripts_order.length, scripts_ordered_list);
    }

    private void set_g_parent_script_id_etc(string event_id){
        string[] aa;

        if (event_id !is null) {
            aa = event_id.split(";");
            if (aa.length > 0)
                event_id = aa[ 0 ];

            aa = event_id.split("+");

            if (aa.length >= 2) {
                g_parent_script_id.data     = cast(char *)aa[ 1 ];
                g_parent_script_id.length   = cast(int)aa[ 1 ].length;
                g_parent_document_id.data   = cast(char *)aa[ 0 ];
                g_parent_document_id.length = cast(int)aa[ 0 ].length;

                //log.trace ("DEBUG! parent_script_id=%s, parent_document_id=%s", aa[ 1 ], aa[ 0 ]);
            }else  {
                g_parent_script_id.data     = cast(char *)empty_uid;
                g_parent_script_id.length   = cast(int)empty_uid.length;
                g_parent_document_id.data   = cast(char *)empty_uid;
                g_parent_document_id.length = cast(int)empty_uid.length;
            }
        }else  {
            g_parent_script_id.data     = cast(char *)empty_uid;
            g_parent_script_id.length   = cast(int)empty_uid.length;
            g_parent_document_id.data   = cast(char *)empty_uid;
            g_parent_document_id.length = cast(int)empty_uid.length;
        }
    }
}


