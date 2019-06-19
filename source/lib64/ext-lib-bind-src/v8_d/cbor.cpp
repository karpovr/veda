#define _GLIBCXX_USE_CXX11_ABI 0

#include "cbor.h"

#include <string.h>
#include <iostream>
#include "v8stdint.h"
#include <stdio.h>
#include <ctype.h>

using namespace std;

void write_type_value(MajorType type, int64_t value, std::vector<char> &ou)
{
    uint8_t element_header = 0;

    if (value < 24)
    {
        uint8_t ll = (uint8_t)value;
        element_header = type | ll;
        ou.push_back(element_header);
    }
    else
    {
        if (value > 4294967295)
        {
            element_header = type | 27;
            ou.push_back(element_header);
            ou.push_back(value &  0x00000000000000ff);
            ou.push_back((value & 0x000000000000ff00) >> 8);
            ou.push_back((value & 0x0000000000ff0000) >> 16);
            ou.push_back((value & 0x00000000ff000000) >> 24);
            ou.push_back((value & 0x000000ff00000000) >> 32);
            ou.push_back((value & 0x0000ff0000000000) >> 40);
            ou.push_back((value & 0x00ff000000000000) >> 48);
            ou.push_back((value & 0xff00000000000000) >> 56);
        }
        else if (value > 65535)
        {
            element_header = type | 26;
            ou.push_back(element_header);
            ou.push_back(value &  0x000000ff);
            ou.push_back((value & 0x0000ff00) >> 8);
            ou.push_back((value & 0x00ff0000) >> 16);
            ou.push_back((value & 0xff000000) >> 24);
        }
        else if (value > 255)
        {
            element_header = type | 25;
            ou.push_back(element_header);
            ou.push_back(value & 0xff);
            ou.push_back(value >> 8);
        }
        else
        {
            element_header = type | 24;
            ou.push_back(element_header);
            ou.push_back((uint8_t)value);
        }
    }
}


void write_integer(int64_t vv, std::vector<char> &ou)
{
    if (vv > 0)
        write_type_value(UNSIGNED_INTEGER, vv, ou);
    else
        write_type_value(NEGATIVE_INTEGER, -vv, ou);
}

void write_string(string vv, std::vector<char> &ou)
{
    write_type_value(TEXT_STRING, (uint64_t)vv.size(), ou);
    ou.insert(ou.end(), vv.begin(), vv.end());
}

void write_bool(bool vv, std::vector<char> &ou)
{
    if (vv == true)
        write_type_value(FLOAT_SIMPLE, _TRUE, ou);
    else
        write_type_value(FLOAT_SIMPLE, _FALSE, ou);
}

uint16_t ubyte_from_buff(const char *buff, int b_pos, int pos)
{
    uint8_t res = *(((uint8_t *)(buff + b_pos + pos)));

    return res;
}

uint16_t ushort_from_buff(const char *buff, int b_pos, int pos)
{
    uint16_t res = *(((uint16_t *)(buff + b_pos + pos)));

    return res;
}

uint32_t uint_from_buff(const char *buff, int b_pos, int pos)
{
    uint32_t res = *(((uint32_t *)(buff + b_pos + pos)));

    return res;
}

uint64_t ulong_from_buff(const char *buff, int b_pos, int pos)
{
    uint64_t res = *(((uint64_t *)(buff + b_pos + pos)));

    return res;
}


uint32_t read_type_value(const char *src, int b_pos, int e_pos, ElementHeader *header)
{
    uint8_t hh = (uint8_t)src[ b_pos + 0 ];

    MajorType type = (MajorType)(hh & 0xe0);

    int64_t   ld    = hh & 0x1f;
    int       d_pos = 1;

    if (ld > 23)
    {
        d_pos += 1 << (ld - 24);
        if (ld == 24)
            ld = ubyte_from_buff(src, b_pos, 1);
        else if (ld == 25)
            ld = ushort_from_buff(src, b_pos, 1);
        else if (ld == 26)
            ld = uint_from_buff(src, b_pos, 1);
        else if (ld == 27)
            ld = ulong_from_buff(src, b_pos, 1);
    }

    if (type == TAG)
    {
        ElementHeader main_type_header;
        d_pos         += read_type_value(src, b_pos + d_pos, e_pos, &main_type_header);
        header->tag    = (uint8_t)ld;
        header->v_long = main_type_header.v_long;
        header->type   = main_type_header.type;
    }
    else
    {
        if (type == NEGATIVE_INTEGER)
        {
            ld = -ld;
        }
        else if ((type == ARRAY || type == TEXT_STRING) && ld > e_pos)
        {
            std::cout << "Err! @c cbor.read_header ld=" << ld << std::endl;
            ld = e_pos;
        }
        header->v_long = ld;
        header->type   = type;
    }

    return d_pos;
}
