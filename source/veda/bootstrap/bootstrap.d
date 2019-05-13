module veda.bootstrap;

import std.string, std.process, std.stdio, std.conv, core.sys.posix.signal, std.file, core.thread;
import commando, veda.util.properd, veda.core.common.define;

struct ProcessInfo
{
    int    pid;
    string command;
    string args;
    string stat;
}

struct Module
{
    string   name;
    string   exec_file_name;
    string[] args;
    string[] wr_components;
    bool     is_main;
    bool     is_enable;
    int      priority;
}

struct RunModuleInfo
{
    Module *mdl;
    string args;
    Pid    pid;
}

extern (C) void handleTermination(int _signal)
{
    stderr.writefln("!SYS: VEDA, caught signal: %s", text(_signal));
}

shared static this()
{
    bsd_signal(SIGINT, &handleTermination);
}

private int[ string ] get_processes_info(string[] command_patterns, ref ProcessInfo[ int ] processes)
{
    //stderr.writeln("command_patterns=", command_patterns);

    long[ string ] keys;
    int[ string ] args_2_pid;

    auto ps = executeShell("ps aux");
    if (ps.status == 0)
    {
        string[] processes_list = ps.output.splitLines;

        if (processes_list.length > 1)
        {
            string[] _keys = processes_list[ 0 ].split();

            foreach (idx, key; _keys)
                keys[ key ] = idx;
        }

        long COMMAND = keys[ "COMMAND" ];
        long PID     = keys[ "PID" ];
        long STAT    = keys[ "STAT" ];

        foreach (process_str; processes_list[ 1..$ ])
        {
            string[] _data = process_str.split();

            if (_data.length >= keys.length)
            {
                try
                {
                    long   args_start_pos = process_str.indexOf(_data[ COMMAND ]);
                    string _args          = process_str[ args_start_pos..$ ].dup;

                    foreach (pt; command_patterns)
                    {
                        if (_data[ COMMAND ] == pt || _data[ COMMAND ] == app_dir ~ pt || _args == pt)
                        {
                            ProcessInfo pi = ProcessInfo(to!int (_data[ PID ]), _data[ COMMAND ], _args, _data[ STAT ]);
                            processes[ pi.pid ] = pi;

                            args_2_pid[ _args ] = pi.pid;
                        }
                    }
                }
                catch (Throwable tr)
                {
                    stderr.writeln("ERR! ", tr.msg);
                }
            }
        }
    }

    return args_2_pid;
}

import veda.util.module_info;
import veda.util.queue;

bool kill_prev_instance(string[] modules)
{
    bool is_found_modules;

    for (int attempt = 0; attempt < 10; attempt++)
    {
        is_found_modules = false;
        ProcessInfo[ int ] processes;

        auto args_2_pid = get_processes_info(modules, processes);

        foreach (ml; modules)
        {
            int pid = args_2_pid.get(ml, -1);
            if (pid != -1)
            {
                if (pid != thisProcessID())
                {
                    is_found_modules = true;
                    kill(pid, SIGKILL);
                    stderr.writeln("found running module ", ml, " (", pid, "), kill him.");
                }
            }
        }

        if (is_found_modules == false)
            break;
    }

    return is_found_modules;
}

string app_dir;

void main(string[] args)
{
    stderr.writefln("args=%s", args);
    int[][ string ] command_2_pids;

	app_dir = environment.get("APPDIR");
	if (app_dir is null)
	{
		app_dir = "./";
	} 
	else
	{
		app_dir ~= "/";
	} 
	

    bool need_remove_ontology = false;
    bool need_reload_ontology = false;
    bool need_watchdog        = true;

    foreach (arg; args)
    {
        if (arg == "remove-ontology")
            need_remove_ontology = true;
        if (arg == "reload-ontology")
            need_reload_ontology = true;
        if (arg == "no-watchdog")
            need_watchdog = false;
    }

    string veda_id = "";
    try
    {
        ArgumentParser.parse(args, (ArgumentSyntax syntax)
                             {
                                 syntax.config.caseSensitive = commando.CaseSensitive.yes;
                                 syntax.option('i', "id", &veda_id, Required.no,
                                               "Set veda id, example: --id=one");
                             });
    }
    catch (ArgumentParserException ex)
    {
        stderr.writefln(ex.msg);
        return;
    }

    string webserver_ports_str = "";
    try
    {
        ArgumentParser.parse(args, (ArgumentSyntax syntax)
                             {
                                 syntax.config.caseSensitive = commando.CaseSensitive.yes;
                                 syntax.option('p', "http_ports", &webserver_ports_str, Required.no,
                                               "Set frontend http ports, example: --http_ports=8081,8082");
                             });
    }
    catch (ArgumentParserException ex)
    {
        stderr.writefln(ex.msg);
        return;
    }

    string ext_user_port_str = "";

    try
    {
        ArgumentParser.parse(args, (ArgumentSyntax syntax)
                             {
                                 syntax.config.caseSensitive = commando.CaseSensitive.yes;
                                 syntax.option('e', "ext_usr_http_port", &ext_user_port_str, Required.no,
                                               "Set external user http port, example: --ext_usr_http_port=8082");
                             });
    }
    catch (ArgumentParserException ex)
    {
        stderr.writefln(ex.msg);
        return;
    }

    string[] webserver_ports = webserver_ports_str.split(',');

    if (webserver_ports.length > 0)
    {
        stderr.writefln("use options http_ports=%s", webserver_ports);
    }

    string[ string ] env;
    int exit_code;

    Module *[ string ] modules;

    modules[ "veda-lmdb-srv" ]      = new Module("veda-ro-storage", "veda-ro-storage", [], [], false, false, 0);
    modules[ "veda-mstorage" ]      = new Module("veda-mstorage", "veda-mstorage", [], [ "acl_preparer", "subject_manager", "ticket_manager" ], true, true, 1);
    modules[ "veda-ft-indexer" ]    = new Module("veda-ft-indexer", "veda-ft-indexer", [], [ "fulltext_indexer" ], false, false, 2);
    modules[ "veda-ft-query" ]      = new Module("veda-ft-query", "veda-ft-query", [], [], false, false, 3);
    modules[ "veda-scripts-main" ]  = new Module("veda-scripts-main", "veda-scripts", [ "main" ], [ "scripts-main" ], false, false, 4);
    modules[ "veda-scripts-lp" ]    = new Module("veda-scripts-lp", "veda-scripts", [ "lp" ], [ "scripts-lp" ], false, false, 5);
    modules[ "veda-scripts-lp1" ]   = new Module("veda-scripts-lp1", "veda-scripts", [ "lp1" ], [ "scripts-lp1" ], false, false, 6);
    modules[ "veda-ltr-scripts" ]   = new Module("veda-ltr-scripts", "veda-scripts", [ "ltr" ], [ "ltr_scripts" ], false, false, 7);
    modules[ "veda-fanout-email" ]  = new Module("veda-fanout-email", "veda-fanout-email", [], [ "fanout_email" ], false, false, 8);
    modules[ "veda-fanout-sql-np" ] = new Module("veda-fanout-sql-np", "veda-fanout-sql-np", [], [ "fanout_sql_np" ], false, false, 9);
    modules[ "veda-fanout-sql-lp" ] = new Module("veda-fanout-sql-lp", "veda-fanout-sql-lp", [], [ "fanout_sql_lp" ], false, false, 10);
    modules[ "veda-input-queue" ]   = new Module("veda-input-queue", "veda-input-queue", [], [], false, false, 11);
    modules[ "veda-ttlreader" ]     = new Module("veda-ttlreader", "veda-ttlreader", [], [], false, false, 12);
    modules[ "veda-ccus" ]          = new Module("veda-ccus", "veda-ccus", [], [], false, false, 13);
    modules[ "veda-gowebserver" ]   = new Module("veda-gowebserver", "veda-gowebserver", [], [], false, false, 99);

    string[ string ] properties;
    properties = readProperties("./veda.properties");

    bool[ string ] need_modules;
    auto modules_list_str = properties.as!(string)("modules");
    if (modules_list_str !is null)
    {
        foreach (el; modules_list_str.split(","))
        {
            stderr.writeln("module on start:", el.strip());
            need_modules[ el.strip() ] = true;
        }
    }

    if (need_modules.length > 0)
    {
        foreach (mdl; modules.values)
        {
            if (need_modules.get(mdl.name, false) == true)
            {
                mdl.is_enable = true;
            }
        }
    }
    else
    {
        foreach (mdl; modules.values)
        {
            mdl.is_enable = true;
        }
    }



    bool is_found_modules = false;

    bool is_main_loop = true;

    while (is_main_loop)
    {
        is_found_modules = kill_prev_instance(modules.keys);

        if (is_found_modules == true)
        {
            stderr.writeln("запуск системы невозможен, в памяти остались модули от предыдущего запуска : ", command_2_pids,
                           ", завершите их и повторите попытку запуска.");
            return;
        }

        Pid    server_pid;

        string path = "./logs";
        try
        {
            mkdir(path);
            stderr.writeln("create folder: ", path);
        }
        catch (Exception ex)
        {
        }

        try
        {
            mkdir("./.pids");
            stderr.writeln("create folder: ", path);
        }
        catch (Exception ex)
        {
        }

        RunModuleInfo[ string ] started_modules;

        for (int priority = 0; priority < 20; priority++)
        {
            foreach (ml; modules)
            {
                if (ml.is_enable == false)
                    continue;

                if (ml.priority != priority)
                    continue;

                auto     _logFile = File("logs/" ~ ml.name ~ "-stderr.log", "w");

                string[] sargs;

                if (need_remove_ontology && ml.name == "veda-ttlreader")
                    sargs = [ app_dir ~ ml.exec_file_name, "remove-ontology" ];
                else if (need_reload_ontology && ml.name == "veda-ttlreader")
                    sargs = [ app_dir ~ ml.exec_file_name, "reload-ontology" ];
                else
                    sargs = [ app_dir ~ ml.exec_file_name ];

                foreach (arg; ml.args)
                    sargs ~= arg;

                sargs ~= "--id=" ~ veda_id;

                stderr.writeln("starting ", sargs);

                auto _pid = spawnProcess(sargs,
                                         std.stdio.stdin,
                                         std.stdio.stdout,
                                         _logFile, env, Config.suppressConsole);

                if (ml.is_main == true)
                    server_pid = _pid;

                auto stsargs = array_to_str(sargs);
                started_modules[ stsargs ] = RunModuleInfo(ml, stsargs, _pid);
            }
        }

        // start webserver
        Module *ml = modules.get("veda-gowebserver", null);
        if (ml !is null && ml.is_enable == true)
        {
            if (need_remove_ontology == false && need_reload_ontology == false)
            {
                if (webserver_ports.length > 0)
                {
                    foreach (port; webserver_ports)
                    {
                        string[] sargs;

                        sargs = [ app_dir ~ ml.exec_file_name, "--http_port=" ~ port ];

                        if (ext_user_port_str.length > 0)
                            sargs ~= "--ext_usr_http_port=" ~ ext_user_port_str;

                        sargs ~= "--id=" ~ veda_id;

                        auto _logFile = File("logs/" ~ ml.exec_file_name ~ port ~ "-stderr.log", "w");

                        stderr.writeln("starting websrv ", sargs);

                        auto _pid = spawnProcess(sargs,
                                                 std.stdio.stdin,
                                                 std.stdio.stdout,
                                                 _logFile, env, Config.suppressConsole);

                        auto stsargs = array_to_str(sargs);
                        started_modules[ stsargs ] = RunModuleInfo(ml, stsargs, _pid);
                    }
                }
                else
                {
                    string[] sargs;

                    sargs = [ app_dir ~ ml.exec_file_name ];
                    sargs ~= "--id=" ~ veda_id;

                    auto _logFile = File("logs/" ~ ml.name ~ "-stderr.log", "w");

                    stderr.writeln("starting websrv ", sargs);

                    auto _pid = spawnProcess(sargs,
                                             std.stdio.stdin,
                                             std.stdio.stdout,
                                             _logFile, env, Config.suppressConsole);

                    auto stsargs = array_to_str(sargs);
                    started_modules[ stsargs ] = RunModuleInfo(ml, stsargs, _pid);
                }
            }
            else
                is_main_loop = false;
        }

        bool is_next = true;


        // wait for all running
        //stderr.writeln ("started_modules=", started_modules);
        stderr.writeln("wait for all running");
        while (is_next)
        {
            core.thread.Thread.yield();
            core.thread.Thread.sleep(dur!("seconds")(1));

            ProcessInfo[ int ] processes;

            auto args_2_pid = get_processes_info(started_modules.keys, processes);

            is_next = false;
            foreach (eml; started_modules.keys)
            {
                int pid;
                pid = args_2_pid.get(eml, -1);

                if (pid == -1)
                {
                    stderr.writeln("not found running module ", eml, " (", pid, ")");
                    is_next = true;
                    break;
                }
                else
                {
                    stderr.writeln("Ok, pid=", pid, ", module ", eml);
                    auto filename = eml.replace(" ", "_");
                    std.file.write(".pids/" ~ filename ~ "-pid", text(pid));
                }
            }
        }

        std.file.write(".pids/veda-bootstrap-pid", text(thisProcessID()));

        stderr.writefln("all component started, need_watchdog=%s", need_watchdog);

        if (need_remove_ontology == true || need_reload_ontology == true || need_watchdog == false)
        {
            stderr.writeln("wait exit for module m_storage");
            exit_code = wait(server_pid);
        }
        else
        {
            stderr.writeln("watch dog start");
            is_next = true;
            while (is_next)
            {
                core.thread.Thread.yield();
                core.thread.Thread.sleep(dur!("seconds")(10));

                ProcessInfo[ int ] processes;
                auto args_2_pid = get_processes_info(started_modules.keys, processes);

                foreach (ml; started_modules)
                {
                    //stderr.writeln("check module ", ml);
                    int pid;
                    pid = args_2_pid.get(ml.args, -1);

                    if (pid == -1)
                    {
                        stderr.writeln("not found running module ", ml, " (", pid, ")");

                        if (ml.mdl.is_main == true)
                        {
                            is_next = false;
                            break;
                        }
                        else
                        {
                            auto _logFile = File("logs/" ~ ml.mdl.name ~ "-stderr.log", "w");
                            stderr.writeln("restart " ~ ml.mdl.name);
                            auto _pid = spawnProcess(ml.args.split(" "),
                                                     std.stdio.stdin,
                                                     std.stdio.stdout,
                                                     _logFile, env, Config.suppressConsole);
                        }
                    }
                    else
                    {
                        ProcessInfo pi = processes[ pid ];
                        if (pi.stat == "Z+" || pi.stat == "Z")
                        {
                            stderr.writeln("defunct module ", pi, " (", pid, ")");
                            kill(pi.pid, SIGKILL);

                            if (ml.mdl.is_main == true)
                            {
                                is_next = false;
                                break;
                            }
                            else
                            {
                                auto _logFile = File("logs/" ~ ml.mdl.name ~ "-stderr.log", "w");
                                stderr.writeln("restart " ~ ml.mdl.name);
                                auto _pid = spawnProcess(ml.args.split(" "),
                                                         std.stdio.stdin,
                                                         std.stdio.stdout,
                                                         _logFile, env, Config.suppressConsole);
                            }
                        }
                    }
                }
            }
        }

        if (exit_code == -SIGKILL)
            stderr.writeln("veda-mstorage terminated, code=", exit_code);

        ProcessInfo[ int ] processes;
        auto args_2_pid = get_processes_info(started_modules.keys, processes);

        kill_prev_instance(started_modules.keys);

        executeShell("rm data/module-info/*.lock");
        executeShell("rm data/queue/*.lock");
        executeShell("rm data/uris/*.lock");
    }

    stderr.writefln("EXIT!");
}

private string array_to_str(string[] data)
{
    string res;

    foreach (idx, dd; data)
    {
        if (idx > 0)
            res ~= " ";
        res ~= dd;
    }
    return res;
}
