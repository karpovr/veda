module veda.core.glue_code.script;

import bind.v8d_header;

struct ScriptInfo
{
    string id;
    string str_script;
    bool[ string ] filters;
    Script compiled_script;
}

