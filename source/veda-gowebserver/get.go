package main

import (
  "encoding/json"
  "log"
  "strings"
  "time"

  "github.com/itiu/fasthttp"
)

const queueStatePrefix = "srv:queue-state-"

func getIndividual(ctx *fasthttp.RequestCtx) {

  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in getIndividual", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  ctx.Response.Header.SetCanonical([]byte("Content-Type"), []byte("application/json"))
  timestamp := time.Now()
  var uri string
  var ticketKey string
  var ticket ticket
  var reopen bool

  ticketKey = string(ctx.QueryArgs().Peek("ticket")[:])
  if len(ticketKey) == 0 {
    ticketKey = string(ctx.Request.Header.Cookie("ticket"))
  }
  uri = string(ctx.QueryArgs().Peek("uri")[:])

  if string(ctx.QueryArgs().Peek("reopen")[:]) == "true" {
    reopen = true
  }

  // log.Println("\t@getIndividual: ticket=", ticketKey, ", uri=", uri, "ctx=", ctx.QueryArgs())

  if len(uri) == 0 {
    log.Println("ERR! GET_INDIVIDUAL: ZERO LENGTH TICKET OR URI")
    log.Println("\t@REQUEST QUERY STRING ", string(ctx.QueryArgs().QueryString()))
    ctx.Response.SetStatusCode(int(BadRequest))
    trail("", "", "get_individual", make(map[string]interface{}), "{}", BadRequest, timestamp)
    return
  }

  rc, ticket := getTicket(ticketKey)
  if rc != Ok {
    log.Println("ERR! GET_INDIVIDUAL: GET TICKET ", rc)
    log.Println("\t@REQUEST BODY ", string(ctx.Request.Body()))
    log.Println("\t@getIndividual: ticket=", ticketKey, ", uri=", uri)
    ctx.Response.SetStatusCode(int(rc))
    trail(ticket.Id, ticket.UserURI, "get_individual", make(map[string]interface{}), "{}", rc, timestamp)
    return
  }

  if strings.Index(uri, queueStatePrefix) == 0 {
    queueName := string(uri[len(queueStatePrefix):])
    main_queue_name := "individuals-flow"
    info := get_consumer_info ("./data/queue", queueName, main_queue_name)

    individual := make(map[string]interface{})
    individual["@"] = uri
    individual["rdf:type"] = []map[string]interface{}{{"data": "v-s:AppInfo", "type": "Uri"}}
    individual["v-s:created"] = []map[string]interface{}{{"data": time.Now().Format("2006-01-02T15:04:05Z"),
      "type": "Datetime"}}
    individual["srv:queue"] = []map[string]interface{}{{"data": "srv:" + queueName, "type": "Uri"}}
    individual["srv:total_count"] = []map[string]interface{}{{"data": info.total_count, "type": "Integer"}}
    individual["srv:current_count"] = []map[string]interface{}{{"data": info.current_count, "type": "Integer"}}
    individualJSON, err := json.Marshal(individual)
    if err != nil {
      log.Println("ERR! GET_INDIVIDUAL: #1 ENCODING INDIVIDUAL TO JSON ", err)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    jsonArgs := map[string]interface{}{"uri": uri}
    trail(ticket.Id, ticket.UserURI, "get_individual", jsonArgs, string(individualJSON), Ok, timestamp)
    ctx.Write(individualJSON)
    ctx.Response.SetStatusCode(int(Ok))
    return
  }

  uris := make([]string, 1)
  uris[0] = uri
  jsonArgs := map[string]interface{}{"uri": uri}

  rr := conn.Get(true, ticket.UserURI, uris, false, reopen)

  if rr.CommonRC != Ok {
    if rr.CommonRC != NotFound {
      log.Println("ERR! get_individual: err=", rr.CommonRC)
    }

    ctx.Response.SetStatusCode(int(rr.CommonRC))
    trail(ticket.Id, ticket.UserURI, "get_individual", jsonArgs, "{}", rr.CommonRC, timestamp)
    return
  } else if len(rr.OpRC) == 0 {
    log.Println("ERR! get_individual: DECODING INDIVIDUAL")
    ctx.Response.SetStatusCode(int(InternalServerError))
    trail(ticket.Id, ticket.UserURI, "get_individual", jsonArgs, "{}", InternalServerError, timestamp)
    return
  } else if rr.OpRC[0] != Ok {
    ctx.Write(codeToJsonException(rr.OpRC[0]))
    ctx.Response.SetStatusCode(int(rr.OpRC[0]))
    trail(ticket.Id, ticket.UserURI, "get_individual", jsonArgs, "{}", rr.OpRC[0], timestamp)
    return
  } else {
    if rr.GetCount() == 0 {
      log.Println("ERR! get_individual: DECODING INDIVIDUAL")
      ctx.Response.SetStatusCode(int(InternalServerError))
      trail(ticket.Id, ticket.UserURI, "get_individual", jsonArgs, "{}", InternalServerError, timestamp)
      return
    }

    individualJSON := rr.GetJson(0)

    //log.Println("@ GET RESULT:",  uri, ", ", string(individualJSON))

    ctx.Write([]byte(individualJSON))

    trail(ticket.Id, ticket.UserURI, "get_individual", jsonArgs, individualJSON, Ok, timestamp)
  }

  ctx.Response.SetStatusCode(int(Ok))
  return
}

func getIndividuals(ctx *fasthttp.RequestCtx) {

  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in getIndividuals", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  ctx.Response.Header.SetCanonical([]byte("Content-Type"), []byte("application/json"))

  timestamp := time.Now()
  var jsonData map[string]interface{}
  var uris []string
  var ticketKey string
  var ticket ticket

  err := json.Unmarshal(ctx.Request.Body(), &jsonData)

  if err != nil {
    log.Println("ERR! get individuals: DECODING JSON REQUEST ", err)
    ctx.Response.SetStatusCode(int(InternalServerError))
    trail(ticket.Id, ticket.UserURI, "get_individuals", make(map[string]interface{}), "{}", BadRequest, timestamp)
    return
  }

  jsonArgs := map[string]interface{}{"uris": jsonData["uris"]}

  ticketKey = string(ctx.QueryArgs().Peek("ticket")[:])
  if len(ticketKey) == 0 {
    ticketKey = string(ctx.Request.Header.Cookie("ticket"))
  }

  rc, ticket := getTicket(ticketKey)
  if rc != Ok {
    ctx.Response.SetStatusCode(int(rc))
    trail(ticket.Id, ticket.UserURI, "get_individuals", jsonArgs, "{}", rc, timestamp)
    return
  }

  uris = make([]string, len(jsonData["uris"].([]interface{})))
  for i := 0; i < len(jsonData["uris"].([]interface{})); i++ {
    if jsonData["uris"].([]interface{})[i] != nil {
      iuri := jsonData["uris"].([]interface{})[i]
      if iuri != nil {
        uris[i] = iuri.(string)
      } else {
        log.Printf("WARN! invalid uri(null) %v\n", jsonData)
      }
    } else {
      log.Printf("WARN! invalid uri(null) %v\n", jsonData)
    }

  }

  individuals := make([]map[string]interface{}, 0, len(uris))

  urisToGet := uris

  for i := 0; i < len(urisToGet); i++ {
    rr := conn.Get(true, ticket.UserURI, []string{urisToGet[i]}, false, false)

    if rr.CommonRC != Ok {
      log.Println("ERR! get individuals: err=", rr.CommonRC, ", user=", ticket.UserURI, ", uri=", urisToGet[i])
      ctx.Response.SetStatusCode(int(rr.CommonRC))
      trail(ticket.Id, ticket.UserURI, "get_individuals", jsonArgs, "{}", rr.CommonRC, timestamp)
      continue
    }

    if rr.OpRC[0] == Ok {
      if rr.GetCount() == 0 {
        log.Println("ERR! get individuals: DECODING INDIVIDUAL")
        ctx.Response.SetStatusCode(int(InternalServerError))
        trail(ticket.Id, ticket.UserURI, "get_individuals", jsonArgs, "{}", InternalServerError, timestamp)
        return
      }
      individual := rr.GetIndv(0)

      individuals = append(individuals, individual)
    }

    if err != nil {
      log.Println("ERR! get individuals: #4 ENCODING INDIVIDUAL TO JSON ", err)
      ctx.Response.SetStatusCode(int(InternalServerError))
      trail(ticket.Id, ticket.UserURI, "get_individuals", jsonArgs, "{}", InternalServerError, timestamp)
      return
    }
  }

  individualsJSON, err := json.Marshal(individuals)
  if err != nil {
    log.Println("ERR! get individuals: ENCODING INDIVIDUALS JSON ", err)
  }

  trail(ticket.Id, ticket.UserURI, "get_individuals", jsonArgs, string(individualsJSON), Ok, timestamp)
  ctx.Write(individualsJSON)
  ctx.Response.SetStatusCode(int(Ok))
}
