package main

import (
  "encoding/json"
  "fmt"
  "log"
  "os"
  "runtime"
  "strings"
  "sync"
  "time"

  "github.com/op/go-nanomsg"
  "github.com/itiu/fasthttp"
)

//ResultCode is type for representation of http codes
type ResultCode uint32

const (
    zero                    ResultCode = 0
    Ok                      ResultCode = 200
    Created                 ResultCode = 201
    NoContent               ResultCode = 204
    BadRequest              ResultCode = 400
    Forbidden               ResultCode =  403
    NotFound                ResultCode =  404
    UnprocessableEntity     ResultCode =  422
    TooManyRequests         ResultCode =  429
    SecretExpired           ResultCode =  464
    EmptyPassword           ResultCode =  465
    NewPasswordIsEqualToOld ResultCode =  466
    InvalidPassword         ResultCode =  467
    InvalidSecret           ResultCode =  468
    PasswordExpired         ResultCode =  469
    TicketNotFound          ResultCode =  470
    TicketExpired           ResultCode =  471
    NotAuthorized           ResultCode =  472
    AuthenticationFailed    ResultCode =  473
    NotReady                ResultCode =  474
    FailOpenTransaction     ResultCode =  475
    FailCommit              ResultCode =  476
    FailStore               ResultCode =  477
    InternalServerError     ResultCode =  500
    NotImplemented          ResultCode =  501
    ServiceUnavailable      ResultCode =  503
    InvalidIdentifier       ResultCode =  904
    DatabaseModifiedError   ResultCode =  999
    DiskFull                ResultCode =  1021
    DuplicateKey            ResultCode =  1022
    SizeTooLarge            ResultCode =  1118
    ConnectError            ResultCode =  4000
)

type ticket struct {
  Id        string
  UserURI   string
  UserLogin string
  result    ResultCode
  StartTime int64
  EndTime   int64
}

const (
  tdbPath = "./data/trails/ "
)

//ticketCache is map to cache requested earlier tickets
var ticketCache map[string]ticket
var ticketCacheMutex = sync.RWMutex{}

//ontologyCache is map to cache requested earlier individuals from ontology
var ontologyCache map[string]Individual

//mifCache is map to cache opened ModuleInfoFile structs
var mifCache map[int]*ModuleInfoFile

//conn is Connector to trarantool database
var conn Connector

//socket is nanomsg socket connected to server
var g_mstorage_ch *nanomsg.Socket
var g_auth_ch *nanomsg.Socket

var mstorage_ch_Mutex = sync.RWMutex{}
var auth_ch_Mutex = sync.RWMutex{}

var mainModuleURL = ""
var authModuleURL = ""
var notifyChannelURL = ""
var queryServiceURL = ""
var searchQueryURL = ""
var roStorageURL = ""
var tarantoolURL = ""
var webserverPort = ""
var webserverHTTPSPort = ""
var use_clickhouse = ""

var useHTTPS = false

//attachmentsPath is path where files from request are stored
var attachmentsPath = "./data/files/"

//areExternalUsers is variable to activate ExternalUsers features
var areExternalUsers = false

var isTrail = true

//countTrails is variable to count trail requests, after limit they are flushed
var countTrails = 0

//codeToJsonException converts ResultCode value to its string representation
func codeToJsonException(code ResultCode) []byte {
  exception := make(map[string]interface{})

  switch code {
    case zero:                    exception["statusMessage"] = "zero"                     // 0

    case Ok:                      exception["statusMessage"] = "Ok"                       // 200

    case Created:                 exception["statusMessage"] = "Created"                  // 201

    case NoContent:               exception["statusMessage"] = "NoContent"                // 204

    case BadRequest:              exception["statusMessage"] = "Bad_Request"              // 400

    case Forbidden:               exception["statusMessage"] = "Forbidden"                // 403

    case NotFound:                exception["statusMessage"] = "NotFound"                 // 404

    case UnprocessableEntity:     exception["statusMessage"] = "UnprocessableEntity"      // 422

    case TooManyRequests:         exception["statusMessage"] = "TooManyRequests"          // 429

    case SecretExpired:           exception["statusMessage"] = "SecretExpired"            // 464

    case EmptyPassword:           exception["statusMessage"] = "EmptyPassword"            // 465

    case NewPasswordIsEqualToOld: exception["statusMessage"] = "NewPasswordIsEqualToOld"  // 466

    case InvalidPassword:         exception["statusMessage"] = "InvalidPassword"          // 467

    case InvalidSecret:           exception["statusMessage"] = "InvalidSecret"            // 468

    case PasswordExpired:         exception["statusMessage"] = "PasswordExpired"          // 469

    case TicketNotFound:          exception["statusMessage"] = "TicketNotFound"           // 470

    case TicketExpired:           exception["statusMessage"] = "TicketExpired"            // 471

    case NotAuthorized:           exception["statusMessage"] = "NotAuthorized"            // 472

    case AuthenticationFailed:    exception["statusMessage"] = "AuthenticationFailed"     // 473

    case NotReady:                exception["statusMessage"] = "NotReady"                 // 474

    case FailOpenTransaction:     exception["statusMessage"] = "FailOpenTransaction"      // 475

    case FailCommit:              exception["statusMessage"] = "FailCommit"               // 476

    case FailStore:               exception["statusMessage"] = "FailStore"                // 477

    case InternalServerError:     exception["statusMessage"] = "InternalServerError"      // 500

    case NotImplemented:          exception["statusMessage"] = "NotImplemented"           // 501

    case ServiceUnavailable:      exception["statusMessage"] = "ServiceUnavailable"       // 503

    case InvalidIdentifier:       exception["statusMessage"] = "InvalidIdentifier"        // 904

    case DatabaseModifiedError:   exception["statusMessage"] = "DatabaseModifiedError"    // 999

    case DiskFull:                exception["statusMessage"] = "DiskFull"                 // 1021

    case DuplicateKey:            exception["statusMessage"] = "DuplicateKey"             // 1022

    case SizeTooLarge:            exception["statusMessage"] = "SizeTooLarge"             // 1118

    case ConnectError:            exception["statusMessage"] = "ConnectError"             // 4000

    default: exception["statusMessage"] = "UnknownError"
  }
  exceptionJSON, _ := json.Marshal(exception)
  return exceptionJSON
}

func getGOMAXPROCS() int {
  return runtime.GOMAXPROCS(0)
}

func main() {
  log.SetFlags(log.LstdFlags | log.Lmicroseconds)

  log.Printf("ENV GOMAXPROCS is %d\n", getGOMAXPROCS())
  runtime.GOMAXPROCS(1)
  log.Printf("USE GOMAXPROCS is %d\n", getGOMAXPROCS())

  var err error

  configWebServer()

  args := os.Args[1:]

  opt_external_users_http_port := ""

  for _, arg := range args {
    log.Println(arg)
    cuts := strings.Split(arg, "=")
    if len(cuts) == 2 {
      name := cuts[0]
      val := cuts[1]

      if name == "--http_port" {
        webserverPort = val
        log.Println("use command line param http_port=", webserverPort)
      } else if name == "--ext_usr_http_port" {
        opt_external_users_http_port = val
      } else if name == "--use_clickhouse" {
        use_clickhouse = strings.TrimSpace(strings.ToLower(val))
        log.Println("use clickhouse query =", use_clickhouse)
      }
    }
  }

  if opt_external_users_http_port != "" && opt_external_users_http_port == webserverPort {
    log.Println("use external user mode")
    areExternalUsers = true
  }

  g_mstorage_ch, err = nanomsg.NewSocket(nanomsg.AF_SP, nanomsg.REQ)
  if err != nil {
    log.Fatal("ERR! ON CREATING SOCKET")
  }
  _, err = g_mstorage_ch.Connect(mainModuleURL)
  for err != nil {
    _, err = g_mstorage_ch.Connect(mainModuleURL)
    time.Sleep(3000 * time.Millisecond)
  }

  g_auth_ch, err = nanomsg.NewSocket(nanomsg.AF_SP, nanomsg.REQ)
  if err != nil {
    log.Fatal("ERR! ON CREATING SOCKET")
  }
  _, err = g_auth_ch.Connect(authModuleURL)
  for err != nil {
    _, err = g_auth_ch.Connect(authModuleURL)
    time.Sleep(3000 * time.Millisecond)
  }

  conn.Connect(tarantoolURL)

  ticketCache = make(map[string]ticket)
  ontologyCache = make(map[string]Individual)
  mifCache = make(map[int]*ModuleInfoFile)

  // File server
  fs := &fasthttp.FS {
    Root:                 "public/",
    IndexNames:           []string{"index.html"},
    Compress:             true,
  }
  fsHandler := fs.NewRequestHandler()

  // Request handler
  requestHandler := func (ctx *fasthttp.RequestCtx) {
    ctx.Response.Header.Set("server", "nginx/1.19.6")
    ctx.Response.Header.SetCanonical([]byte("server"), []byte("nginx/1.19.6"))
    ctx.Response.Header.Set("X-XSS-Protection", "1; mode=block")
    ctx.Response.Header.Set("X-Content-Type-Options", "nosniff")
    ctx.Response.Header.Set("X-Frame-Options", "sameorigin")

    routeParts := strings.Split(string(ctx.Path()[:]), "/")
    if len(routeParts) >= 2 && routeParts[1] == "files" {
      files(ctx, routeParts)
      return
    }

    switch string(ctx.Path()[:]) {
      case "/get_individual":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getIndividual(ctx)
      case "/reset_individual":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getIndividual(ctx)
      case "/get_individuals":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getIndividuals(ctx)
      case "/put_individual":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        putIndividual(ctx)
      case "/put_individuals":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        putIndividuals(ctx)
      case "/remove_individual":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        removeIndividual(ctx)
      case "/remove_from_individual":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        removeFromIndividual(ctx)
      case "/set_in_individual":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        setInIndividual(ctx)
      case "/add_to_individual":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        addToIndividual(ctx)
      case "/authenticate":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        authenticate(ctx)
      case "/get_rights":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getRights(ctx)
      case "/get_rights_origin":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getAclData(ctx, GetRightsOrigin)
      case "/get_membership":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getAclData(ctx, GetMembership)
      case "/get_ticket_trusted":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getTicketTrusted(ctx)
      case "/is_ticket_valid":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        isTicketValid(ctx)
      case "/query":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        query(ctx)
      case "/send_to_module":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        sendToModule(ctx)
      case "/get_operation_state":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        getOperationState(ctx)
      case "/ping":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        ctx.Response.Header.Set("Content-Type", "text/plain; charset=utf-8")
        ctx.Response.SetStatusCode(int(Ok))
        ctx.WriteString("pong")
      case "/tests":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        ctx.SendFile("public/tests.html")
      case "/ontology.json":
        ctx.Response.Header.Set("Cache-Control", "max-age=43200, no-cache, must-revalidate, private")
        ctx.SendFile("public/ontology.json")
      case "/manifest":
        ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
        ctx.SendFile("public/manifest")
      default:
        if len(routeParts) >= 2 && routeParts[1] == "apps" {
          var last = routeParts[len(routeParts) - 1];
          if last != "manifest" {
            ctx.SendFile("public/index.html")
            return;
          } else {
            ctx.Response.Header.Set("Cache-Control", "no-cache, no-store, must-revalidate")
            ctx.SendFile("public/" + string(ctx.Path()[:]))
            return;
          }
        }
        fsHandler(ctx)
    }
  }

  // Server instance
  server := fasthttp.Server {
    Handler:              requestHandler,
    MaxRequestBodySize:   10 * 1024 * 1024 * 1024,
    ReadTimeout:          600 * time.Second,
    WriteTimeout:         600 * time.Second,
    MaxKeepaliveDuration: 600 * time.Second,
    ReadBufferSize:       8 * 1024,
  }

  go func() {
    err = server.ListenAndServe("0.0.0.0:" + webserverPort)
    if err != nil {
      log.Fatal("ERR! ON STARTUP HTTP WEBSERVER ", err)
    }
  }()

  fmt.Println("web server ready, listen " + webserverPort)
  select {}
}
