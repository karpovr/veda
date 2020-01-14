module veda.util.module_info;

import std.stdio, std.conv, std.utf, std.string, std.file, std.datetime, std.json, std.digest.crc, std.algorithm : remove;
import std.format, std.array                                                                                     : appender;
import veda.core.common.define, veda.common.logger;

public struct MInfo {
    string name;
    long   op_id;
    long   committed_op_id;
    bool   is_Ok = false;
}

public enum OPEN_MODE : byte {
    /// Выдача и проверка тикетов
    READER        = 1,
    WRITER        = 2,
    READER_WRITER = 3
}

class ModuleInfoFile
{
    private string    fn_module_info = null;

    private File      *ff_module_info_w = null;
    private File      *ff_module_info_r = null;
    private File      *ff_lock_w        = null;

    private string    module_name;
    private Logger    log;
    private bool      is_writer_open = false;
    private bool      is_reader_open = false;
    private ubyte[]   buff;
    private OPEN_MODE mode;
    private bool      _is_ready;
    private ubyte[ 4 ] crc;
    CRC32             hash;

    this(string _module_name, Logger _log, OPEN_MODE _mode)
    {
        try
        {
            module_name = _module_name;

            if (exists(module_info_path) == false) {
                try
                {
                    mkdir(module_info_path);
                    writeln("create folder: ", module_info_path);
                }
                catch (Exception ex)
                {
                }
            }

            fn_module_info = module_info_path ~ "/" ~ module_name ~ "_info";
            log            = _log;
            mode           = _mode;

            _is_ready = true;

            if (mode == OPEN_MODE.WRITER || mode == OPEN_MODE.READER_WRITER) {
                string file_name_lock = fn_module_info ~ ".lock";
                if (exists(file_name_lock) == false) {
                    ff_lock_w = new File(file_name_lock, "w");
                    ff_lock_w.write("*");
                }else  {
                    ff_lock_w = new File(file_name_lock, "r+");
                }

                if (ff_lock_w.tryLock(LockType.readWrite) == false) {
                    _is_ready = false;
                    log.trace("ERR! ModuleInfo [%s] already open on write", module_name);
                    return;
                }
                ff_lock_w.flush();
            }
        }
        catch (Throwable tr)
        {
            log.trace("ERR! fail open ModuleInfo [%s], err=[%s]", module_name, tr.msg);
            _is_ready = false;
        }
    }

    ~this()
    {
        close();
    }

    bool is_ready(){
        return _is_ready;
    }

    private bool open_writer(){
        if (mode != OPEN_MODE.WRITER && mode != OPEN_MODE.READER_WRITER)
            return false;

        try
        {
            if (exists(fn_module_info) == false)
                ff_module_info_w = new File(fn_module_info, "w");
            else
                ff_module_info_w = new File(fn_module_info, "r+");
            is_writer_open = true;

            return true;
        }
        catch (Throwable tr)
        {
            log.trace("ERR! ModuleInfoFile:open_writer, %s", tr.msg);
        }

        return false;
    }

    public void close(){
        if (mode == OPEN_MODE.READER && ff_module_info_r !is null)
            ff_module_info_r.close();

        if (mode == OPEN_MODE.READER_WRITER || mode == OPEN_MODE.WRITER) {
            if (ff_module_info_w !is null)
                ff_module_info_w.close();
        }
    }

    private void open_reader(){
        try
        {
            ff_module_info_r = new File(fn_module_info, "r");
            is_reader_open   = true;
        }
        catch (Throwable tr)
        {
            log.trace("ERR! ModuleInfoFile:open_reader, %s", tr.msg);
        }
    }

    bool put_info(long op_id, long committed_op_id){
        if (!_is_ready)
            return false;

        if (is_writer_open == false) {
            open_writer();
            if (is_writer_open == false)
                return false;
        }

        try
        {
            auto writer = appender!string();
            formattedWrite(writer, "%s;%d;%d;", module_name, op_id, committed_op_id);

            hash.start();
            hash.put(cast(ubyte[])writer.data);
            string hash_hex = crcHexString(hash.finish());

            ff_module_info_w.seek(0);
            ff_module_info_w.write(writer.data);
            ff_module_info_w.writeln(hash_hex);
            ff_module_info_w.flush();
            //ff_module_info_w.sync();
            return true;
        }
        catch (Throwable tr)
        {
            log.trace("module:put_info [%s;%d;%d] %s", module_name, op_id, committed_op_id, tr.msg);
        }
        return false;
    }

    public MInfo get_info(){
        MInfo res;

        if (is_reader_open == false) {
            open_reader();
            if (is_reader_open == false)
                return res;
        }

//        log.trace("get_info #1 [%s]", module_name);

        res.is_Ok = false;

        string[] ch;
        string   str;

        try
        {
            ff_module_info_r.seek(0);

            if (buff is null)
                buff = new ubyte[ 4096 ];

            ubyte[] newbuff = ff_module_info_r.rawRead(buff);
            str = cast(string)newbuff[ 0..$ ];

            if (str !is null) {
                if (str.length > 2) {
                    long end_pos = str.indexOf('\n');
                    str = str[ 0..end_pos ];

                    if (str.length > 10) {
                        ch = str.split(';');
                        //writeln("@ queue.get_info ch=", ch);
                        if (ch.length != 4)
                            return res;

                        res.name            = ch[ 0 ];
                        res.op_id           = to!long (ch[ 1 ]);
                        res.committed_op_id = to!long (ch[ 2 ]);
                        res.is_Ok           = true;
                    }
                }
            }
        }
        catch (Throwable tr)
        {
            log.trace("ERR! get_info[%s] fail, msg=[%s]->[%s], ex=[%s]", module_name, str, ch, tr.msg);
        }

//        log.trace("get_info #e [%s], res(%s): name=%s, op_id=%d, committed_op_id=%d",
//          module_name, text(res.is_Ok), res.name, res.op_id, res.committed_op_id);

        return res;
    }
}
