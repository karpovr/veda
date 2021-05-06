package main

/*
 #cgo CFLAGS: -I../libvqueueinfo2c
 #cgo LDFLAGS: -L../lib64 -lvqueueinfo2c
 #include <vqueueinfo.h>
*/
import "C"

import (
  "unsafe"
)

type ConsumerInfo struct {
	current_count uint32
	total_count   uint32
}

func get_consumer_info (base_path string, consumer_name string, queue_name string) *ConsumerInfo {
    c_base_path := C.CString(base_path)
    defer C.free(unsafe.Pointer(c_base_path))

    c_consumer_name := C.CString(consumer_name)
    defer C.free(unsafe.Pointer(c_consumer_name))

    c_queue_name := C.CString(queue_name)
    defer C.free(unsafe.Pointer(c_queue_name))

    ci := C.get_info_of_consumer(c_base_path, c_consumer_name, c_queue_name)
    p := new(ConsumerInfo)
    p.current_count = uint32(ci.current_count)
    p.total_count = uint32(ci.total_count)

    return p
}

