package main

import (
  "bytes"
  "encoding/json"
  "github.com/itiu/fasthttp"
  "log"
  "time"
)

//putIndividual handles put_individual request
//request is redirected to veda-server via socket
//veda-server stores individual into storage
func putIndividual(ctx *fasthttp.RequestCtx) {

  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in putIndividual", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  timestamp := time.Now()
  var ticketKey, eventID string

  //Decoding request paramets
  jsd := json.NewDecoder(bytes.NewReader(ctx.Request.Body()))
  jsd.UseNumber()
  var jsonData map[string]interface{}

  if err := jsd.Decode(&jsonData); err != nil {
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "put", string(ctx.Request.Body()), "", rc, timestamp)
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
    trail1(ticketKey, "", "put", string(ctx.Request.Body()), "", rc1, timestamp)
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
    trail1(ticketKey, "", "put", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }
  switch indv.(type) {
  case map[string]interface{}:
  default:
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "put", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }

  //Check if ticket is valid, if it's not valid then return fail code to client
  rc, ticket := getTicket(ticketKey)
  if rc != Ok {
    ctx.Response.SetStatusCode(int(rc))
    trail(ticket.Id, ticket.UserURI, "put", jsonData, "", rc, timestamp)
    return
  }

  //Send modify request to veda-server
  rc = modifyIndividual("put", &ticket, "individuals", []map[string]interface{}{indv.(map[string]interface{})},
    assignedSubsystems, eventID, time.Now().Unix(), ctx)
}

//putIndividuals same to put individual but this function store array of individuals from client
func putIndividuals(ctx *fasthttp.RequestCtx) {

  timestamp := time.Now()
  var ticketKey, eventID string
  // var ticket ticket

  var jsonData map[string]interface{}
  err := json.Unmarshal(ctx.Request.Body(), &jsonData)
  if err != nil {
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "put", string(ctx.Request.Body()), "", rc, timestamp)
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
    trail1(ticketKey, "", "put", string(ctx.Request.Body()), "", rc1, timestamp)
    return
  }

  var _eventID = jsonData["event_id"]
  if _eventID == nil {
    eventID = ""
  } else {
    eventID = _eventID.(string)
  }


  rc, ticket := getTicket(ticketKey)
  if rc != Ok {
    ctx.Response.SetStatusCode(int(rc))
    trail(ticket.Id, ticket.UserURI, "put", jsonData, "", rc, timestamp)
    return
  }

  individualsIJ := jsonData["individuals"]
  switch individualsIJ.(type) {
  case []interface{}:
  default:
    log.Printf("ERR! bad request=%v\n", string(ctx.Request.Body()))
    rc := BadRequest
    ctx.Response.SetStatusCode(int(rc))
    trail1(ticketKey, "", "put", string(ctx.Request.Body()), "", rc, timestamp)
    return
  }

  individualsI := individualsIJ.([]interface{})
  individuals := make([]map[string]interface{}, len(individualsI))
  for i := 0; i < len(individualsI); i++ {
    individuals[i] = individualsI[i].(map[string]interface{})
  }

  rc = modifyIndividual("put", &ticket, "individuals", individuals,
    assignedSubsystems, eventID, time.Now().Unix(), ctx)
}
