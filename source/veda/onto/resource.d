/**
 * Ресурс
 */

module veda.onto.resource;

import std.conv, std.stdio, std.datetime, std.string;
import veda.onto.lang;
import veda.common.type;

alias Resource[] Resources;
alias            Resource[ string ]  MapResource;
Resources        _empty_Resources = Resources.init;

public Resources get_disappeared(ref Resources A, ref Resources B)
{
    Resources delta;

    foreach (rA; A)
    {
        bool is_found = false;
        foreach (rB; B)
        {
            if (rA == rB)
            {
                is_found = true;
                break;
            }
        }

        if (is_found == false)
            delta ~= rA;
    }

    return delta;
}

public void setMapResources(ref Resources rss, ref MapResource hrss)
{
    foreach (rs; rss)
        hrss[ rs.get!string ] = rs;
}

public string[] getAsArrayStrings(ref Resources rss)
{
    string[] res;
    foreach (rs; rss)
        res ~= rs.get!string;
    return res;
}

public bool anyExists(ref MapResource hrss, string object)
{
    if ((object in hrss) !is null)
        return true;
    else
        return false;
}

public bool anyExists(ref MapResource hrss, string[] objects)
{
    foreach (object; objects)
    {
        if ((object in hrss) !is null)
            return true;
    }
    return false;
}

/// Ресурс
struct Resource
{
    /// Тип
    DataType type = DataType.Uri;

    /// InfoByte
    byte     info = -1;

    int      order;

    /// Язык
    LANG     lang = LANG.NONE;

    private {
        void *[ 2 ] m_data;
        ref inout (T)getDataAs(T) () inout { static assert(T.sizeof <= m_data.sizeof); return *cast(inout (T) *)m_data.ptr; }
        @property ref inout (long)m_int() inout { return getDataAs!long (); }
        @property ref inout (decimal)m_decimal() inout { return getDataAs!decimal(); }
        @property ref inout (bool)m_bool() inout { return getDataAs!bool(); }
        @property ref inout (string)m_string() inout { return getDataAs!string(); }
    }
    // /////////////////////////////////////////

    /// Получить содержимое
    @property inout (T)get(T) ()
    inout {
        static if (is (T == bool))
            return m_bool;
        else
        static if (is (T == decimal))
            return m_decimal;
        else
        static if (is (T == long))
            return m_int;
        else
        static if (is (T == ulong))
            return cast(ulong)m_int;
        else
        static if (is (T == string))
            return m_string;
        else
            static assert("Resource can only be casted to (bool, long, double, string. Not " ~ T.stringof ~ ".");
    }

    // /////////////////////////////////////////
    bool opEquals(bool v) const
    {
        return type == DataType.Boolean && m_bool == v;
    }
    bool opEquals(long v) const
    {
        return type == DataType.Integer && m_int == v;
    }
    bool opEquals(decimal v) const
    {
        return type == DataType.Decimal && m_decimal == v;
    }
    bool opEquals(string v) const
    {
        return (type == DataType.String || type == DataType.Uri) && m_string == v;
    }
    bool opEquals(Resource rv) const
    {
        if (type == rv.type)
        {
            if (type == DataType.Boolean)
            {
                return rv.get!bool == m_bool;
            }
            else if (type == DataType.Decimal)
            {
                return rv.get!decimal == m_decimal;
            }
            else if (type == DataType.Integer)
            {
                return rv.get!long == m_int;
            }
            else if (type == DataType.Datetime)
            {
                return rv.get!long == m_int;
            }
            else if (type == DataType.String || type == DataType.Uri)
            {
                return rv.get!string == m_string;
            }
        }

        return false;
    }

    // /////////////////////////////////////////
    bool opAssign(bool v)
    {
        type = DataType.Boolean; m_bool = v; return v;
    }
    int opAssign(int v)
    {
        type = DataType.Integer; m_int = v; return v;
    }
    long opAssign(long v)
    {
        type = DataType.Integer; m_int = v; return v;
    }
    decimal opAssign(decimal v)
    {
        type = DataType.Decimal; m_decimal = v; return v;
    }
    string opAssign(string v)
    {
        type = DataType.String; m_string = v; return v;
    }

    // /////////////////////////////////////////

    /// конструктор
    this(DataType _type, string str, LANG _lang = LANG.NONE)
    {
        if (_type == DataType.Datetime)
        {
            try
            {
                if (str.length == 10 && str[ 4 ] == '-' && str[ 7 ] == '-')
                    str = str ~ "T00:00:00";

                long value = stdTimeToUnixTime(SysTime.fromISOExtString(str, UTC()).stdTime);

                this = value;
            }
            catch (Exception ex)
            {
                writeln("Ex!: ", __FUNCTION__, ":", text(__LINE__), ", ", ex.msg);
            }
        }
        else if (_type == DataType.Integer)
        {
            try
            {
                this = parse!long (str);
            }
            catch (Exception ex)
            {
                writeln("Ex!: ", __FUNCTION__, ":", text(__LINE__), ", ", ex.msg);
            }
        }
        else if (_type == DataType.Boolean)
        {
            try
            {
                this = parse!bool(str);
            }
            catch (Exception ex)
            {
                writeln("Ex!: ", __FUNCTION__, ":", text(__LINE__), ", ", ex.msg);
            }
        }
        else if (_type == DataType.Decimal)
        {
            try
            {
                this = decimal(str);
            }
            catch (Exception ex)
            {
                writeln("Ex!: ", __FUNCTION__, ":", text(__LINE__), ", ", ex.msg);
            }
        }
        else if (_type == DataType.Uri)
        {
            this = str;
        }
        else
        {
            this = str;
            lang = _lang;
        }
        type = _type;
    }

    /// конструктор
    this(string str, LANG _lang = LANG.NONE)
    {
        this = str;
        type = DataType.String;
        lang = _lang;
    }

    /// конструктор
    this(bool val)
    {
        this = val;
        type = DataType.Boolean;
    }

    /// конструктор
    this(decimal val)
    {
        this = val;
        type = DataType.Decimal;
    }

    /// конструктор
    this(ulong val)
    {
        this = cast(long)val;
        type = DataType.Integer;
    }

    /// конструктор
    this(DataType _type, ulong val)
    {
        this = cast(long)val;
        type = _type;
    }

    void toString(scope void delegate(const(char)[]) sink) const
    {
        if (type == DataType.Uri || type == DataType.String)
            sink("(" ~ text(type) ~ ")" ~ get!string());
        else if (type == DataType.Boolean)
            sink("(" ~ text(type) ~ ")" ~ text(get!bool()));
        else if (type == DataType.Datetime)
            sink("(" ~ text(type) ~ ")" ~ SysTime(unixTimeToStdTime(get!long), UTC()).toISOExtString());
        else if (type == DataType.Decimal)
            sink("(" ~ text(type) ~ ")" ~ text(get!decimal()));
        else if (type == DataType.Integer)
            sink("(" ~ text(type) ~ ")" ~ text(get!long ()));
    }

    string asString()
    {
        if (type == DataType.Uri || type == DataType.String)
            return get!string();
        else if (type == DataType.Boolean)
            return text(get!bool());
        else if (type == DataType.Datetime)
        {
            SysTime st = SysTime(unixTimeToStdTime(get!long ()), UTC());
            return st.toISOExtString();
        }
        else if (type == DataType.Decimal)
            return text(get!decimal().asString());
        else if (type == DataType.Integer)
            return text(get!long ());

        return null;
    }

    @property string data()
    {
        return get!string();
    }

    @property void data(string str)
    {
        this = str;
    }

    string literal()
    {
        return get!string();
    }

    string uri()
    {
        if (type == DataType.Uri)
            return m_string;
        else
            return null;
    }

    string prefix()
    {
        if (type == DataType.Uri)
        {
            long pos = m_string.indexOf(':');
            return m_string[ 0..pos ];
        }
        else
            return null;
    }

    void set_uri(string uri)
    {
        type     = DataType.Uri;
        m_string = uri;
    }
}

string getFirstString(Resources rss)
{
    if (rss is null)
        return null;

    if (rss.length == 0)
        return null;

    return rss[ 0 ].get!string;
}

string[] getAsStringArray(Resources rss)
{
    string[] res;

    foreach (rs; rss)
    {
        res ~= rs.data;
    }
    return res;
}

string getAsStringify(Resources rss)
{
    string res = "";

    foreach (rs; rss)
    {
        if (res.length != 0)
            res ~= "," ~ rs.data;
        else
        {
            if (rs.data !is null)
            {
                res ~= rs.asString();
            }
        }
    }
    return res;
}

bool anyExists(Resources rss, string[] objects)
{
    foreach (rs; rss)
    {
        foreach (object; objects)
        {
            if (rs.m_string == object)
                return true;
        }
    }
    return false;
}

bool anyExists(T) (Resources rss, T object)
{
    foreach (rs; rss)
    {
        if (rs == object)
            return true;
    }
    return false;
}

