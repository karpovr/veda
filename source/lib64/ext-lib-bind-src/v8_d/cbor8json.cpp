#define _GLIBCXX_USE_CXX11_ABI    0

#include <algorithm>
#include "util8json.h"
#include "cbor8json.h"

using namespace std;
using namespace v8;

//  CBOR -> JSON

Handle<Value> cbor2jsobject(Isolate *isolate, string in_str)
{
    Handle<Object> js_map = Object::New(isolate);

    Handle<Value>  f_data = String::NewFromUtf8(isolate, "data");
    Handle<Value>  f_lang = String::NewFromUtf8(isolate, "lang");
    Handle<Value>  f_type = String::NewFromUtf8(isolate, "type");
    const char     *src   = in_str.c_str();

    ElementHeader  header;
    Element        element;

    int            size = in_str.size();

    element.pos = read_type_value(src, 0, size, &header);
    int n_resources = header.v_long;

    //READING @ KEY
    element.pos += read_type_value(src, element.pos, size, &header);
    uint32_t    ep = (uint32_t)(element.pos + header.v_long);
    std::string str(src + element.pos, header.v_long);
    element.pos = ep;

    //READING URI
    element.pos += read_type_value(src, element.pos, size, &header);
    ep           = (uint32_t)(element.pos + header.v_long);
    std::string uri(src + element.pos, header.v_long);
    js_map->Set(String::NewFromUtf8(isolate, "@"), String::NewFromUtf8(isolate, uri.c_str()));
    element.pos = ep;

    for (int i = 1; i < n_resources; i++)
    {
        ElementHeader resource_header;
        element.pos += read_type_value(src, element.pos, size, &resource_header);
        uint32_t      ep = (uint32_t)(element.pos + resource_header.v_long);
        std::string   predicate(src + element.pos, resource_header.v_long);
        element.pos = ep;

        element.pos += read_type_value(src, element.pos, size, &resource_header);

        Handle<Value>         predicate_v8 = String::NewFromUtf8(isolate, predicate.c_str());
        v8::Handle<v8::Array> resources_v8 = v8::Array::New(isolate, 1);
        if (resource_header.type == TEXT_STRING)
        {
            Handle<Object> rr_v8 = Object::New(isolate);

            uint32_t    ep = (uint32_t)(element.pos + resource_header.v_long);
            std::string val(src + element.pos, resource_header.v_long);
            rr_v8->Set(f_data, String::NewFromUtf8(isolate, val.c_str()));
            element.pos = ep;

            if (resource_header.tag == TEXT_RU)
            {
                rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
                rr_v8->Set(f_lang, String::NewFromUtf8(isolate, "RU"));
            }
            else if (resource_header.tag == TEXT_EN)
            {
                rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
                rr_v8->Set(f_lang, String::NewFromUtf8(isolate, "EN"));
            }
            else if (resource_header.tag == URI)
            {
                rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Uri"));
            }
            else
            {
                rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
            }

            resources_v8->Set(0, rr_v8);
        }
        else if (resource_header.type == NEGATIVE_INTEGER || resource_header.type == UNSIGNED_INTEGER)
        {
            Handle<Object> rr_v8 = Object::New(isolate);
            if (resource_header.tag == EPOCH_DATE_TIME)
            {
                rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Datetime"));
                rr_v8->Set(f_data, v8::Date::New(isolate, resource_header.v_long * 1000));
            }
            else
            {
                rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Integer"));
                rr_v8->Set(f_data, v8::Integer::New(isolate, resource_header.v_long));
            }
            resources_v8->Set(0, rr_v8);
        }
        else if (resource_header.type == FLOAT_SIMPLE)
        {
            Handle<Object> rr_v8 = Object::New(isolate);
            if (resource_header.v_long == _TRUE)
                rr_v8->Set(f_data, v8::Boolean::New(isolate, true));
            else if (resource_header.v_long == _FALSE)
                rr_v8->Set(f_data, v8::Boolean::New(isolate, false));

            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Boolean"));
            resources_v8->Set(0, rr_v8);
        }
        else if (resource_header.type == ARRAY)
        {
            if (resource_header.tag == DECIMAL_FRACTION)
            {
                element.pos += read_type_value(src, element.pos, size, &resource_header);
                long decimal_mantissa_data = resource_header.v_long;

                element.pos += read_type_value(src, element.pos, size, &resource_header);
                long decimal_exponent_data = resource_header.v_long;

                string ss = exponent_and_mantissa_to_string(decimal_mantissa_data, decimal_exponent_data);

                Handle<Object> rr_v8 = Object::New(isolate);
                rr_v8->Set(f_data, String::NewFromUtf8(isolate, ss.c_str()));
                rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Decimal"));
                resources_v8->Set(0, rr_v8);
            }
            else
            {
                int n_elems = resource_header.v_long;
                for (int j = 0; j < n_elems; j++)
                {
                    element.pos += read_type_value(src, element.pos, size, &resource_header);
                    if (resource_header.type == TEXT_STRING)
                    {
                        Handle<Object> rr_v8 = Object::New(isolate);

                        uint32_t    ep = (uint32_t)(element.pos + resource_header.v_long);
                        std::string val(src + element.pos, resource_header.v_long);
                        rr_v8->Set(f_data, String::NewFromUtf8(isolate, val.c_str()));
                        element.pos = ep;

                        if (resource_header.tag == TEXT_RU)
                        {
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
                            rr_v8->Set(f_lang, String::NewFromUtf8(isolate, "RU"));
                        }
                        else if (resource_header.tag == TEXT_EN)
                        {
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
                            rr_v8->Set(f_lang, String::NewFromUtf8(isolate, "EN"));
                        }
                        else if (resource_header.tag == URI)
                        {
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Uri"));
                        }
                        else
                        {
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "String"));
                        }

                        resources_v8->Set(j, rr_v8);
                    }
                    else if (resource_header.type == NEGATIVE_INTEGER || resource_header.type == UNSIGNED_INTEGER)
                    {
                        Handle<Object> rr_v8 = Object::New(isolate);
                        if (resource_header.tag == EPOCH_DATE_TIME)
                        {
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Datetime"));
                            rr_v8->Set(f_data, v8::Date::New(isolate, resource_header.v_long * 1000));
                        }
                        else
                        {
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Integer"));
                            rr_v8->Set(f_data, v8::Integer::New(isolate, resource_header.v_long));
                        }
                        resources_v8->Set(j, rr_v8);
                    }
                    else if (resource_header.type == FLOAT_SIMPLE)
                    {
                        Handle<Object> rr_v8 = Object::New(isolate);
                        if (resource_header.v_long == _TRUE)
                            rr_v8->Set(f_data, v8::Boolean::New(isolate, true));
                        else if (resource_header.v_long == _FALSE)
                            rr_v8->Set(f_data, v8::Boolean::New(isolate, false));

                        rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Boolean"));
                        resources_v8->Set(j, rr_v8);
                    }
                    else if (resource_header.type == ARRAY)
                    {
                        if (resource_header.tag == DECIMAL_FRACTION)
                        {
                            element.pos += read_type_value(src, element.pos, size, &resource_header);
                            long decimal_mantissa_data = resource_header.v_long;

                            element.pos += read_type_value(src, element.pos, size, &resource_header);
                            long decimal_exponent_data = resource_header.v_long;

                            string         ss = exponent_and_mantissa_to_string(decimal_mantissa_data, decimal_exponent_data);

                            Handle<Object> rr_v8 = Object::New(isolate);
                            rr_v8->Set(f_data, String::NewFromUtf8(isolate, ss.c_str()));
                            rr_v8->Set(f_type, String::NewFromUtf8(isolate, "Decimal"));
                            resources_v8->Set(j, rr_v8);
                        }
                    }
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

void js_el_2_cbor_el(Local<Object> resource_obj, Handle<Value> f_data, Handle<Value> f_type, Handle<Value> f_lang, std::vector<char> &ou)
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
        string str_data = std::string(*v8::String::Utf8Value(v_data));
        write_type_value(TAG, URI, ou);
        write_string(str_data, ou);
    }
    else if (type == _Boolean)
    {
        bool bool_data = v_data->ToBoolean()->Value();
        write_bool(bool_data, ou);
    }
    else if (type == _Datetime)
    {
        int64_t long_data = v_data->ToInteger()->Value() / 1000;
        write_type_value(TAG, EPOCH_DATE_TIME, ou);
        write_integer(long_data, ou);
    }
    else if (type == _Integer)
    {
        int64_t long_data = v_data->ToInteger()->Value();
        write_integer(long_data, ou);
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

        write_type_value(TAG, DECIMAL_FRACTION, ou);
        write_type_value(ARRAY, 2, ou);
        write_integer(decimal_mantissa_data, ou);
        write_integer(decimal_exponent_data, ou);
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
            write_type_value(TAG, lang + 41, ou);
        write_string(str_data, ou);
    }
}

void jsobject2cbor(Local<Value> value, Isolate *isolate, std::vector<char> &ou)
{
    Local<Object>         obj = Local<Object>::Cast(value);

    v8::Handle<v8::Array> individual_keys = obj->GetPropertyNames();
    Handle<Value>         f_data          = String::NewFromUtf8(isolate, "data");
    Handle<Value>         f_type          = String::NewFromUtf8(isolate, "type");
    Handle<Value>         f_lang          = String::NewFromUtf8(isolate, "lang");

    uint32_t              length = individual_keys->Length();
    MajorType             type   = MAP;
    write_type_value(type, length, ou);
    for (uint32_t i = 0; i < length; i++)
    {
        v8::Local<v8::Value> js_key        = individual_keys->Get(i);
        std::string          resource_name = std::string(*v8::String::Utf8Value(js_key));
        Local<Value>         js_value = obj->Get(js_key);
        if (resource_name == "@")
        {
            write_string(resource_name, ou);
            std::string uri = std::string(*v8::String::Utf8Value(js_value));
            write_string(uri, ou);
            continue;
        }

        write_string(resource_name, ou);

        if (!js_value->IsArray())
        {
            if (js_value->IsObject())
            {
//              {}
                write_type_value(ARRAY, 1, ou);
                Local<Object> resource_obj = Local<Object>::Cast(js_value);
                js_el_2_cbor_el(resource_obj, f_data, f_type, f_lang, ou);
            }
            else
            {
                write_type_value(ARRAY, 0, ou);
            }
            continue;
        }

        Local<v8::Array> resources_arr    = Local<v8::Array>::Cast(js_value);
        uint32_t         resources_length = resources_arr->Length();
        write_type_value(ARRAY, resources_length, ou);

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
                    js_el_2_cbor_el(resource_obj, f_data, f_type, f_lang, ou);
                }
                else
                {
//                  [ [ {} ], [ {} ] ]
                    cerr << "ERR! INVALID JS INDIVIDUAL FORMAT " << endl;
                    jsobject_log(value);
                }
            }
            else
            {
                if (js_value->IsObject())
                {
//             [ {} ]
                    Local<Object> resource_obj = Local<Object>::Cast(js_value);
                    js_el_2_cbor_el(resource_obj, f_data, f_type, f_lang, ou);
                }
                else
                {
                    write_type_value(ARRAY, 0, ou);
                }
            }
        }
    }
}
