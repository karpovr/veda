module veda.core.impl.app_context_creator_rlmdb;

private
{
    import std.stdio;
    import veda.util.properd;
    import veda.core.impl.thread_context, veda.core.common.context, veda.common.logger;
    import veda.storage.lmdbsrv.lmdbsrv_r_storage;
}

public static Context create_new_ctx(string context_name, Logger _log, string _main_module_url, string _ro_storage_url)
{
    PThreadContext ctx = new PThreadContext();

    if (_main_module_url !is null)
        ctx.main_module_url = _main_module_url;

    ctx.node_id = "cfg:standart_node";
    ctx.log     = _log;

    if (ctx.log is null)
        writefln("context_name [%s] log is null", context_name);

    ctx.storage = new LmdbSrvRStorage(context_name, _ro_storage_url, ctx.log);

    ctx.name = context_name;

    ctx.get_configuration();

    ctx.log.trace_log_and_console("NEW CONTEXT(RLMDB) [%s], main_module_url=%s", context_name, ctx.main_module_url);

    return ctx;
}

