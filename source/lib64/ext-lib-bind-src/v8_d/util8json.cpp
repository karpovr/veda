#define _GLIBCXX_USE_CXX11_ABI    0

#include <assert.h>
#include <iostream>
#include <string>
#include <string.h>
#include <math.h>
#include <sstream>
#include <limits>
#include <iomanip>
#include <cstdlib>
#include <cassert>
#include <cstddef>
#include <algorithm>
#include <stdexcept>

#include "util8json.h"

using namespace std;
using namespace v8;

string nullz = "00000000000000000000000000000000";

void double_to_mantissa_exponent(double inp, int64_t *mantissa, int64_t *exponent)
{
    double a     = trunc(inp);
    int    power = 0;

    while (inp - trunc(inp) != 0.0)
    {
        inp *= 10.0;
        power--;
    }

    *mantissa = (int64_t)inp;
    *exponent = power;
}

string exponent_and_mantissa_to_string(long decimal_mantissa_data, long decimal_exponent_data)
{
    string str_res;
    string sign = "";
    string str_mantissa;

    if (decimal_mantissa_data < 0)
    {
        sign         = "-";
        str_mantissa = to_string(decimal_mantissa_data * -1);
    }
    else
        str_mantissa = to_string(decimal_mantissa_data);

    long lh = decimal_exponent_data * -1;

    lh = str_mantissa.length() - lh;
    string slh;

    if (lh >= 0)
    {
        if (lh <= str_mantissa.length())
            slh = str_mantissa.substr(0, lh);
    }
    else
        slh = "";

    string slr;

    if (lh >= 0)
    {
        slr = str_mantissa.substr(lh, str_mantissa.length());
    }
    else
    {
        slr = nullz.substr(0, (-lh)) + str_mantissa;
    }

    string ss;

    if (slr.length() == 0)
    {
        ss = sign + slh;
    }
    else
    {
        if (slh.length() == 0)
            slh = "0";
        ss = sign + slh + "." + slr;
    }

    return ss;
}

bool
jsobject_log(Local<Value> value)
{
    cerr << "!!START LOGGING!!" << endl;
    cerr << "@IS OBJECT " << value->IsObject() << endl;
    Local<Object>         obj = Local<Object>::Cast(value);

    v8::Handle<v8::Array> individual_keys = obj->GetPropertyNames();

    bool                  is_individual_value = false;
    bool                  is_lang_set         = false;

    uint32_t              length = individual_keys->Length();
    for (uint32_t i = 0; i < length; i++)
    {
        v8::Local<v8::Value> js_key        = individual_keys->Get(i);
        std::string          resource_name = std::string(*v8::String::Utf8Value(js_key));
        cerr << "@RESOURCE KEY " << resource_name << endl;

        Local<Value> js_value = obj->Get(js_key);

        if (resource_name == "@")
        {
            std::string uri = std::string(*v8::String::Utf8Value(js_value));
            cerr << "\t@URI DATA " << uri << endl;
            continue;
        }

        cerr << "\t@IS ARRAY " << js_value->IsArray() << endl;
        Local<v8::Array> resources_arr    = Local<v8::Array>::Cast(js_value);
        uint32_t         resources_length = resources_arr->Length();
        cerr << "\t@LENGTH " << resources_length << endl;
        for (uint32_t j = 0; j < resources_length; j++)
        {
            js_value = resources_arr->Get(j);


            if (js_value->IsObject())
            {
                Local<Object>         resource_obj = Local<Object>::Cast(js_value);

                v8::Handle<v8::Array> resource_keys   = resource_obj->GetPropertyNames();
                uint32_t              resource_length = individual_keys->Length();
                // jsobject2individual(js_value, indv, resource, predicate);
                for (uint32_t k = 0; k < resource_length; k++)
                {
                    Local<Value> v_data;
                    Local<Value> v_lang;
                    Local<Value> v_type;
                    js_key = resource_keys->Get(k);
                    std::string  element_name = std::string(*v8::String::Utf8Value(js_key));

                    if (element_name == "data")
                    {
                        cerr << "\t\t\t@ELEMENT KEY " << element_name << endl;
                        // это поле для модели индивида в js
                        v_data = resource_obj->Get(js_key);
                        if (v_data->IsString())
                        {
                            std::string str_data = std::string(*v8::String::Utf8Value(v_data));
                            cerr << "\t\t\t\t@STR DATA " << str_data << endl;
                        }
                    }
                    else if (element_name == "type")
                    {
                        cerr << "\t\t\t@ELEMENT KEY " << element_name << endl;
                        // это поле для модели индивида в js
                        v_type = resource_obj->Get(js_key);
                        cerr << "\t\t\t\t@TYPE " << v_type->ToInteger()->Value() << endl;
                    }
                    else if (element_name == "lang")
                    {
                        cerr << "\t\t\t@ELEMENT KEY " << element_name << endl;
                        // это поле для модели индивида в js
                        v_lang = resource_obj->Get(js_key);
                        cerr << "\t\t\t\t@TYPE " << v_lang->ToInteger()->Value() << endl;
                    }
                }
            }
        }
    }

    cerr << "!!END LOGGING!!\n" << endl;
    return true;
}

template < typename T > std::string to_string( const T& n )
{
        std::ostringstream stm ;
        stm << n ;
        return stm.str() ;
}
    
int64_t to_int(char const *s)
{
     if ( s == NULL || *s == '\0' )
        throw std::invalid_argument("null or empty string argument");

     bool negate = (s[0] == '-');
     if ( *s == '+' || *s == '-' ) 
         ++s;

     if ( *s == '\0')
        throw std::invalid_argument("sign character only.");

     int64_t result = 0;
     while(*s)
     {
          if ( *s >= '0' && *s <= '9' )
          {
              result = result * 10  - (*s - '0');  //assume negative number
          }
          else
              throw std::invalid_argument("invalid input string");
          ++s;
     }
     return negate ? result : -result; //-result is positive!
} 

