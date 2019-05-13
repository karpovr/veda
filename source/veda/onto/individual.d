/**
 * Индивидуал (субьект)
 */
module veda.onto.individual;

private
{
    import std.stdio, std.typecons, std.conv, std.algorithm, std.digest.crc, std.exception : assumeUnique;
    import std.algorithm, std.algorithm.mutation                                           : SwapStrategy;
    import veda.common.type, veda.onto.resource, veda.onto.bj8individual.cbor8individual, veda.onto.bj8individual.msgpack8individual;
    import veda.util.properd;
}
/// Массив индивидуалов
alias Individual[] Individuals;

public enum BOFormat : ubyte
{
    UNKNOWN = 0,
    CBOR    = 1,
    MSGPACK = 2
}

BOFormat binobj_format = BOFormat.UNKNOWN;

public byte[ string ] predicate_2_order;
public string[] predicate_order_l;

/// Индивидуал
public struct Individual
{
    /// URI
    string uri;

    /// Hashmap массивов ресурсов, где ключем является predicate (P из SPO)
    Resources[ string ]    resources;

    private ResultCode rc;
    private CRC32      hash;

    /// Вернуть код ошибки
    public ResultCode  getStatus()
    {
        return rc;
    }

    void setStatus(ResultCode _rc)
    {
        rc = _rc;
    }

    this(string _uri, Resources[ string ] _resources)
    {
        uri       = _uri;
        resources = _resources;
    }

    void reorder(string predicate)
    {
        Resources rss;

        rss = resources.get(predicate, rss);

        if (rss.length == 2)
        {
            if (rss[ 0 ].order > rss[ 1 ].order)
            {
                auto aa = rss[ 0 ].order;
                rss[ 0 ].order         = rss[ 1 ].order;
                rss[ 1 ].order         = aa;
                resources[ predicate ] = rss;
            }
        }
        else if (rss.length > 2)
        {
            auto      rss_sorted = sort!("a.order < b.order", SwapStrategy.stable)(rss);

            Resources new_rss;
            foreach (rr; rss_sorted)
            {
                new_rss ~= rr;
            }
            resources[ predicate ] = new_rss;
        }
    }

    int deserialize(string bin)
    {
        if (bin.length == 0)
            return -1;

        if ((cast(ubyte[])bin)[ 0 ] == 146)
        {
            // this MSGPACK
            return msgpack2individual(this, bin);
        }
        else
        {
            return cbor2individual(&this, bin);
        }
    }

    string serialize()
    {
        if (binobj_format == BOFormat.UNKNOWN)
        {
            binobj_format = BOFormat.CBOR;
            try
            {
                string[ string ] properties;
                properties = readProperties("./veda.properties");
                string s_binobj_format = properties.as!(string)("binobj_format");

                if (s_binobj_format == "cbor")
                    binobj_format = BOFormat.CBOR;

                if (s_binobj_format == "msgpack")
                    binobj_format = BOFormat.MSGPACK;
            }
            catch (Throwable ex)
            {
                stderr.writefln("ERR! unable read ./veda.properties, ex=%s", ex.msg);
            }

            stderr.writefln("SET binobj_format=%s", text(binobj_format));
        }

        if (predicate_2_order.length == 0)
        {
            predicate_order_l =
            [
                "assigned_subsystems", "u_count", "new_type", "prev_type", "new_state", "prev_state", "user_uri", "rdf:type", "v-s:deleted",
                "v-s:isDraftOf", "v-s:actualVersion", "v-s:previousVersion", "v-s:created", "v-s:runAt"
            ];

            foreach (idx, el; predicate_order_l)
                predicate_2_order[ el ] = cast(byte)idx;
        }

        if (binobj_format == BOFormat.CBOR)
            return individual2cbor(&this);
        else if (binobj_format == BOFormat.MSGPACK)
            return individual2msgpack(this);
        else
            return "";
    }

    Individual dup()
    {
        resources.rehash();
        Resources[ string ]    tmp1 = resources.dup;

        Individual result = Individual(uri, tmp1);
        return result;
    }

    Resource getFirstResource(string predicate)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        if (rss.length > 0)
            return rss[ 0 ];

        return Resource.init;
    }

    string getFirstLiteral(string predicate)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        if (rss.length > 0)
            return rss[ 0 ].literal;

        return null;
    }

    long getFirstInteger(string predicate, long default_value = 0)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        if (rss.length > 0 && rss[ 0 ].type == DataType.Integer)
            return rss[ 0 ].get!long;

        return default_value;
    }

    long getFirstDatetime(string predicate, long default_value = 0)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        if (rss.length > 0 && rss[ 0 ].type == DataType.Datetime)
            return rss[ 0 ].get!long;

        return default_value;
    }

    bool getFirstBoolean(string predicate, bool default_value = false)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        if (rss.length > 0 && rss[ 0 ].type == DataType.Boolean)
            return rss[ 0 ].get!bool;

        return default_value;
    }

    void addResource(string uri, Resource rs)
    {
        Resources rss = resources.get(uri, Resources.init);

        rss ~= rs;
        resources[ uri ] = rss;
    }

    void setResources(string uri, Resources in_rss)
    {
        Resources new_rss;

        foreach (in_rs; in_rss)
        {
            new_rss ~= in_rs;
        }

        resources[ uri ] = new_rss;
    }

    void removeResource(string uri)
    {
        resources.remove(uri);
    }

    void removeResources(string uri, Resources in_rss)
    {
        Resources new_rss;

        Resources rss = resources.get(uri, Resources.init);

        foreach (rs; rss)
        {
            bool is_found = false;
            foreach (in_rs; in_rss)
            {
                if (in_rs == rs)
                {
                    is_found = true;
                    break;
                }
            }

            if (is_found != true)
                new_rss ~= rs;
        }

        if (new_rss.length == 0)
            resources.remove(uri);
        else
            resources[ uri ] = new_rss;
    }

    void addUniqueResources(string uri, Resources in_rss)
    {
        Resources new_rss;
        Resources rss = resources.get(uri, Resources.init);

        foreach (rs; rss)
        {
            new_rss ~= rs;
        }

        foreach (in_rs; in_rss)
        {
            bool find = false;
            foreach (rs; rss)
            {
                if (in_rs == rs)
                {
                    find = true;
                    break;
                }
            }
            if (find == false)
                new_rss ~= in_rs;
        }

        resources[ uri ] = new_rss;
    }

    Resources getResources(string predicate)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        return rss;
    }

    bool isExists(T) (string predicate, T object)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        foreach (rs; rss)
        {
            //writeln ("@rs=[", rs.get!string, "] object=[", object, "]");
            if (rs == object)
            {
                //writeln ("@ true");
                return true;
            }
        }
        return false;
    }

    bool anyExists(T) (string predicate, T[] objects)
    {
        Resources rss;

        rss = resources.get(predicate, rss);
        foreach (rs; rss)
        {
            foreach (object; objects)
            {
                if (rs == object)
                    return true;
            }
        }
        return false;
    }

    bool compare(Individual B)
    {
        if (B.resources.length != resources.length)
            return false;

        foreach (key, A_rss; this.resources)
        {
            Resources B_rss = B.resources.get(key, Resources.init);

            if (A_rss.length != B_rss.length)
                return false;

            int count_identical = 0;
            bool[ string ] B_rss_h;

            foreach (B_rs; B_rss)
            {
                B_rss_h[ text(B_rs) ] = true;
            }

            foreach (A_rs; A_rss)
            {
                if (B_rss_h.get(text(A_rs), false) != true)
                    return false;
            }
        }
        return true;
    }

    Individual apply(Individual item)
    {
        Individual res = this.dup();

        if (item.uri != uri)
            return res;

        foreach (key, rss; item.resources)
        {
            Resources new_rss = Resources.init;
            foreach (rs; rss)
            {
                new_rss ~= rs;
            }

            Resources exists_rss = resources.get(key, Resources.init);
            foreach (rs; exists_rss)
            {
                // проверить, чтоб в new_rss, не было rs
                bool rs_found = false;
                foreach (rs1; new_rss)
                {
                    if (rs1 == rs)
                    {
                        rs_found = true;
                        break;
                    }
                }

                if (rs_found == false)
                    new_rss ~= rs;
            }

            res.resources[ key ] = new_rss;
        }

        return res;
    }

    Individual repare_unique(string predicate)
    {
        Resources rdf_type = resources.get(predicate, Resources.init);

        if (rdf_type != Resources.init)
        {
            Individual res = this.dup();

            Resources  new_rss = Resources.init;

            auto       uniq_rdf_type = uniq(rdf_type);

            Resource   rc;
            while (uniq_rdf_type.empty == false)
            {
                rc = uniq_rdf_type.front;
                new_rss ~= rc;
                uniq_rdf_type.popFront;
            }

            res.resources[ predicate ] = new_rss;
            return res;
        }
        return this;
    }

    string get_CRC32()
    {
        string[] predicates = resources.keys;

        predicates.sort();

        hash.start();
        foreach (pp; predicates)
        {
            if (pp != "v-s:hash" && pp != "v-s:updateCounter")
            {
                hash.put(cast(ubyte[])pp);

                foreach (rr; resources[ pp ])
                {
                    hash.put(rr.type);
                    hash.put(cast(ubyte[])rr.asString());
                    hash.put(rr.lang);
                }
            }
        }

        string str_hash = crcHexString(hash.finish());

        return str_hash;
    }

    public long count_values()
    {
        long count;

        foreach (vv; resources.values)
        {
            count += vv.length;
        }
        return count;
    }
}
