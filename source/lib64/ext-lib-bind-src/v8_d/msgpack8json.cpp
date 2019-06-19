#define _GLIBCXX_USE_CXX11_ABI    0

#include <iostream>
#include <algorithm>
#include "msgpuck.h"
#include "util8json.h"
#include "msgpack8json.h"

using namespace std;
using namespace v8;

//  MSGPACK -> JSON

char buf[ 1024 * 1024 ];

Handle<Value> msgpack2jsobject(Isolate *isolate, string in_str)
{
    const char     *sval;
    uint32_t       sval_len;
    mp_type        type;

    Handle<Object> js_map = Object::New(isolate);

    Handle<Value>  f_data  = String::NewFromUtf8(isolate, "data");
    Handle<Value>  f_lang  = String::NewFromUtf8(isolate, "lang");
    Handle<Value>  f_type  = String::NewFromUtf8(isolate, "type");
    const char     *binobj = in_str.c_str();

    Element  element;
    string   uri;

    uint32_t size = mp_decode_array(&binobj);

    if (size != 2)
        return js_map;

    type = mp_typeof(*binobj);
    if (type == MP_NIL)
        mp_decode_nil(&binobj);
    else
    {
        sval = mp_decode_str(&binobj, &sval_len);
        uri  = string(sval, sval_len);
    }

    js_map->Set(String::NewFromUtf8(isolate, "@"), String::NewFromUtf8(isolate, uri.c_str()));

    uint32_t map_size = mp_decode_array(&binobj);

    for (int i = 0; i < map_size; i++)
    {
        type = mp_typeof(*binobj);
        if (type != MP_STR)
        {
            return Object::New(isolate);
        }

        sval = mp_decode_str(&binobj, &sval_len);

        uint32_t              values_size = mp_decode_array(&binobj);

        std::string           predicate(sval, sval_len);
        Handle<Value>         predicate_v8 = String::NewFromUtf8(isolate, predicate.c_str());
        v8::Handle<v8::Array> resources_v8 = v8::Array::New(isolate, 1);

        for (int j = 0; j < values_size; j++)
        {
            type = mp_typeof(*binobj);

            switch (type)
            {
            case MP_ARRAY:
                {
                    uint32_t value_struct_size = mp_decode_array(&binobj);

                    if (value_struct_size == 2)
                    {
                        uint64_t value_type = mp_decode_uint(&binobj);

                        if (value_type == _Datetime)
                        {
                            Handle<Object> rr_v8 = Object::New(isolate);

                            type = mp_typeof(*binobj);

                            int64_t value;

                            if (type == MP_INT)
                                value = mp_decode_int(&binobj);
                            else if (type == MP_UINT)
                                value = mp_decode_uint(&binobj);

                            rr_v8->Set(f_data, v8::Date::New(isolate, value * 1000));

                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Datetime"));
                            resources_v8->Set(j, rr_v8);
                        }
                        else if (value_type == _String)
                        {
                            Handle<Object> rr_v8 = Object::New(isolate);

                            mp_type        value_el_type = mp_typeof(*binobj);

                            if (value_el_type == MP_STR)
                            {
                                sval = mp_decode_str(&binobj, &sval_len);

                                string val = string(sval, sval_len);
                                rr_v8->Set(f_data, String::NewFromUtf8(isolate, val.c_str()));
                            }
                            else if (value_el_type == MP_NIL)
                            {
                                mp_decode_nil(&binobj);
                                string val = "";
                                rr_v8->Set(f_data, String::NewFromUtf8(isolate, val.c_str()));
                            }
                            else
                            {
                                mp_next(&binobj);
                                return Object::New(isolate);
                            }

                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
                            resources_v8->Set(j, rr_v8);
                        }
                        else if (value_type == _Uri)
                        {
							Handle<Object> rr_v8 = Object::New(isolate);

							sval = mp_decode_str(&binobj, &sval_len);
							string val = string(sval, sval_len);
							rr_v8->Set(f_data, String::NewFromUtf8(isolate, val.c_str()));
							rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Uri"));
							resources_v8->Set(j, rr_v8);							
						}	
                        else if (value_type == _Integer)
                        {
                            Handle<Object> rr_v8 = Object::New(isolate);

                            type = mp_typeof(*binobj);

                            int64_t value;

                            if (type == MP_INT)
                                value = mp_decode_int(&binobj);
                            else if (type == MP_UINT)
                                value = mp_decode_uint(&binobj);

							rr_v8->Set(f_data, v8::Integer::New(isolate, value));
							rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Integer"));
							resources_v8->Set(j, rr_v8);
						}	
                        else if (value_type == _Boolean)
                        {
							Handle<Object> rr_v8 = Object::New(isolate);

							bool           value = mp_decode_bool(&binobj);
							rr_v8->Set(f_data, v8::Boolean::New(isolate, value));
							rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Boolean"));
							resources_v8->Set(j, rr_v8);							
						}	
                        else
                        {
                            std::cerr << "ERR! MSGPACK->JS ??? value_type=" << value_type << endl;
                            return Object::New(isolate);
                        }
                    }
                    else if (value_struct_size == 3)
                    {
                        uint64_t value_type = mp_decode_uint(&binobj);
                        if (value_type == _Decimal)
                        {
                            int64_t mantissa, exponent;

                            mp_type value_el_type = mp_typeof(*binobj);
                            if (value_el_type == MP_INT)
                                mantissa = mp_decode_int(&binobj);
                            else if (value_el_type == MP_UINT)
                                mantissa = mp_decode_uint(&binobj);

                            value_el_type = mp_typeof(*binobj);
                            if (value_el_type == MP_INT)
                                exponent = mp_decode_int(&binobj);
                            else if (value_el_type == MP_UINT)
                                exponent = mp_decode_uint(&binobj);

                            string ss = exponent_and_mantissa_to_string(mantissa, exponent);

                            Handle<Object> rr_v8 = Object::New(isolate);
                            rr_v8->Set(f_data, String::NewFromUtf8(isolate, ss.c_str()));

                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Decimal"));
                            resources_v8->Set(j, rr_v8);
                        }
                        else if (value_type == _String)
                        {
                            Handle<Object> rr_v8 = Object::New(isolate);

                            mp_type        value_el_type = mp_typeof(*binobj);

                            if (value_el_type == MP_STR)
                            {
                                sval = mp_decode_str(&binobj, &sval_len);

                                string val = string(sval, sval_len);
                                rr_v8->Set(f_data, String::NewFromUtf8(isolate, val.c_str()));
                            }
                            else if (value_el_type == MP_NIL)
                            {
                                string val = "";
                                mp_decode_nil(&binobj);
                                rr_v8->Set(f_data, String::NewFromUtf8(isolate, val.c_str()));
                            }
                            else
                            {
                                mp_next(&binobj);
                                std::cerr << "ERR! NOT A STRING IN RESOURCE ARRAY 2" << endl;
                                return Object::New(isolate);
                            }

                            uint64_t lang = mp_decode_uint(&binobj);

                            if (lang == LANG_RU)
                                rr_v8->Set(f_lang, String::NewFromUtf8(isolate, "RU"));
                            else if (lang == LANG_EN)
                                rr_v8->Set(f_lang, String::NewFromUtf8(isolate, "EN"));

                            resources_v8->Set(j, rr_v8);
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
                        }
                        else
                        {
                            return Object::New(isolate);
                        }
                    }
                    else
                    {
                        std::cerr << "ERR! MSGPACK->JS other ARRAY size, value_struct_size=" << value_struct_size << endl;
                        return Object::New(isolate);
                    }
                    break;
                }

            default:
                {
                    std::cerr << "@ERR! UNSUPPORTED RESOURCE TYPE " << type << endl;
                    return Object::New(isolate);
                }
            }
        }

        if (resources_v8->Length() > 0)
        {
            js_map->Set(predicate_v8, resources_v8);
        }
    }

    return js_map;
}

//  JSON -> MSGPACK


char *js_el_2_msgpack_el(Local<Object> resource_obj, Handle<Value> f_data, Handle<Value> f_type, Handle<Value> f_lang, char *bptr)
{
    Local<Value> v_data = resource_obj->Get(f_data);
    Local<Value> v_type = resource_obj->Get(f_type);

    int          type = 2;

    if (v_type->IsString())
    {
        string s_type = std::string(*v8::String::Utf8Value(v_type));

        if (s_type.compare("Uri") == 0)
            type = 1;
        else if (s_type.compare("String") == 0)
            type = 2;
        else if (s_type.compare("Integer") == 0)
            type = 4;
        else if (s_type.compare("Datetime") == 0)
            type = 8;
        else if (s_type.compare("Decimal") == 0)
            type = 32;
        else if (s_type.compare("Boolean") == 0)
            type = 64;
    }
    else
        type = v_type->ToInteger()->Value();

    if (type == _Uri)
    {
        bptr = mp_encode_array(bptr, 2);
        bptr = mp_encode_uint(bptr, (uint)_Uri);
        string str_data = std::string(*v8::String::Utf8Value(v_data));
        bptr = mp_encode_str(bptr, str_data.c_str(), str_data.size());
    }
    else if (type == _Boolean)
    {
        bptr = mp_encode_array(bptr, 2);
        bptr = mp_encode_uint(bptr, (uint)_Boolean);
        bool bool_data = v_data->ToBoolean()->Value();
        bptr = mp_encode_bool(bptr, bool_data);
    }
    else if (type == _Datetime)
    {
        bptr = mp_encode_array(bptr, 2);
        bptr = mp_encode_uint(bptr, (uint)_Datetime);
        int64_t long_data = v_data->ToInteger()->Value() / 1000;
        bptr = mp_encode_int(bptr, long_data);
    }
    else if (type == _Integer)
    {
        bptr = mp_encode_array(bptr, 2);
        bptr = mp_encode_uint(bptr, (uint)_Integer);
        int64_t long_data = v_data->ToInteger()->Value();
        bptr = mp_encode_int(bptr, long_data);
    }
    else if (type == _Decimal)
    {
        int64_t decimal_mantissa_data, decimal_exponent_data;
        if (v_data->IsString())
        {
            v8::String::Utf8Value s1_1(v_data);
            std::string           num = std::string(*s1_1);

            int pos = num.find('.');
            if (pos < 0)
                pos = num.find(',');

            if (pos > 0)
            {
                string ll = num.substr(0, pos);
                string rr = num.substr(pos + 1, num.length());

                size_t sfp = rr.length();

                decimal_mantissa_data = to_int((ll + rr).c_str());
                decimal_exponent_data = -sfp;
            }
            else
            {
                decimal_mantissa_data = to_int(num.c_str());
                decimal_exponent_data = 0;
            }
        }
        else
        {
            double dd = v_data->ToNumber()->Value();
            double_to_mantissa_exponent(dd, &decimal_mantissa_data, &decimal_exponent_data);
        }

        bptr = mp_encode_array(bptr, 3);
        bptr = mp_encode_uint(bptr, (uint)_Decimal);
        bptr = mp_encode_int(bptr, decimal_mantissa_data);
        bptr = mp_encode_int(bptr, decimal_exponent_data);
    }
    else if (type == _String)
    {
        Local<Value> v_lang = resource_obj->Get(f_lang);
        int          lang;

        if (v_lang->IsString())
        {
            string s_lang = std::string(*v8::String::Utf8Value(v_lang));
            std::transform(s_lang.begin(), s_lang.end(), s_lang.begin(), ::toupper);

            if (s_lang.compare("RU") == 0)
                lang = LANG_RU;
            else if (s_lang.compare("EN") == 0)
                lang = LANG_EN;
            else
                lang = LANG_NONE;
        }
        else
        {
            lang = v_lang->ToInteger()->Value();
        }

        string str_data = std::string(*v8::String::Utf8Value(v_data));

        if (lang != LANG_NONE)
        {
            bptr = mp_encode_array(bptr, 3);
            bptr = mp_encode_uint(bptr, (uint)_String);
            bptr = mp_encode_str(bptr, str_data.c_str(), str_data.size());
            bptr = mp_encode_uint(bptr, (uint)lang);
        }
        else
        {
            bptr = mp_encode_array(bptr, 2);
            bptr = mp_encode_uint(bptr, (uint)_String);
            bptr = mp_encode_str(bptr, str_data.c_str(), str_data.size());
        }
    }

    return bptr;
}

void jsobject2msgpack(Local<Value> value, Isolate *isolate, std::vector<char> &ou)
{
    cerr << "JS->MSGPACK" << endl;

    char                  *bptr = buf;

    Local<Object>         obj = Local<Object>::Cast(value);

    v8::Handle<v8::Array> individual_keys = obj->GetPropertyNames();
    Handle<Value>         f_data          = String::NewFromUtf8(isolate, "data");
    Handle<Value>         f_type          = String::NewFromUtf8(isolate, "type");
    Handle<Value>         f_lang          = String::NewFromUtf8(isolate, "lang");

    uint32_t              length = individual_keys->Length();
    std::string           uri;

    for (uint32_t i = 0; i < length; i++)
    {
        v8::Local<v8::Value> js_key        = individual_keys->Get(i);
        std::string          resource_name = std::string(*v8::String::Utf8Value(js_key));
        Local<Value>         js_value = obj->Get(js_key);
        if (resource_name == "@")
        {
            uri = std::string(*v8::String::Utf8Value(js_value));
            cerr << "JS->MSGPACK uri=" << uri << endl;

            break;
        }
    }

    bptr = mp_encode_array(bptr, 2);
    bptr = mp_encode_str(bptr, uri.c_str(), uri.size());
    bptr = mp_encode_map(bptr, length);

    for (uint32_t i = 0; i < length; i++)
    {
        v8::Local<v8::Value> js_key        = individual_keys->Get(i);
        std::string          resource_name = std::string(*v8::String::Utf8Value(js_key));

        Local<Value>         js_value = obj->Get(js_key);
        if (resource_name == "@")
            continue;

        bptr = mp_encode_str(bptr, resource_name.c_str(), resource_name.size());

        if (!js_value->IsArray())
        {
            if (js_value->IsObject())
            {
                //              {}
                bptr = mp_encode_array(bptr, 1);
                Local<Object> resource_obj = Local<Object>::Cast(js_value);
                bptr = js_el_2_msgpack_el(resource_obj, f_data, f_type, f_lang, bptr);
            }
            else
            {
                bptr = mp_encode_array(bptr, 0);
            }
            continue;
        }

        Local<v8::Array> resources_arr    = Local<v8::Array>::Cast(js_value);
        uint32_t         resources_length = resources_arr->Length();

        bptr = mp_encode_array(bptr, resources_length);

        for (uint32_t j = 0; j < resources_length; j++)
        {
            js_value = resources_arr->Get(j);

            if (js_value->IsArray())
            {
                //             [ [ {} ] ]

                Local<v8::Array> resources_in_arr    = Local<v8::Array>::Cast(js_value);
                uint32_t         resources_in_length = resources_in_arr->Length();

                if (resources_in_length == 1)
                {
                    js_value = resources_in_arr->Get(0);

                    Local<Object> resource_obj = Local<Object>::Cast(js_value);
                    bptr = js_el_2_msgpack_el(resource_obj, f_data, f_type, f_lang, bptr);
                }
                else
                {
                    //                  [ [ {} ], [ {} ] ]
                    jsobject_log(value);
                }
            }
            else
            {
                if (js_value->IsObject())
                {
                    //             [ {} ]
                    Local<Object> resource_obj = Local<Object>::Cast(js_value);
                    bptr = js_el_2_msgpack_el(resource_obj, f_data, f_type, f_lang, bptr);
                }
                else
                {
                    //jsobject_log(value);

                    bptr = mp_encode_array(bptr, 0);
                }
            }
        }
    }

    ou.insert(ou.end(), buf, bptr);
}
