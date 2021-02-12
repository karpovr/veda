package main

import (
  "encoding/json"
  "log"
  "time"

  "github.com/itiu/fasthttp"
)

//addToIndividual handler routes request to veda-server and returns veda-server response
//veda-server adds the given value to ght given field
func addToIndividual(ctx *fasthttp.RequestCtx) {

  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in addToIndividual", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  timestamp := time.Now()

  var assignedSubsystems uint64
  var ticketKey, eventID string

  //jsonData is decoded from http request from client
  var jsonData map[string]interface{}
  err := json.Unmarshal(ctx.Request.Body(), &jsonData)
  if err != nil {
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "add_to", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }

  ticketKey = string(ctx.QueryArgs().Peek("ticket")[:])
  if len(ticketKey) == 0 {
    ticketKey = string(ctx.Request.Header.Cookie("ticket"))
  }
  if len(ticketKey) == 0 && jsonData["ticket"] != nil {
    ticketKey = jsonData["ticket"].(string)
  }

  rc1, assignedSubsystems := getUint64FromJson(jsonData, "assigned_subsystems")
  if rc1 != Ok {
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    ctx.Response.SetStatusCode(int(rc1))
    trail1(ticketKey, "", "add_to", string(ctx.Request.Body()), "", rc1, timestamp)
    return
  }

  var _eventID = jsonData["event_id"]
  if _eventID == nil {
    eventID = ""
  } else {
    eventID = _eventID.(string)
  }

  indv := jsonData["individual"]
  if indv == nil {
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "add_to", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }
  switch indv.(type) {
  case map[string]interface{}:
  default:
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "add_to", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }

  //request ticket with the given key and check its validity
  rc, ticket := getTicket(ticketKey)
  if rc != Ok {
    //if ticket is invalid return fail code
    ctx.Response.SetStatusCode(int(rc))
    trail(ticket.Id, ticket.UserURI, "add_to", jsonData, "", rc, timestamp)
    return
  }

  //send modify request to veda-server
  rc = modifyIndividual("add_to", &ticket, "individuals", []map[string]interface{}{indv.(map[string]interface{})},
    assignedSubsystems, eventID, time.Now().Unix(), ctx)

}
