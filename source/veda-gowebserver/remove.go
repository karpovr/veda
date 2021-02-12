package main

import (
  "encoding/json"
  "log"
  "time"

  "github.com/itiu/fasthttp"
)

//removeFromIndividual function handler remove_from_individual request
//request is redirected to veda-server via socket
//veda-server removes the given field from the individual
func removeFromIndividual(ctx *fasthttp.RequestCtx) {

  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in removeFromIndividual", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  timestamp := time.Now()

  var assignedSubsystems uint64
  var ticketKey, eventID string

  //Reading request data from context
  var jsonData map[string]interface{}
  err := json.Unmarshal(ctx.Request.Body(), &jsonData)
  if err != nil {
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "remove_from", string(ctx.Request.Body()), "", rc, timestamp)
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
    trail1(ticketKey, "", "remove_from", string(ctx.Request.Body()), "", rc1, timestamp)
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
    trail1(ticketKey, "", "remove_from", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }
  switch indv.(type) {
  case map[string]interface{}:
  default:
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "remove_from", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }

  //Check if ticket is valid, if not then return fail code to client
  rc, ticket := getTicket(ticketKey)
  if rc != Ok {
    ctx.Response.SetStatusCode(int(rc))
    trail(ticket.Id, ticket.UserURI, "remove_from", jsonData, "", rc, timestamp)
    return
  }

  //Send modify request to veda server
  rc = modifyIndividual("remove_from", &ticket, "individuals", []map[string]interface{}{indv.(map[string]interface{})},
    assignedSubsystems, eventID, time.Now().Unix(), ctx)
}

//removeIndividual handles remove_individual request
//request redirected to veda-server via socket
//veda-server removes given individual from the storage
func removeIndividual(ctx *fasthttp.RequestCtx) {

  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in removeIndividual", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  timestamp := time.Now()

  var assignedSubsystems uint64
  var ticketKey, eventID string

  //Reading request data from context
  var jsonData map[string]interface{}
  err := json.Unmarshal(ctx.Request.Body(), &jsonData)
  if err != nil {
    log.Println("ERR! REMOVE_INDIVIDUAL: DECODING JSON REQUEST ", err)
    ctx.Response.SetStatusCode(int(InternalServerError))
    return
  }

  ticketKey = string(ctx.QueryArgs().Peek("ticket")[:])
  if len(ticketKey) == 0 {
    ticketKey = string(ctx.Request.Header.Cookie("ticket"))
  }
  if len(ticketKey) == 0 && jsonData["ticket"] != nil {
    ticketKey = jsonData["ticket"].(string)
  }

  if jsonData["assigned_subsystems"] != nil {
    assignedSubsystems = uint64(jsonData["assigned_subsystems"].(float64))
  }

  var _eventID = jsonData["event_id"]
  if _eventID == nil {
    eventID = ""
  } else {
    eventID = _eventID.(string)
  }

  //Check if ticket is valid, if not then return fail code to client
  rc, ticket := getTicket(ticketKey)
  if rc != Ok {
    ctx.Response.SetStatusCode(int(rc))
    trail(ticket.Id, ticket.UserURI, "remove_individual", jsonData, "", rc, timestamp)

    return
  }

  individual := make(map[string]interface{})
  individual["@"] = jsonData["uri"]

  //log.Println("@REMOVE ", jsonData["uri"])

  //Send modify request to veda-server
  rc = modifyIndividual("remove", &ticket, "individuals", []map[string]interface{}{individual},
    assignedSubsystems, eventID, time.Now().Unix(), ctx)
}
