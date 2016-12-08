package main

import (
	"github.com/gorilla/websocket"
	"io"
	"io/ioutil"
	"log"
	"strconv"
	"strings"
	"time"
)

type ccusConn struct {
	ready       bool
	ws          *websocket.Conn
	chid        string
	count_2_uid map[string]int
	cc          chan updateInfo
}

func (pc *ccusConn) get_counter_4_uid(uid string) int {
	pc.cc <- updateInfo{uid, 0, -1}
	g_info := <-pc.cc
	//log.Printf("ws[%s]:get_counter_4_uid[%s] %d", pc.ws.RemoteAddr(), uid, g_info.update_counter)
	return g_info.update_counter
}

func (pc *ccusConn) get_last_opid() int {
	pc.cc <- updateInfo{"", -1, 0}
	g_info := <-pc.cc
	//log.Printf("ws[%s]:get_last_opid %d", pc.ws.RemoteAddr(), g_info.opid)
	return g_info.opid
}

func (pc *ccusConn) get_list_of_subscribe() string {
	res := ""

	for i_uid, i_count := range pc.count_2_uid {

		g_count := pc.get_counter_4_uid(i_uid)

		if g_count > i_count {
			i_count := g_count
			if g_count > i_count {
				i_count = g_count
				pc.count_2_uid[i_uid] = i_count
			}

			if len(res) == 0 {
				res = res + i_uid + "=" + strconv.Itoa(i_count)
			} else {
				res = res + "," + i_uid + "=" + strconv.Itoa(i_count)
			}
			pc.count_2_uid[i_uid] = i_count
		}
	}
	return res
}

func (pc *ccusConn) get_list_of_changes() string {
	res := ""

	for i_uid, i_count := range pc.count_2_uid {

		g_count := pc.get_counter_4_uid(i_uid)

		if g_count > i_count {
			i_count := g_count

			if len(res) == 0 {
				res = res + i_uid + "=" + strconv.Itoa(i_count)
			} else {
				res = res + "," + i_uid + "=" + strconv.Itoa(i_count)
			}
			pc.count_2_uid[i_uid] = i_count
		}
	}
	return res
}

const control_Close = 99
const control_Tick = 1
const control_None = 0

func (pc *ccusConn) timer1(timer_control chan int, cc_prepare_in chan string) {
	log.Printf("ws[%s]:spawn timer", pc.ws.RemoteAddr())
	for {
		var control int
		select {
		case control = <-timer_control:
			break
		default:
		}
		if control == control_Close {
			break
		}
		cc_prepare_in <- "T"
		time.Sleep(1000 * time.Millisecond)
		//log.Printf("timer ws[%s], need_close=%b", pc.ws.RemoteAddr(), need_close)
	}
	log.Printf("ws[%s]:close timer", pc.ws.RemoteAddr())
}

func (pc *ccusConn) preparer(cc_control chan int, cc_prepare_in chan string, cc_prepare_out chan string) {
	log.Printf("ws[%s]:spawn preparer", pc.ws.RemoteAddr())

	last_check_opid := 0
	pc.count_2_uid = make(map[string]int)

	for {
		var control int
		select {
		case control = <-cc_control:
			break
		default:
			control = control_None
		}
		if control == control_Close {
			break
		}

		//log.Printf("ws[%s]:control=%d", pc.ws.RemoteAddr(), control)

		var msg = "T"

		if control == control_None {
			msg = <-cc_prepare_in
			//log.Printf("ws[%s]:preparer, recv msg=[%s]", pc.ws.RemoteAddr(), msg)
		}

		if len(msg) == 0 {

			cc_prepare_out <- "Err:invalid message"
			break
		}

		if msg[0] != 'T' {
			log.Printf("ws[%s]:receive msg %s", pc.ws.RemoteAddr(), msg)
		}

		if len(msg) > 3 {
			if pc.ready == false {
				kv := strings.Split(msg, "=")

				if len(kv) == 2 {
					if strings.Compare(kv[0], "ccus") == 0 {
						pc.chid = kv[1]
						log.Printf("ws[%s]:init chanell %s", pc.ws.RemoteAddr(), pc.chid)
					}
				}
				pc.ready = true
				cc_prepare_out <- ""
				continue
			}
		}

		if len(msg) == 1 && msg[0] == 'T' {

		} else if msg[0] == '#' {
			msg_parts := strings.Split(msg, ";")
			if len(msg_parts) == 3 {

				uid := msg_parts[0][1:len(msg_parts[0])]
				update_counter, err := strconv.Atoi(msg_parts[1])
				if err != nil {
					cc_prepare_out <- ""
					continue
				}
				opid, err := strconv.Atoi(msg_parts[2])
				if err != nil {
					cc_prepare_out <- ""
					continue
				}
				ni := updateInfo{uid, opid, update_counter}
				//log.Printf("ws[%s] @2 ni=%s", ni)
				pc.cc <- ni
				cc_prepare_out <- ""

			} else {
				cc_prepare_out <- "Err:invalid message"
			}
			continue

		} else if msg[0] == '=' {

			res := pc.get_list_of_subscribe()

			cc_prepare_out <- "=" + res
		} else if len(msg) == 2 && msg[0] == '-' && msg[1] == '*' {

			pc.count_2_uid = make(map[string]int)

		} else if len(msg) > 3 {
			msg_parts := strings.Split(msg, ",")

			for _, element := range msg_parts {
				expr := strings.Split(element, "=")

				uid_info := ""

				if len(expr) > 0 {
					uid_info = expr[0]
				}

				if len(expr) == 2 {
					if len(uid_info) > 2 {
						uid := uid_info[1:len(uid_info)]
						if uid_info[0] == '+' {
							uid_counter, err := strconv.Atoi(expr[1])
							if err != nil {
								cc_prepare_out <- ""
								continue
							}
							//log.Printf("ws[%s]:receive uid=%s uid_counter=%d", pc.ws.RemoteAddr(), uid, uid_counter)
							pc.count_2_uid[uid] = uid_counter
							g_count := pc.get_counter_4_uid(uid)
							if uid_counter < g_count {
								res := pc.get_list_of_subscribe()

								cc_prepare_out <- res
								last_check_opid = pc.get_last_opid()
							}

						}
					}
				} else if len(expr) == 1 {
					if len(uid_info) > 2 {
						if uid_info[0] == '-' {
							uid := uid_info[1:len(uid_info)]
							delete(pc.count_2_uid, uid)
						}
					}
				}

				//log.Printf("ws[%s]uid_info=%s", pc.ws.RemoteAddr(), uid_info)
			}

		}

		last_opid := pc.get_last_opid()

		if last_check_opid < last_opid {
			res := pc.get_list_of_changes()
			if res != "" {
				err := pc.ws.WriteMessage(websocket.TextMessage, []byte(res))
				if err != nil {
					log.Printf("ERR! NOT SEND: ws[%s] found changes, %s, err=%s", pc.ws.RemoteAddr(), res, err)
					if err == websocket.ErrCloseSent {
						log.Printf("ws[%s] CLOSE", pc.ws.RemoteAddr())
						break
					}
				} else {
					log.Printf("ws[%s]SEND: found changes, %s", pc.ws.RemoteAddr(), res)
				}
			}
			last_check_opid = last_opid
		}
		//log.Printf("ws[%s]:preparer #20", pc.ws.RemoteAddr())
	}
	log.Printf("ws[%s]:close preparer", pc.ws.RemoteAddr())
}

func close_handler(code int, text string) error {
	//log.Printf("call close handler")
	return nil
}

// Receive msg from ws in goroutine
func (pc *ccusConn) receiver() {
	var err1 error
	var bmsg []byte
	var err error
	var messageType int
	var r io.Reader

	ch1 <- 1

	log.Printf("ws[%s]:spawn receiver", pc.ws.RemoteAddr())

	pc.ws.SetCloseHandler(close_handler)

	var ch_prepare_in = make(chan string)
	var ch_prepare_out = make(chan string)
	var ch_preparer_control = make(chan int)
	var ch_timer_control = make(chan int)
	go pc.preparer(ch_preparer_control, ch_prepare_in, ch_prepare_out)
	go pc.timer1(ch_timer_control, ch_prepare_in)

	for true {

		//pc.ws.SetWriteDeadline(time.Now().Add(writeWait))

		messageType, r, err = pc.ws.NextReader()
		if err != nil {
			err1 = err
			break
		}

		if messageType == websocket.CloseMessage {
			//log.Printf("ws[%s]:receive close message", pc.ws.RemoteAddr())
			break
		}

		bmsg, err = ioutil.ReadAll(r)
		if err != nil {
			err1 = err
			break
		}

		msg := string(bmsg)
		//log.Printf("ws[%s]:recv msg=[%s]", pc.ws.RemoteAddr(), msg)
		ch_prepare_in <- msg

		msg = <-ch_prepare_out
		//log.Printf("ret msg=[%s]", msg)

		if msg != "" {
			err := pc.ws.WriteMessage(websocket.TextMessage, []byte(msg))
			if err != nil {
				log.Printf("ws[%s]:reciever, ERR! NOT SEND: msg=[%s], err=%s", pc.ws.RemoteAddr(), msg, err)
				if err == websocket.ErrCloseSent {
					log.Printf("ws[%s]:reciever:CLOSE", pc.ws.RemoteAddr())
					break
				}
			} else {
				log.Printf("ws[%s]:reciever:SEND: msg=[%s]", pc.ws.RemoteAddr(), msg)
			}
		}
	}

	log.Printf("ws[%s]:close receiver, err=%s", pc.ws.RemoteAddr(), err1)

	ch_timer_control <- control_Close
	ch_preparer_control <- control_Close

	ch1 <- (-1)

	pc.ws.Close()
	close(ch_prepare_in)
	close(ch_prepare_out)
	close(ch_preparer_control)
	close(ch_timer_control)
}

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * 60 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 10000 * 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	//pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	//maxMessageSize = 512
)

func NewCcusConn(ws *websocket.Conn, cc chan updateInfo) *ccusConn {

	log.Printf("ws[%s]:new connect %s", ws.RemoteAddr(), ws.LocalAddr())
	ws.SetReadDeadline(time.Now().Add(pongWait))
	ws.SetWriteDeadline(time.Now().Add(writeWait))
	pc := &ccusConn{}
	pc.ws = ws
	pc.cc = cc
	go pc.receiver()

	return pc
}
