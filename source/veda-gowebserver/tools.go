package main

import (
	"bufio"
	"encoding/binary"
	"reflect"
	"unsafe"
)

// #define MP_SOURCE 1
// #include "msgpuck.h"
// import "C"

type CustomDecimal struct {
	Mantissa int64
	Exponent int64
}

func NewCustomDecimal(mantissa int64, exponent int64) CustomDecimal {
	var res CustomDecimal

	res.Mantissa = mantissa
	res.Exponent = exponent

	return res
}

func ulong_to_buff(_buff []uint8, pos int, data uint64) {
	_buff[pos+0] = uint8((data & 0x00000000000000FF))
	_buff[pos+1] = uint8((data & 0x000000000000FF00) >> 8)
	_buff[pos+2] = uint8((data & 0x0000000000FF0000) >> 16)
	_buff[pos+3] = uint8((data & 0x00000000FF000000) >> 24)
	_buff[pos+4] = uint8((data & 0x000000FF00000000) >> 32)
	_buff[pos+5] = uint8((data & 0x0000FF0000000000) >> 40)
	_buff[pos+6] = uint8((data & 0x00FF000000000000) >> 48)
	_buff[pos+7] = uint8((data & 0xFF00000000000000) >> 56)
}

func uint_to_buff(_buff []uint8, pos int, data uint32) {
	_buff[pos+0] = uint8((data & 0x000000FF))
	_buff[pos+1] = uint8((data & 0x0000FF00) >> 8)
	_buff[pos+2] = uint8((data & 0x00FF0000) >> 16)
	_buff[pos+3] = uint8((data & 0xFF000000) >> 24)
}

func uint_from_buff(buff []uint8, pos int) uint32 {
	num := binary.LittleEndian.Uint32(buff[pos : pos+8])
	return uint32(num)
}

func ulong_from_buff(buff []uint8, pos int) uint64 {
	num := binary.LittleEndian.Uint64(buff[pos : pos+8])
	return num
}

// Readln returns a single line (without the ending \n)
// from the input buffered reader.
// An error is returned iff there is an error with the
// buffered reader.
func Readln(r *bufio.Reader) (string, error) {
	var (
		isPrefix bool  = true
		err      error = nil
		line, ln []byte
	)
	for isPrefix && err == nil {
		line, isPrefix, err = r.ReadLine()
		ln = append(ln, line...)
	}
	return string(ln), err
}

func CopyString(s string) string {
	var b []byte
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))
	h.Data = (*reflect.StringHeader)(unsafe.Pointer(&s)).Data
	h.Len = len(s)
	h.Cap = len(s)
	return string(b)
}

