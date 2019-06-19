package main

import (
	"encoding/hex"
	"fmt"
	"hash/crc32"
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"strings"
)

//MInfo struct reoresents module info
type MInfo struct {
	//Module name
	Name string
	//Operation id
	OpID int64
	//Commited operation id
	CommittedOpID int64
	//Result of getting info
	IsOk bool
}

//OpenMode is reader/writeer modes
type OpenMode uint8

//Module is moudile id
type Module int32

const (
	//Reader mode is read only
	Reader OpenMode = 1
	//Writer is write only
	Writer OpenMode = 2
	//ReaderWriter is both read and write
	ReaderWriter OpenMode = 3
)

const (
	//subject_manager module id
	subject_manager Module = 1

	//acl_preparer module id for rights indexing
	acl_preparer Module = 2

	//fulttext_indexer module id
	fulltext_indexer Module = 4

	//fanout_email module id
	fanout_email Module = 8

	//scripts_main module id, execution of sctipts with normal priority
	scripts_main Module = 16

	//ticket_manager module id, gives and check tickets
	ticket_manager Module = 32

	//file_reader module id, uploading of files
	file_reader Module = 64

	//fanout_sql_np module_id, stores to sql, high priority execution
	fanout_sql_np Module = 128

	//scripts_lp module id, execution scripts, low priority
	scripts_lp Module = 256

	//ltr_scripts moule id, long time run scripts
	ltr_scripts Module = 512

	//fanaout_sql_lp module id, stores to sql in  low priority
	fanout_sql_lp Module = 1024

	//statistic_data_accumulator module id, gather statistics
	statistic_data_accumulator Module = 2048

	//commiter module id, saves inmemory data
	commiter Module = 4096

	//print_statistics module id, print statistics
	print_statistic Module = 8192

	//n_channel module id
	n_channel Module = 16384

	//webserver module id
	webserver Module = 32768
)

const (
	maxModuleInfoFileSize = 1024
)

//ModuleTo string gets module id and returns string representation
func ModuleToString(module Module) string {
	switch module {

	case subject_manager:
		return "subject_manager"

	case acl_preparer:
		return "acl_preparer"

	case fulltext_indexer:
		return "fulltext_indexer"

	case fanout_email:
		return "fanout_email"

	case scripts_main:
		return "scripts_main"

	case ticket_manager:
		return "ticket_manager"

	case file_reader:
		return "file_reader"

	case fanout_sql_np:
		return "fanout_sql_np"

	case scripts_lp:
		return "scripts_lp"

	case ltr_scripts:
		return "ltr_scripts"

	case fanout_sql_lp:
		return "fanout_sql_lp"
	}

	return fmt.Sprintf("unknown %v", module)
}

//ModuleInfoFile struct representing file with module info
type ModuleInfoFile struct {
	fnModuleInfo  string
	ffModuleInfoW *os.File
	ffModuleInfoR *os.File
	moduleName    string
	isWriterOpen  bool
	isReaderOpen  bool
	buff          []byte
	mode          OpenMode
	isReady       bool
	crc           [4]byte
	CRC32         uint32
}

var moduleInfoPath = "./data/module-info"

//NewModuleInfoFile creates new file for given module with given OpenMode
func NewModuleInfoFile(moduleName string, mode OpenMode) *ModuleInfoFile {
	//Creating module info with given parametrs
	mif := new(ModuleInfoFile)
	mif.moduleName = moduleName
	mif.fnModuleInfo = moduleInfoPath + "/" + moduleName + "_info"
	mif.mode = mode

	if mode == Writer || mode == ReaderWriter {
		//If mode is Writer or ReaderWriter check if lock exists
		_, err := os.Stat(mif.fnModuleInfo + ".lock")
		if err == nil {
			//If no lock then component is opened already or old file was not deleted
			log.Printf("ERR! Veda not started: component [%s] already open, or not deleted lock file\n",
				mif.fnModuleInfo)
			return nil
		}
	}

	mif.isReady = true

	return mif
}

//IsLock checks lock existence for given module
func IsLock(moduleName string) bool {
	_, err := os.Stat(moduleInfoPath + "/" + moduleName + "_info.lock")
	if err == nil {
		return true
	}

	return false
}

//IsReady checks if module is ready
func (mif *ModuleInfoFile) IsReady() bool {
	return mif.isReady
}

//openWriter for Module info
func (mif *ModuleInfoFile) openWriter() bool {
	//If mode is Reader than return false
	if mif.mode != Writer && mif.mode != ReaderWriter {
		return false
	}

	//Create lock for module
	ioutil.WriteFile(mif.fnModuleInfo+".lock", []byte("0"), 0666)

	//Check module info file existence
	_, err := os.Stat(mif.fnModuleInfo)
	if os.IsNotExist(err) {
		//If not exists than create module info file
		mif.ffModuleInfoW, err = os.Create(mif.fnModuleInfo)
		if err != nil {
			log.Println("ERR! CREATING ffModuleInfoW: ", err)
			return false
		}
		mif.isWriterOpen = true

		return true
	} else if err == nil {
		//If exists then open module info file
		mif.ffModuleInfoW, err = os.OpenFile(mif.fnModuleInfo, os.O_RDWR, 0666)
		if err != nil {
			log.Println("ERR! OPENING ffModuleInfoW: ", err)
			return false
		}
		return true
	}

	return false
}

func (mif *ModuleInfoFile) removeLock() {
	//If mode is Reader just return
	if mif.mode != Writer && mif.mode != ReaderWriter {
		return
	}

	//Remove lock for given module
	err := os.Remove(mif.fnModuleInfo + ".lock")
	if err == nil {
		log.Printf("module_info:remove lock file %s\n", mif.fnModuleInfo+".lock")
	} else {
		log.Println("ERR! DELETING LOCK ", err)
	}
}

//close function close module info file
func (mif *ModuleInfoFile) close() {
	//If mode is Reader and file is opened close file ffModuleInfoR if opened
	if mif.mode == Reader && mif.ffModuleInfoR != nil {
		mif.ffModuleInfoR.Close()
	}

	//If mode is Reader or ReaderWriter and file is opened close file ffModuleInfoW if opened
	if mif.mode == Reader || mif.mode == ReaderWriter {
		if mif.ffModuleInfoW != nil {
			mif.ffModuleInfoW.Close()
		}
		//Remove lock after close
		mif.removeLock()
	}
}

//openReader opens module info file in Reader mode
func (mif *ModuleInfoFile) openReader() {
	var err error
	//If mode does not support reading return
	if mif.mode != Reader && mif.mode != ReaderWriter {
		return
	}

	//Open or create file for reading
	mif.ffModuleInfoR, err = os.OpenFile(mif.fnModuleInfo, os.O_RDONLY, 0666)
	if err != nil {
		log.Println("ERR! OPENING ffModuleInfoR: ", err)
		return
	}

	mif.isReaderOpen = true
}

//PutInfo stores info about operation in module info file
func (mif *ModuleInfoFile) PutInfo(opID int64, commitedOpID int64) bool {
	//If module info file is not ready than return
	if !mif.isReady {
		return false
	}

	//Is writing is not opend try open writing
	if !mif.isWriterOpen {
		mif.openWriter()
		if !mif.isReaderOpen {
			return false
		}
	}

	//Print module info data to string and calculate checksum
	data := fmt.Sprintf("%s;%d;%d;", mif.moduleName, opID, commitedOpID)
	hashStr := hex.EncodeToString(crc32.NewIEEE().Sum([]byte(data)))

	//Set writing position to the begining of the file and wrige data and check sum to file
	mif.ffModuleInfoW.Seek(0, 0)
	_, err := mif.ffModuleInfoW.Write([]byte(data))
	if err != nil {
		log.Println("ERR! WRITING DATA TO MODULE FILE INFO ", err)
		return false
	}
	_, err = mif.ffModuleInfoW.Write([]byte(hashStr + "\n"))
	if err != nil {
		log.Println("ERR! WRITING HASH TO MODULE FILE INFO ", err)
		return false
	}

	mif.ffModuleInfoW.Sync()
	return true
}

//GetInfo reads info from module info file
func (mif *ModuleInfoFile) GetInfo() MInfo {
	var res MInfo
	//Try open reading if not opened
	if !mif.isReaderOpen {
		mif.openReader()
		if !mif.isReaderOpen {
			return res
		}
	}

	res.IsOk = false
	//Set reading position to the begining of the file
	mif.ffModuleInfoR.Seek(0, 0)

	// strBuf, err := ioutil.ReadAll(mif.ffModuleInfoR)
	//Allocate module info file buffer if it's not allocated
	if len(mif.buff) == 0 {
		mif.buff = make([]byte, maxModuleInfoFileSize)
	}

	//Read module info data to buffer
	_, err := mif.ffModuleInfoR.Read(mif.buff)
	if err != nil {
		log.Println("ERR! READING MODULE INFO FILE ", err)
	}

	str := string(mif.buff)

	if len(str) > 2 {
		if len(str) < 10 {
			return res
		}

		//Split data from module info file and fill structure
		ch := strings.Split(str, ";")
		if len(ch) < 3 {
			return res
		}
		res.Name = ch[0]
		res.OpID, _ = strconv.ParseInt(ch[1], 10, 64)
		res.CommittedOpID, _ = strconv.ParseInt(ch[2], 10, 64)
		res.IsOk = true
	}

	return res
}
