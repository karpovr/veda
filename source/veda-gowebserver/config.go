package main

import (
	"bufio"
	"log"
	"os"
	"strconv"
	"strings"
)

func configWebServer() {
	file, err := os.Open("veda.properties")
	if err == nil {
		scanner := bufio.NewScanner(file)
		count := 0
		for scanner.Scan() {
			count++
			line := scanner.Text()
			line = strings.Trim(line, "\r\n\t ")
			line = strings.Replace(line, " ", "", -1)
			idx := strings.Index(line, "#")

			if idx >= 0 {
				line = string([]rune(line)[:idx])
			}

			if len(line) == 0 {
				continue
			}

			splitted := strings.SplitN(line, "=", 2)
			if len(splitted) < 2 {
				log.Printf("ERR! NO ASSIGNATION SING FOUND ON LINE %d\n", count)
				continue
			}

			paramName := splitted[0]
			paramVal := splitted[1]
			switch paramName {
			case "notify_channel_url":
				notifyChannelURL = paramVal
			case "main_module_url":
				mainModuleURL = paramVal
			case "tarantool_url":
				tarantoolURL = paramVal
			case "use_https":
				boolVal, err := strconv.ParseBool(paramVal)
				if err != nil {
					log.Printf("ERR! ON PARSING BOOL IN CONFIG ON LINE %d\n", count)
					continue
				}
				useHTTPS = boolVal
			case "http_port":
				webserverPort = paramVal
			case "https_port":
				webserverHTTPSPort = paramVal
			case "ro_storage_url":
				roStorageURL = paramVal
			case "ft_query_service_url":
				queryServiceURL = paramVal
			case "webserver_trace":
				boolVal, err := strconv.ParseBool(paramVal)
				if err != nil {
					log.Printf("ERR! ON PARSING BOOL IN CONFIG ON LINE %d\n", count)
					continue
				}
				isTrail = boolVal

			default:
				continue
			}
		}
		file.Close()
	} else {
		log.Println("ERR! ON READING CONFIG, START WITH DEFAULTS: ", err)
	}
}
