module veda.onto.bj8individual.individual8json;

import std.conv, std.stdio, std.json, std.datetime, std.string;
import veda.common.type, veda.onto.individual, veda.onto.resource, veda.onto.lang;

static LANG[ string ] Lang;
static DataType[ string ] Resource_type;

static this() {
    Lang =
    [
        "NONE":LANG.NONE, "none":LANG.NONE,
        "RU":LANG.RU, "ru":LANG.RU,
        "EN":LANG.EN, "en":LANG.EN
    ];

    Resource_type =
    [
        "Uri":DataType.Uri,
        "String":DataType.String,
        "Integer":DataType.Integer,
        "Datetime":DataType.Datetime,
        "Decimal":DataType.Decimal,
        "Boolean":DataType.Boolean,
        "Binary":DataType.Binary,
    ];
}

public string getString(ref JSONValue src, string key)
{
    JSONValue res = src[ key ];

    if (res.type == JSON_TYPE.STRING)
        return res.str;

    return null;
}

public long getLong(ref JSONValue src, string key)
{
    JSONValue res = src[ key ];

    if (res.type == JSON_TYPE.INTEGER)
        return res.integer();

    return 0;
}

public bool getBool(ref JSONValue src, string key)
{
    JSONValue res = src[ key ];

    if (res.type == JSON_TYPE.TRUE)
        return true;

    return false;
}

public float getFloat(ref JSONValue src, string key)
{
    JSONValue res = src[ key ];

    if (res.type == JSON_TYPE.FLOAT)
        return res.floating();

    return 0;
}

JSONValue individual_to_json(Individual individual, string[] filters = [])
{
//    writeln ("\nINDIVIDUAL->:", individual);
    JSONValue json;

    json[ "@" ] = individual.uri;

    if (filters.length > 0)
    {
        foreach (property_name; filters)
        {
            auto property_values = individual.resources.get(property_name, Resources.init);
            if (property_values != Resources.init)
            {
                JSONValue[] jsonVals;

                foreach (property_value; property_values)
                    jsonVals ~= resource_to_json(cast(Resource)property_value);

                JSONValue resources_json;
                resources_json.array = jsonVals;

                json[ property_name ] = resources_json;
            }
        }
    }
    else
    {
        foreach (property_name, property_values; individual.resources)
        {
            JSONValue[] jsonVals;

            foreach (property_value; property_values)
                jsonVals ~= resource_to_json(cast(Resource)property_value);

            JSONValue resources_json;
            resources_json.array = jsonVals;

            json[ property_name ] = resources_json;
        }
    }
//    writeln ("->JSON:", json);
    return json;
}

JSONValue[] individuals_to_json(Individual[] individuals)
{
//    writeln ("\nINDIVIDUAL->:", individual);
    JSONValue[] res;
    JSONValue   json;

    foreach (individual; individuals)
    {
        json[ "@" ] = individual.uri;
        foreach (property_name, property_values; individual.resources)
        {
            JSONValue[] jsonVals;

            foreach (property_value; property_values)
                jsonVals ~= resource_to_json(cast(Resource)property_value);

            JSONValue resources_json;
            resources_json.array = jsonVals;

            json[ property_name ] = resources_json;
        }
        res ~= json;
    }
//    writeln ("->JSON:", json);
    return res;
}

Individual json_to_individual(ref JSONValue individual_json)
{
    Individual individual = Individual.init;

    try
    {
        //log.trace ("\nJSON->:%s", individual_json);

        foreach (string property_name, property_values; individual_json)
        {
//      writeln ("property_name=",property_name);
            if (property_name == "@")
            {
                individual.uri = property_values.str;
                continue;
            }
            Resource[] resources = Resource[].init;
            foreach (size_t index, property_value; property_values)
                resources ~= json_to_resource(property_value);

            if (resources.length > 0)
                individual.resources[ property_name ] = resources;
        }
        //log.trace ("->INDIVIDUAL:%s", individual);
    }
    catch (Throwable tr)
    {
        stderr.writeln("EX! ", __FILE__, ", line:", __LINE__, ", [", tr.msg, "], in ", individual_json);
    }

    return individual;
}

JSONValue resource_to_json(Resource resource)
{
    JSONValue resource_json;

    string    data = resource.data;

    resource_json[ "type" ] = text(resource.type);

    if (resource.type == DataType.Uri)
    {
        resource_json[ "data" ] = data;
    }
    else if (resource.type == DataType.Binary)
    {
        resource_json[ "data" ] = data;
    }
    else if (resource.type == DataType.String)
    {
        resource_json[ "data" ] = data;
        resource_json[ "lang" ] = text(resource.lang);
    }
    else if (resource.type == DataType.Integer)
    {
        //writeln ("@v #resource.get!long=", resource.get!long);
        resource_json[ "data" ] = resource.get!long;
    }
    else if (resource.type == DataType.Decimal)
    {
        decimal dd = resource.get!decimal;
        resource_json[ "data" ] = dd.asString();
    }
    else if (resource.type == DataType.Boolean)
    {
        if (resource.get!bool == true)
            resource_json[ "data" ] = true;
        else
            resource_json[ "data" ] = false;
    }
    else if (resource.type == DataType.Datetime)
    {
//	writeln ("@v #r->j #1 resource.get!long=", resource.get!long);

        SysTime st = SysTime(unixTimeToStdTime(resource.get!long), UTC());
        resource_json[ "data" ] = st.toISOExtString();

//	writeln ("@v #r->j #2 val=", st.toISOExtString());
    }
    else
        resource_json[ "data" ] = JSONValue.init;

    return resource_json;
}

Resource json_to_resource(JSONValue resource_json)
{
    //writeln ("resource_json=", resource_json);
    Resource resource = Resource.init;

    try
    {
        DataType type;

        if (resource_json[ "type" ].type == JSON_TYPE.INTEGER)
            type = cast(DataType)resource_json.getLong("type");
        else
            type = Resource_type.get(resource_json.getString("type"), DataType.String);

        auto data_type = resource_json[ "data" ].type;

        if (type == DataType.String)
        {
            JSONValue jlang = resource_json.object.get("lang", JSONValue.init);

            if (jlang !is JSONValue.init)
            {
                //writeln ("#1 jlang=", jlang);
                if (jlang.type == JSON_TYPE.STRING)
                    resource.lang = Lang.get(jlang.str, Lang[ "NONE" ]);

                if (jlang.type == JSON_TYPE.INTEGER)
                    resource.lang = cast(LANG)jlang.integer;
            }
            else
            {
                //writeln ("#2 jlang=", jlang);
            }
            resource.data = resource_json.getString("data");
        }
        else if (type == DataType.Boolean)
        {
            if (data_type == JSON_TYPE.TRUE || data_type == JSON_TYPE.FALSE)
            {
                resource = resource_json.getBool("data");
            }
        }
        else if (type == DataType.Uri)
        {
            resource.data = resource_json.getString("data");
        }
        else if (type == DataType.Binary)
        {
            resource.data = resource_json.getString("data");
        }
        else if (type == DataType.Decimal)
        {
            if (data_type == JSON_TYPE.FLOAT)
            {
                resource = decimal(resource_json.getFloat("data"));
            }
            else if (data_type == JSON_TYPE.INTEGER)
            {
                resource = decimal(resource_json.getLong("data"));
            }
            else if (data_type == JSON_TYPE.STRING)
            {
                resource = decimal(resource_json.getString("data"));
            }
        }
        else if (type == DataType.Integer)
        {
            resource = resource_json.getLong("data");
        }
        else if (type == DataType.Datetime)
        {
            string val = resource_json.getString("data");

            long   tm;

            if (val.indexOf('-') >= 1)
                tm = stdTimeToUnixTime(SysTime.fromISOExtString(val).stdTime());
            else
                tm = to!long (val);

            resource = tm;
        }

        resource.type = type;
    }
    catch (Exception ex)
    {
        stderr.writeln("EX! ", __FILE__, ", line:", __LINE__, ", [", ex.msg, "], in ", resource_json);
        throw ex;
    }

    return resource;
}

