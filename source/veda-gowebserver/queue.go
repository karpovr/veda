package main

// Veda queue, read only mode

import (
	"bufio"
	"fmt"
	"hash"
	"hash/crc32"
	"log"
	"os"
	"time"
	"strconv"
	"strings"
)

type QMessageType uint8

const (
	STRING QMessageType = 'S'
	OBJECT QMessageType = 'O'
)

type Mode uint8

const (
	R       Mode = 0
	RW      Mode = 1
	CURRENT Mode = 2
)

const queue_db_path string = "./data/queue"

type Header struct {
	start_pos     uint64
	msg_length    uint32
	magick_marker uint32
	count_pushed  uint32
	crc          [4]uint8
	_type        QMessageType
}

func (ths *Header) from_buff(buff []uint8) {
	pos := 0

	ths.start_pos = ulong_from_buff(buff, pos)
	pos += 8
	ths.msg_length = uint_from_buff(buff, pos)
	pos += 4
	// this magic_marker
	pos += 4
	ths.count_pushed = uint_from_buff(buff, pos)
	pos += 4
	ths._type = QMessageType(buff[pos])
	pos += 1

	ths.crc[0] = buff[pos+0]
	ths.crc[1] = buff[pos+1]
	ths.crc[2] = buff[pos+2]
	ths.crc[3] = buff[pos+3]
}

func (ths *Header) length() uint64 {
	return 8 + 8 + 4 + 1*4 + 1
}

func (ths *Header) toString() string {
	return fmt.Sprintf("header: start_pos=%d, count_pushed=%d , msg_length=%d, CRC=[%d][%d][%d][%d]", ths.start_pos, ths.count_pushed, ths.msg_length, ths.crc[0], ths.crc[1], ths.crc[2], ths.crc[3])
}

var buff []uint8
var header_buff []uint8
var buff1 [1]uint8
var buff4 [4]uint8
var buff8 [8]uint8
var crc [4]uint8

//////////////////////////////////////////// Consumer //////////////////////////////////////////////

type Consumer struct {
	isReady bool
	queue   *Queue
	name    string
	id      uint32

	start_pos_record uint64
	count_popped  uint32
	last_read_msg []uint8
	mode          Mode

	ff_info_pop_w *os.File
	ff_info_pop_r *os.File

	file_name_info_pop string

	// --- tmp ---
	header Header
	hash   hash.Hash32
}

func NewConsumer(_queue *Queue, _name string, _mode Mode) *Consumer {
	p := new(Consumer)
	p.queue = _queue
	p.name = _name
	p.mode = _mode
	p.hash = crc32.NewIEEE()
	return p
}

func (ths *Consumer) open() bool {
	if !ths.queue.isReady {
		ths.isReady = false
		return false
	}

	ths.file_name_info_pop = queue_db_path + "/" + ths.queue.name + "_info_pop_" + ths.name

	var err error

	if ths.mode == RW {
		if _, err = os.Stat(ths.file_name_info_pop); os.IsNotExist(err) {
			ths.ff_info_pop_w, err = os.OpenFile(ths.file_name_info_pop, os.O_CREATE|os.O_RDWR, 0644)
		} else {
			ths.ff_info_pop_w, err = os.OpenFile(ths.file_name_info_pop, os.O_RDWR, 0644)
		}
	}
	if _, err = os.Stat(ths.file_name_info_pop); os.IsNotExist(err) {
		ths.ff_info_pop_w, err = os.OpenFile(ths.file_name_info_pop, os.O_CREATE|os.O_RDWR, 0644)
	} else {
		ths.ff_info_pop_w, err = os.OpenFile(ths.file_name_info_pop, os.O_RDWR, 0644)
	}
	ths.ff_info_pop_r, err = os.OpenFile(ths.file_name_info_pop, os.O_RDONLY, 0644)

	ths.isReady = ths.get_info()

	return ths.isReady
}

func (ths *Consumer) Close() {

	if ths.mode == RW {
		ths.ff_info_pop_w.Sync()
		ths.ff_info_pop_w.Close()
	}

	ths.ff_info_pop_w.Sync()
	ths.ff_info_pop_w.Close()
	ths.ff_info_pop_r.Close()
}

func (ths *Consumer) remove() {
	ths.Close()
	os.Remove(ths.file_name_info_pop)
}

func (ths *Consumer) put_info(is_sync_data bool) bool {
	if !ths.queue.isReady || !ths.isReady || ths.mode != RW {
		return false
	}

	var err error
	_, err = ths.ff_info_pop_w.Seek(0, 0)

	if err == nil {
		_, err = ths.ff_info_pop_w.WriteString(ths.queue.name + ";" + ths.name + ";" + strconv.FormatUint(ths.start_pos_record, 10) + ";" + strconv.FormatUint(uint64(ths.count_popped), 10) + ";" + strconv.FormatUint(uint64(ths.id), 10))

		if err == nil {
			if is_sync_data {
				err = ths.ff_info_pop_w.Sync()
			}
		}
	}

	if err != nil {
			       log.Printf("consumer:put_info [%s;%d;%s;%d;%d] %s\n", ths.queue.name, ths.name, ths.start_pos_record, ths.count_popped, err);
		return false
	}

	return true
}

func (ths *Consumer) get_info() bool {
	if !ths.queue.isReady {
		return false
	}

	var err error

	ths.ff_info_pop_r.Seek(0, 0)
	rr := bufio.NewReader(ths.ff_info_pop_r)
	str, err := Readln(rr)

	if str != "" && err == nil {
		ch := strings.Split(str[0:len(str)], ";")
		if len(ch) != 5 {
			ths.isReady = false
			return false
		}

		_name := ch[0]
		if _name != ths.queue.name {
			log.Printf("consumer:get_info:queue name from info [%s] != consumer.queue.name[%s]", _name, ths.queue.name)
			ths.isReady = false
			return false
		}

		_name = ch[1]
		if _name != ths.name {
			log.Printf("consumer:get_info:consumer name from info[%s] != consumer.name[%s]", _name, ths.name)
			ths.isReady = false
			return false
		}

		nn, err := strconv.ParseInt(ch[2], 10, 0)

		if err != nil {
			ths.isReady = false
			return false
		}

		ths.start_pos_record = uint64(nn)

		nn, err = strconv.ParseInt(ch[3], 10, 0)
		if err != nil {
			ths.isReady = false
			return false
		}

		ths.count_popped = uint32(nn)

		nn, err = strconv.ParseInt(ch[4], 10, 0)
		if err != nil {
			ths.isReady = false
			return false
		}

		ths.id = uint32(nn)
	}

	//log.Printf("get_info:%s", ths)

	return true
}

func (ths *Consumer) pop() string {

	if !ths.queue.isReady || !ths.isReady || ths.mode != RW {
		return ""
	}

	ths.queue.get_info_push(ths.id)

	if ths.count_popped >= ths.queue.count_pushed {

		if ths.queue.id == ths.id {
			ths.queue.get_info_queue()
		}

		if ths.queue.id > ths.id {
			ths.id = ths.id + 1
			ths.queue.id = ths.id
			if ths.queue.get_info_push(ths.id) == false {
				log.Printf("ERR! queue:pop: queue %s not ready", ths.queue.name)
				return ""
			}

			ths.remove()

			ths.count_popped = 0
			ths.start_pos_record = 0

			ths.open()
			ths.put_info(true)
		}

		return ""
	}

	ths.queue.set_r_queue_file(ths.id) 
	ths.queue.ff_queue_r.Seek(int64(ths.start_pos_record), 0)

	ths.queue.ff_queue_r.Read(header_buff)
	ths.header.from_buff(header_buff)

	if ths.header.start_pos != ths.start_pos_record {
		log.Printf("pop:invalid msg: header.start_pos[%d] != start_pos_record[%d] : %v, queue.id : %d, consumer.id : %d\n", ths.header.start_pos, ths.start_pos_record, ths.header, ths.queue.id, ths.id)
		return ""
	}

	if ths.header.msg_length >= uint32(len(buff)) {
		log.Printf("pop:inc buff size %d -> %d", len(buff), ths.header.msg_length)
		buff = make([]uint8, ths.header.msg_length+1)
	}

	if ths.header.msg_length < uint32(len(buff)) {
		ths.queue.ff_queue_r.Read(buff[0:ths.header.msg_length])

		ths.last_read_msg = make([]uint8, ths.header.msg_length)

		copy(ths.last_read_msg, buff[0:ths.header.msg_length])
		if uint32(len(ths.last_read_msg)) < ths.header.msg_length {
			log.Printf("pop:invalid msg: msg.length < header.msg_length : %v\n", ths.header)
			return ""
		}
	} else {
		log.Printf("pop:invalid msg: header.msg_length[%d] < buff.length[%d] : %v\n", ths.header.msg_length, len(buff), ths.header)
		return ""
	}

	return string(ths.last_read_msg)
}

func (ths *Consumer) sync() {

	if ths.mode == RW {
		ths.ff_info_pop_w.Sync()
	}

	ths.ff_info_pop_w.Sync()
}

func (ths *Consumer) commit_and_next(is_sync_data bool) bool {
	if !ths.queue.isReady || !ths.isReady || ths.mode != RW {
		log.Printf("ERR! queue:commit_and_next:!queue.isReady || !isReady || ths.mode != RW")
		return false
	}

	ths.queue.get_info_push(ths.id)

	if ths.count_popped >= ths.queue.count_pushed {
		log.Printf("ERR! queue[%s][%s]:commit_and_next:count_popped(%d) >= queue.count_pushed(%d)", ths.queue.name, ths.name, ths.count_popped,
			ths.queue.count_pushed)
		return false
	}

	header_buff[len(header_buff)-4] = 0
	header_buff[len(header_buff)-3] = 0
	header_buff[len(header_buff)-2] = 0
	header_buff[len(header_buff)-1] = 0

	ths.hash.Reset()
	ths.hash.Write(header_buff)
	ths.hash.Write(ths.last_read_msg)
	hashInBytes := ths.hash.Sum(nil)[:]
	crc[0] = hashInBytes[3]
	crc[1] = hashInBytes[2]
	crc[2] = hashInBytes[1]
	crc[3] = hashInBytes[0]

	if ths.header.crc[0] != crc[0] || ths.header.crc[1] != crc[1] || ths.header.crc[2] != crc[2] || ths.header.crc[3] != crc[3] {
		log.Printf("ERR! queue:commit:invalid msg: fail crc[%s] : %v\n", crc, ths.header)
		log.Printf("hashInBytes=[%d][%d][%d][%d]\n", hashInBytes[0], hashInBytes[1], hashInBytes[2], hashInBytes[3])
		log.Printf("header CRC =[%d][%d][%d][%d]\n", ths.header.crc[0], ths.header.crc[1], ths.header.crc[2], ths.header.crc[3])
		log.Printf("%v\n", len(ths.last_read_msg))
		log.Printf("%v\n", ths.last_read_msg)
                time.Sleep(10000 * time.Millisecond)
		return false
	}

	ths.count_popped++
	ths.start_pos_record += ths.header.length() + uint64(ths.header.msg_length)

	return ths.put_info(is_sync_data)
}

//////////////////////////////////////////// Queue //////////////////////////////////////////////

type Queue struct {
	isReady bool
	name    string
	id      uint32

	right_edge   uint64
	count_pushed uint32
	mode         Mode

	ff_info_push_r  *os.File
	ff_info_queue_r *os.File

	ff_queue_r *os.File

	file_name_info_push  string
	file_name_info_queue string
	file_name_queue      string

	// --- tmp ---
	header Header
	hash   hash.Hash32
}

func NewQueue(_name string, _mode Mode) *Queue {
	p := new(Queue)

	p.name = _name
	p.mode = _mode

	p.isReady = false
	buff = make([]uint8, 4096*100)
	header_buff = make([]uint8, p.header.length())

	p.hash = crc32.NewIEEE()
	return p
}

func (ths *Queue) set_r_queue_file(part_id uint32) {

        if (ths.id != part_id || ths.ff_queue_r == nil) {
            ths.id = part_id;
			part := ths.name + "-" + strconv.FormatUint(uint64(ths.id), 10)
			ths.file_name_queue = queue_db_path + "/" + part + "/" + ths.name + "_queue"

			ths.ff_queue_r, _ = os.OpenFile(ths.file_name_queue, os.O_RDONLY, 0644)
        }
    }

func (ths *Queue) open(_mode Mode) bool {

	if ths.isReady == false {
		if _mode != CURRENT {
			ths.mode = _mode
		}
	}

	//var err error
	//defer log.Printf("ERR! queue, not open: ex: %s", ex.msg);

	//writeln("open ", text (mode));
	if ths.mode != R {
		return false
	}

	ths.isReady = true
	ths.isReady = ths.get_info_queue()

	//part := ths.name + "-" + strconv.FormatUint(uint64(ths.id), 10)
	//ths.file_name_info_push = queue_db_path + "/" + part + "/" + ths.name + "_info_push"
	//ths.file_name_queue = queue_db_path + "/" + part + "/" + ths.name + "_queue"

	//ths.ff_info_push_r, err = os.OpenFile(ths.file_name_info_push, os.O_RDONLY, 0644)

	//if err != nil {
	//	return false
	//}

	//ths.ff_queue_r, err = os.OpenFile(ths.file_name_queue, os.O_RDONLY, 0644)

	//if err != nil {
	//	return false
	//}

	//ths.get_info_push(ths.id)

//	var queue_r_info os.FileInfo

//	queue_r_info, _ = os.Stat(ths.file_name_queue)

//	if ths.mode == R && queue_r_info.Size() < int64(ths.right_edge) || ths.mode == RW && queue_r_info.Size() != int64(ths.right_edge) {
//		ths.isReady = false
//		log.Printf("ERR! queue:open(%v): [%v].size (%d) != right_edge=%v\n", ths.mode, ths.file_name_queue, queue_r_info.Size(), ths.right_edge)
//	} else {
//		ths.isReady = true
		//ths.put_info()
//	}

	return ths.isReady
}

func (ths *Queue) reopen_reader() {
	//var err error

	if ths.ff_queue_r != nil {
		ths.ff_queue_r.Close()
	}

	ths.ff_queue_r = nil
	ths.set_r_queue_file (ths.id)

//	ths.ff_queue_r, err = os.OpenFile(ths.file_name_queue, os.O_RDONLY, 0644)
//	if err != nil {
//		log.Printf("ERR! reopen_reader ths.file_name_queue=%s \n", ths.file_name_queue)
//		ths.isReady = false
//		return
//	}
//	ths.get_info_push(ths.id)
}

func (ths *Queue) get_info_push(part_id uint32) bool {

	if !ths.isReady {
		return false
	}

	var err error

	ths.ff_info_push_r.Close()
	part := ths.name + "-" + strconv.FormatUint(uint64(part_id), 10)
	ths.file_name_info_push = queue_db_path + "/" + part + "/" + ths.name + "_info_push"
	ths.ff_info_push_r, err = os.OpenFile(ths.file_name_info_push, os.O_RDONLY, 0644)
	if err != nil {
		ths.isReady = false
		return false
	}

	ths.ff_info_push_r.Seek(0, 0)

	rr := bufio.NewReader(ths.ff_info_push_r)
	str, err := Readln(rr)

	if str != "" && err == nil {
		ch := strings.Split(str[0:len(str)-1], ";")
		if len(ch) != 4 {
			ths.isReady = false
			return false
		}

		if ch[0] != ths.name {
			ths.isReady = false
			return false
		}
		ths.name = ch[0]

		var right_edge int64
		right_edge, err = strconv.ParseInt(ch[1], 10, 0)

		ths.right_edge = uint64(right_edge)

		var count_pushed int64
		count_pushed, err = strconv.ParseInt(ch[2], 10, 0)

		ths.count_pushed = uint32(count_pushed)
		//string hash_hex = ch[ 4 ];
	}

	return true
}

func (ths *Queue) get_info_queue() bool {
	var err error

	ths.file_name_info_queue = queue_db_path + "/" + ths.name + "_info_queue"
	ths.ff_info_queue_r.Close()
	ths.ff_info_queue_r, err = os.OpenFile(ths.file_name_info_queue, os.O_RDONLY, 0644)
	if err != nil {
		ths.isReady = false
		return false
	}

	ths.ff_info_queue_r.Seek(0, 0)

	rr := bufio.NewReader(ths.ff_info_queue_r)
	str, err := Readln(rr)

	if str != "" && err == nil {
		ch := strings.Split(str[0:len(str)-1], ";")
		if len(ch) != 3 {
			ths.isReady = false
			return false
		}

		if ch[0] != ths.name {
			ths.isReady = false
			return false
		}

		id, _ := strconv.ParseInt(ch[1], 10, 0)
		ths.id = uint32(id)
	}

	return true
}
