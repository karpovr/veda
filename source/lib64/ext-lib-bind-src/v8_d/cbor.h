#ifndef CBOR_H
#define CBOR_H

#include <string>
#include <endian.h>
#include <stdint.h>
#include <iostream>
#include <vector>

using namespace std;

/** The CBOR-encoded boolean <code>false</code> value (encoded as "simple value": {@link #MT_SIMPLE}). */
const unsigned char _FALSE = 0x14;

/** The CBOR-encoded boolean <code>true</code> value (encoded as "simple value": {@link #MT_SIMPLE}). */
const unsigned char _TRUE = 0x15;

/** The CBOR-encoded <code>null</code> value (encoded as "simple value": {@link #MT_SIMPLE}). */
const unsigned char _NULL = 0x16;

/** The CBOR-encoded "undefined" value (encoded as "simple value": {@link #MT_SIMPLE}). */
const unsigned char _UNDEFINED = 0x17;

/** Denotes a half-precision float (two-byte IEEE 754, see {@link #MT_FLOAT}). */
const unsigned int _HALF_PRECISION_FLOAT = 0x19;

/** Denotes a single-precision float (four-byte IEEE 754, see {@link #MT_FLOAT}). */
const unsigned int _SINGLE_PRECISION_FLOAT = 0x1a;

/** Denotes a double-precision float (eight-byte IEEE 754, see {@link #MT_FLOAT}). */
const unsigned int _DOUBLE_PRECISION_FLOAT = 0x1b;

/** The CBOR-encoded "break" stop code for unlimited arrays/maps. */
const unsigned int _BREAK = 0x1f;

/** Semantic tag value describing CBOR content. */
const unsigned int _TAG_CBOR_MARKER = 55799;

typedef enum
{
    /** Major type 0: unsigned integers. */
    UNSIGNED_INTEGER     = 0 << 5,

        /** Major type 1: negative integers. */
        NEGATIVE_INTEGER = 1 << 5,

        /** Major type 2: byte string. */
        BYTE_STRING      = 2 << 5,

        /** Major type 3: text/UTF8 string. */
        TEXT_STRING      = 3 << 5,

        /** Major type 4: array of items. */
        ARRAY            = 4 << 5,

        /** Major type 5: map of pairs. */
        MAP              = 5 << 5,

        /** Major type 6: semantic tags. */
        TAG              = 6 << 5,

        /** Major type 7: floating point, simple data types. */
        FLOAT_SIMPLE     = 7 << 5
} MajorType;

typedef enum
{
    NONE                        = 255,

    TEXT_RU                     = 42,

    TEXT_EN                     = 43,

    /** date/time values in the standard format (UTF8 string, RFC3339). */
    STANDARD_DATE_TIME          = 0,

    /** date/time values as Epoch timestamp (numeric, RFC3339). */
    EPOCH_DATE_TIME             = 1,

    /** positive big integer value (byte string). */
    POSITIVE_BIGINT             = 2,

    /** negative big integer value (byte string). */
    NEGATIVE_BIGINT             = 3,

    /** decimal fraction value (two-element array, base 10). */
    DECIMAL_FRACTION            = 4,

    /** big decimal value (two-element array, base 2). */
    BIGDECIMAL                  = 5,

    /** base64url encoding. */
    EXPECTED_BASE64_URL_ENCODED = 21,

    /** base64 encoding. */
    EXPECTED_BASE64_ENCODED     = 22,

    /** base16 encoding. */
    EXPECTED_BASE16_ENCODED     = 23,

    /** encoded CBOR data item (byte string). */
    CBOR_ENCODED                = 24,

    /** URL (UTF8 string). */
    URI                         = 32,

    /** base64url encoded string (UTF8 string). */
    BASE64_URL_ENCODED          = 33,

    /** base64 encoded string (UTF8 string). */
    BASE64_ENCODED              = 34,

    /** regular expression string (UTF8 string, PCRE). */
    REGEXP                      = 35,

    /** MIME message (UTF8 string, RFC2045). */
    MIME_MESSAGE                = 36
} tTag;

struct ElementHeader
{
    MajorType type;
    int64_t   v_long;
    uint8_t   tag;

    ElementHeader () : type(UNSIGNED_INTEGER), v_long(0), tag(NONE){}; 
};


void write_type_value(MajorType type, int64_t value, std::vector<char> &ou);
void write_integer(int64_t vv, std::vector<char> &ou);
void write_string(string vv, std::vector<char> &ou);
void write_bool(bool vv, std::vector<char> &ou);

uint16_t short_from_buff(const char *src, int b_pos, int pos);
uint32_t int_from_buff(const char *src, int b_pos, int pos);
uint64_t long_from_buff(const char *src, int b_pos, int pos);

uint32_t read_type_value(const char *src, int b_pos, int e_pos, ElementHeader *header);

#endif
