package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/itiu/fasthttp"
)

//setInIndividual handles set_in_individual request
//request is redirected to veda server via socket
//veda-server set the given field to the given value
func setInIndividual(ctx *fasthttp.RequestCtx) {
	timestamp := time.Now()

	var assignedSubsystems uint64
	var ticketKey, eventID string
	// var ticket ticket

	var jsonData map[string]interface{}
	err := json.Unmarshal(ctx.Request.Body(), &jsonData)
	if err != nil {
		log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
		rc := BadRequest
		ctx.Response.SetStatusCode(int(rc))
		trail1(ticketKey, "", "set_in", string(ctx.Request.Body()), "", rc, timestamp)
		return
	}

	if jsonData["ticket"] != nil {
		ticketKey = jsonData["ticket"].(string)
	} 

	rc1, assignedSubsystems := getUint64FromJson(jsonData, "assigned_subsystems")
	if rc1 != Ok {
		log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
		ctx.Response.SetStatusCode(int(rc1))
		trail1(ticketKey, "", "set_in", string(ctx.Request.Body()), "", rc1, timestamp)
		return
	}

	eventID = jsonData["event_id"].(string)

	indv := jsonData["individual"]
	if indv == nil {
		log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
		rc := BadRequest
		ctx.Response.SetStatusCode(int(rc))
		trail1(ticketKey, "", "set_in", string(ctx.Request.Body()), "", rc, timestamp)
		return
	}
	switch indv.(type) {
	case map[string]interface{}:
	default:
		log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
		rc := BadRequest
		ctx.Response.SetStatusCode(int(rc))
		trail1(ticketKey, "", "set_in", string(ctx.Request.Body()), "", rc, timestamp)
		return
	}

	rc, ticket := getTicket(ticketKey)
	if rc != Ok {
		ctx.Response.SetStatusCode(int(rc))
		trail(ticket.Id, ticket.UserURI, "set_in", jsonData, "", rc, timestamp)
		return
	}

	rc = modifyIndividual("set_in", &ticket, "individuals", []map[string]interface{}{indv.(map[string]interface{})},
		assignedSubsystems, eventID, time.Now().Unix(), ctx)
}
