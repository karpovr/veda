package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/itiu/fasthttp"
	//"github.com/op/go-nanomsg"
)

//modifyIndividual sends request to veda server
//cmd defines function which server must execute, dataJSON is data passed to veda-server,
//assigned_subsystems are subsystem rised on this function
//event_id is current event id
func modifyIndividual(cmd string, ticket *ticket, dataKey string, dataJSON interface{}, assignedSubsystems uint64,
	eventID string, startTime int64, ctx *fasthttp.RequestCtx) ResultCode {
	timestamp := time.Now()
	request := make(map[string]interface{})

	//fills request map with parametrs
	request["function"] = cmd
	request["ticket"] = ticket.Id
	request[dataKey] = dataJSON
	request["assigned_subsystems"] = assignedSubsystems
	request["event_id"] = eventID

	//Marshal request and send to socket
	jsonRequest, err := json.Marshal(request)
	if err != nil {
		log.Printf("ERR! modify individual: ENCODE JSON REQUEST, cmd=%v: request=%v, err=%v\n", cmd, request, err)
		ctx.Response.SetStatusCode(int(InternalServerError))
		return InternalServerError
	}

	responseJSON := make(map[string]interface{})

	mstorage_ch_Mutex.Lock()
	NmCSend(g_mstorage_ch, jsonRequest, 0)
	responseBuf, _ := g_mstorage_ch.Recv(0)
	mstorage_ch_Mutex.Unlock()

	if err != nil {
		log.Printf("ERR! modify individual: recieve, cmd=%v: err=%v, request=%v\n", cmd, err, request)
		ctx.Response.SetStatusCode(int(InternalServerError))
		trail(ticket.Id, ticket.UserURI, cmd, request, "{}", InternalServerError, timestamp)
		return InternalServerError
	} else {
		err = json.Unmarshal(responseBuf, &responseJSON)
		if err != nil {
			log.Printf("ERR! modify individual: DECODE JSON RESPONSE, cmd=%v: request=%v, response=%v, err=%v\n", cmd, request, responseBuf, err)
			ctx.Response.SetStatusCode(int(InternalServerError))
			trail(ticket.Id, ticket.UserURI, cmd, request, "{}", InternalServerError, timestamp)
			return BadRequest
		}

		//Unmarshal response data and gives response to client
		dataJF := responseJSON["data"]

		if dataJF != nil {
			dataI := dataJF.([]interface{})
			if len(dataI) == 1 {
				responseData := dataI[0].(map[string]interface{})
				ctx.Response.SetStatusCode(int(responseData["result"].(float64)))
				responseDataJSON, _ := json.Marshal(responseData)
				ctx.Write(responseDataJSON)
				trail(ticket.Id, ticket.UserURI, cmd, request, string(responseDataJSON),
					ResultCode(responseData["result"].(float64)), timestamp)
				return ResultCode(responseData["result"].(float64))
			} else {
				ctx.Response.SetStatusCode(int(BadRequest))
				responseDataJSON, _ := json.Marshal(responseJSON)
				ctx.Write(responseDataJSON)
				trail(ticket.Id, ticket.UserURI, cmd, request, string(responseDataJSON), BadRequest, timestamp)
				return BadRequest
			}
		} else {
			ctx.Response.SetStatusCode(int(responseJSON["result"].(float64)))
			responseDataJSON, _ := json.Marshal(responseJSON)
			ctx.Write(responseDataJSON)
			trail(ticket.Id, ticket.UserURI, cmd, request, string(responseDataJSON),
				ResultCode(responseJSON["result"].(float64)), timestamp)
			return ResultCode(responseJSON["result"].(float64))
		}
	}
}
