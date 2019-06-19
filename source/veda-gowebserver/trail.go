package main

import (
	"encoding/json"
	"log"
	"time"
)

//trail stores data about request in traildb
func trail1(ticketId, userId, action string, args string, result string, resultCode ResultCode, startTime time.Time) {
	if !isTrail {
		return
	}

	timestamp := time.Now()
	delta := timestamp.Sub(startTime)
	ns_delta := delta.Nanoseconds()/1000000
	
	log.Printf("TRAIL(%d): action=%s; time=%s; code=%s; ticket=%s; user=%s;\nargs=%s\n", to_delta_level (ns_delta), action, delta.String (), resultCodeToStr(resultCode), ticketId, userId, args)
}

func trail(ticketId, userId, action string, args map[string]interface{}, result string, resultCode ResultCode, startTime time.Time) {
	if !isTrail {
		return
	}

	timestamp := time.Now()
	jsonArgs, _ := json.Marshal(args)
	delta := timestamp.Sub(startTime)
	ns_delta := delta.Nanoseconds()/1000000
		
	log.Printf("TRAIL(%d): action=%s; time=%s; code=%s; ticket=%s; user=%s;\nargs=%s\n", to_delta_level (ns_delta), action, delta.String (), resultCodeToStr(resultCode), ticketId, userId, string(jsonArgs))
}

func to_delta_level (ns_delta int64) int {
	var delta_level int
	
	if ns_delta >= 0 && ns_delta <= 1 {
		delta_level = 0 
	} else if ns_delta > 1 && ns_delta <= 10 {
		delta_level = 1 		
	} else if ns_delta > 10 && ns_delta <= 100 {
		delta_level = 2 		
	} else if ns_delta > 100 && ns_delta <= 1000 {
		delta_level = 3 		
	} else if ns_delta > 1000 && ns_delta <= 10000 {
		delta_level = 4 		
	} else if ns_delta > 10000 && ns_delta <= 100000 {
		delta_level = 5 		
	} else if ns_delta > 100000 {
		delta_level = 6 		
	}
	return 	delta_level
}

func resultCodeToStr(code ResultCode) string {
        
	switch code {
case zero:
		return "zero"

    /// 200
case Ok:
		return "Ok"

    /// 201
case Created:
		return "Created"

    /// 204
case NoContent:
		return "NoContent"

    /// 400
case BadRequest:
		return "Bad_Request"

    /// 403
case Forbidden:
		return "Forbidden"

    /// 404
case NotFound:
		return "NotFound"

    /// 422
case UnprocessableEntity:
		return "UnprocessableEntity"

    /// 429
case TooManyRequests:
		return "TooManyRequests"

    /// 464
case SecretExpired:
		return "SecretExpired"

    /// 465
case EmptyPassword:
		return "EmptyPassword"

    /// 466
case NewPasswordIsEqualToOld:
		return "NewPasswordIsEqualToOld"

    /// 467
case InvalidPassword:
		return "InvalidPassword"

    /// 468
case InvalidSecret:
		return "InvalidSecret"

    /// 469
case PasswordExpired:
		return "PasswordExpired"

    /// 470
case TicketNotFound:
		return "TicketNotFound"

    /// 471
case TicketExpired:
		return "TicketExpired"

    /// 472
case NotAuthorized:
		return "NotAuthorized"

    /// 473
case AuthenticationFailed:
		return "AuthenticationFailed"

    /// 474
case NotReady:
		return "NotReady"

    /// 475
case FailOpenTransaction:
		return "FailOpenTransaction"

    /// 476
case FailCommit:
		return "FailCommit"

    /// 477
case FailStore:
		return "FailStore"

    /// 500
case InternalServerError:
		return "InternalServerError"

    /// 501
case NotImplemented:
		return "NotImplemented"

    /// 503
case ServiceUnavailable:
		return "ServiceUnavailable"

case InvalidIdentifier:
		return "InvalidIdentifier"

    /// 999
case DatabaseModifiedError:
		return "DatabaseModifiedError"

    /// 1021
case DiskFull:
		return "DiskFull"

    /// 1022
case DuplicateKey:
		return "DuplicateKey"

    /// 1118
case SizeTooLarge:
		return "SizeTooLarge"

    /// 4000
case ConnectError:
		return "ConnectError"

	default:
		return "UnknownError"
	}
}
