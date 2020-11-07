// HTTP server functions

import veda from "../common/veda";

import Util from "../common/util";

import LocalDB from "./local_db";

var Backend = {};

export default veda.Backend = Backend;

var default_timeout = 15000;
var query_timeout = default_timeout * 10;

// Check server health
Backend.ping = function () {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (this.status == 200) {
        resolve(this);
      } else {
        reject(this);
      }
    };
    xhr.onerror = reject;
    xhr.ontimeout = reject;
    xhr.open("GET", "/ping");
    xhr.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    xhr.timeout = default_timeout;
    xhr.send();
  });
};

Backend.status = "offline";
var status = {};
function setStatus(state) {
  status.line = state === "online" ? 1 : state === "offline" ? 0 : status.line;
  status.ccus = state === "ccus-online" ? 1 : state === "ccus-offline" ? 0 : status.ccus;
  if (status.line && status.ccus) {
    Backend.status = "online";
  } else if (status.line && !status.ccus) {
    Backend.status = "limited";
  } else {
    Backend.status = "offline";
  }
  this.trigger("status", Backend.status);
}
veda.on("online offline ccus-online ccus-offline", setStatus);

var interval;
var duration = default_timeout;
Backend.check = function () {
  if (interval) { return; }
  interval = setInterval(check, duration);
  if (!arguments.length) { check(); }
  function check() {
    Backend.ping().then(function () {
      interval = clearInterval(interval);
      veda.trigger("online");
    }).catch(function () {
      veda.trigger("offline");
    });
  }
};
window.addEventListener("online", Backend.check);
window.addEventListener("offline", Backend.check);
veda.on("ccus-online", Backend.check);
veda.on("ccus-offline", Backend.check);

// Server errors
function BackendError (result) {
  var errorCodes = {
       0: "Server unavailable",
     200: "Ok",
     201: "Created",
     204: "No content",
     400: "Bad request",
     403: "Forbidden",
     404: "Not found",
     422: "Unprocessable entity",
     423: "Locked",
     429: "Too many requests",
     430: "Too many password change fails",
     463: "Password change is not allowed",
     464: "Secret expired",
     465: "Empty password",
     466: "New password is equal to old",
     467: "Invalid password",
     468: "Invalid secret",
     469: "Password expired",
     470: "Ticket not found",
     471: "Ticket expired",
     472: "Not authorized",
     473: "Authentication failed",
     474: "Not ready",
     475: "Fail open transaction",
     476: "Fail commit",
     477: "Fail store",
     500: "Internal server error",
     501: "Not implemented",
     503: "Service unavailable",
     904: "Invalid identifier",
     999: "Database modified error",
    1021: "Disk full",
    1022: "Duplicate key",
    1118: "Size too large",
    4000: "Connect error"
  };
  this.code = result.status;
  this.name = errorCodes[this.code];
  this.status = result.status;
  this.message = errorCodes[this.code];
  this.stack = (new Error()).stack;
  if (result.status === 0 || result.status === 503 || result.status === 4000) {
    veda.trigger("offline");
    Backend.check();
  }
  if (result.status === 470 || result.status === 471) {
    veda.trigger("login:failed");
  }
}
BackendError.prototype = Object.create(Error.prototype);
BackendError.prototype.constructor = BackendError;

// Common server call function
function call_server(params) {
  var method = params.method,
      url = params.url,
      data = params.data,
      ticket = params.ticket,
      timeout = params.timeout || default_timeout,
      queryParams = [],
      payload = null;
  return new Promise( function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (this.status == 200) {
        resolve( JSON.parse(this.response, Util.decimalDatetimeReviver) );
      } else {
        reject( new BackendError(this) );
      }
    };
    xhr.onerror = function () {
      reject( new BackendError(this) );
    };
    xhr.ontimeout = function () {
      reject( new BackendError(this) );
    };
    if (ticket) { queryParams.push("ticket=" + ticket); }
    if (method === "GET") {
      for (var name in data) {
        if (typeof data[name] !== "undefined") {
          queryParams.push(name + "=" + encodeURIComponent(data[name]));
        }
      }
      queryParams = queryParams.join("&");
    }
    xhr.open(method, url + "?" + queryParams, true);
    xhr.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    xhr.timeout = timeout;
    if (method !== "GET") {
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      payload = JSON.stringify(data, function (key, value) {
        return key === "data" && this.type === "Decimal" ? value.toString() : value;
      });
    }
    xhr.send(payload);
  });
}

Backend.get_rights = function (ticket, uri) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/get_rights",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "uri": isObj ? arg.uri : uri
    }
  };
  return call_server(params).catch(function (backendError) {
    if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      return {
        "@":"_",
        "rdf:type":[{"data":"v-s:PermissionStatement", "type":"Uri"}],
        "v-s:canCreate":[{"data":true, "type":"Boolean"}],
        "v-s:canDelete":[{"data":false, "type":"Boolean"}],
        "v-s:canRead":[{"data":true, "type":"Boolean"}],
        "v-s:canUpdate":[{"data":true, "type":"Boolean"}]
      };
    } else {
      throw backendError;
    }
  });
};

Backend.get_rights_origin = function (ticket, uri) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/get_rights_origin",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "uri": isObj ? arg.uri : uri
    }
  };
  return call_server(params).catch(function (backendError) {
    if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      return [];
    } else {
      throw backendError;
    }
  });
};

Backend.get_membership = function (ticket, uri) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/get_membership",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "uri": isObj ? arg.uri : uri
    }
  };
  return call_server(params).catch(function (backendError) {
    if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      return {
        "@":"_",
        "rdf:type":[{"data":"v-s:Membership", "type":"Uri"}],
        "v-s:memberOf":[{"data":"v-s:AllResourcesGroup", "type":"Uri"}],
        "v-s:resource":[{"data": isObj ? arg.uri : uri, "type":"Uri"}]
      };
    } else {
      throw backendError;
    }
  });
};


Backend.authenticate = function (login, password, secret) {
  if (login == "VedaNTLMFilter")
      login = "cfg:Guest";
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/authenticate",
    timeout: default_timeout,
    data: {
      "login": isObj ? arg.login : login,
      "password": isObj ? arg.password : password,
      "secret": isObj ? arg.secret : secret
    }
  };
  return call_server(params);
  //~ return call_server(params).catch(function (backendError) {
    //~ if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      //~ return {
        //~ "end_time": (Date.now() + 12 * 3600 * 1000) * 10000 + 621355968000000000,
        //~ "id":"",
        //~ "result":200,
        //~ "user_uri":"cfg:Guest"
      //~ };
    //~ } else {
      //~ throw backendError;
    //~ }
  //~ });
};

Backend.get_ticket_trusted = function (ticket, login) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/get_ticket_trusted",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "login": isObj ? arg.login : login
    }
  };
  return call_server(params);
};

Backend.is_ticket_valid = function (ticket) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/is_ticket_valid",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {}
  };
  return call_server(params).catch(function (backendError) {
    if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      return true;
    } else {
      throw backendError;
    }
  });
};

Backend.get_operation_state = function (module_id, wait_op_id) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/get_operation_state",
    timeout: default_timeout,
    data: {
      "module_id": isObj ? arg.module_id : module_id,
      "wait_op_id": isObj ? arg.wait_op_id : wait_op_id
    }
  };
  return call_server(params);
};

Backend.wait_module = function (module_id, in_op_id) {
  var timeout = 1;
  var op_id_from_module;
  for (var i = 0; i < 100; i++) {
    op_id_from_module = Backend.get_operation_state (module_id, in_op_id);
    if (op_id_from_module >= in_op_id) { break; }
    var endtime = new Date().getTime() + timeout;
    while (new Date().getTime() < endtime);
    timeout += 2;
  }
};

Backend.query = function (ticket, queryStr, sort, databases, reopen, top, limit, from, sql) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "POST",
    url: "/query",
    ticket: isObj ? arg.ticket : ticket,
    timeout: query_timeout,
    data: {
      "query": isObj ? arg.query : queryStr,
      "sort": isObj ? arg.sort : sort,
      "databases" : isObj ? arg.databases : databases,
      "reopen" : isObj ? arg.reopen : reopen,
      "top" : isObj ? arg.top : top,
      "limit" : isObj ? arg.limit : limit,
      "from"  : isObj ? arg.from : from,
      "sql": isObj ? arg.sql : sql
    }
  };
  return call_server(params).catch(function (backendError) {
    if (backendError.code === 999) {
      return Backend.query(ticket, queryStr, sort, databases, reopen, top, limit, from, sql);
    } else if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      params.ticket = undefined;
      var localDB = new LocalDB();
      return localDB.then(function (db) {
        return db.get(JSON.stringify(params));
      });
    } else {
      throw backendError;
    }
  }).then(function (result) {
    if (result) {
      params.ticket = undefined;
      var localDB = new LocalDB();
      localDB.then(function (db) {
        db.put(JSON.stringify(params), result);
      });
    } else {
      result = {
        "result":[],
        "count":0,
        "estimated":0,
        "processed":0,
        "cursor":0,
        "result_code":200
      };
    }
    return result;
  });
};

Backend.get_individual = function (ticket, uri, reopen) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/get_individual",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "uri": isObj ? arg.uri : uri,
      "reopen" : (isObj ? arg.reopen : reopen) || false
    }
  };
  if (Backend.status === "online" || Backend.status === "offline") {
    // Cache first
    var localDB = new LocalDB();
    return localDB.then(function (db) {
      return db.get(params.data.uri);
    }).then(function (result) {
      return result || call_server(params)
        .then(function (individual) {
          var localDB = new LocalDB();
          localDB.then(function (db) {
            db.put(individual["@"], individual);
          }).catch(console.log);
          return individual;
        });
    });
  } else {
    // Fetch second
    return Backend.reset_individual(ticket, uri, reopen);
  }
};

Backend.reset_individual = function (ticket, uri, reopen) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "GET",
    url: "/get_individual",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "uri": isObj ? arg.uri : uri,
      "reopen" : (isObj ? arg.reopen : reopen) || false
    }
  };
  // Fetch first
  return call_server(params).then(function (individual) {
    var localDB = new LocalDB();
    localDB.then(function (db) {
      db.put(individual["@"], individual);
    });
    return individual;
  }).catch(function (backendError) {
    if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      // Cache second
      var localDB = new LocalDB();
      return localDB.then(function (db) {
        return db.get(params.data.uri);
      }).then(function (result) {
        if (result) {
          return result;
        } else {
          throw backendError;
        }
      });
    } else {
      throw backendError;
    }
  });
};

Backend.get_individuals = function (ticket, uris) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "POST",
    url: "/get_individuals",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "uris": isObj ? arg.uris : uris
    }
  };
  if (Backend.status === "online" || Backend.status === "offline") {
    // Cache first
    var localDB = new LocalDB();
    return localDB.then(function (db) {
      var results = [];
      var get_from_server = [];
      return params.data.uris.reduce(function (p, uri, i) {
        return p.then(function() {
          return db.get(uri).then(function (result) {
            if (typeof result !== "undefined") {
              results[i] = result;
            } else {
              get_from_server.push(uri);
            }
            return results;
          }).catch(function () {
            get_from_server.push(uri);
            return results;
          });
        });
      }, Promise.resolve(results))
      .then(function (results) {
        if (get_from_server.length) {
          params.data.uris = get_from_server;
          return call_server(params);
        } else {
          return [];
        }
      })
      .then(function (results_from_server) {
        for (var i = 0, j = 0, length = results_from_server.length; i < length; i++) {
          while(results[j++]); // Fast forward to empty element
          results[j-1] = results_from_server[i];
          db.put(results_from_server[i]["@"], results_from_server[i]);
        }
        return results;
      })
      .catch(console.log);
    });
  } else {
    // Fetch second
    return call_server(params).then(function (results) {
      var localDB = new LocalDB();
      localDB.then(function (db) {
        results.reduce(function (p, result) {
          p.then(function () {
            return db.put(result["@"], result);
          });
        }, Promise.resolve());
      });
      return results;
    }).catch(function (backendError) {
      if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
        // Cache fallback
        var localDB = new LocalDB();
        return localDB.then(function (db) {
          var promises = params.data.uris.map(function (uri) {
            return db.get(uri);
          });
          return Promise.all(promises).then(function (fulfilled) {
            return fulfilled.filter(Boolean);
          });
        });
      } else {
        throw backendError;
      }
    });
  }
};

////////////////////////////////////////////////////////////////////////

function call_server_put(params) {
  return call_server(params).catch(function (backendError) {
    if (backendError.code === 0 || backendError.code === 503 || backendError.code === 4000 ) {
      return enqueueCall(params).then(function (queue) {
        console.log("Offline operation added to queue, queue length = ", queue.length);
        return {
          "op_id":0,
          "result":200
        };
      });
    } else {
      throw backendError;
    }
  });
}

Backend.remove_individual = function (ticket, uri, assigned_subsystems, event_id, transaction_id) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "PUT",
    url: "/remove_individual",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "uri": isObj ? arg.uri : uri,
      "assigned_subsystems": (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      "prepare_events": true,
      "event_id": (isObj ? arg.event_id : event_id) || "",
      "transaction_id": (isObj ? arg.transaction_id : transaction_id) || ""
    }
  };
  return call_server_put(params)
  .then(function () {
    var localDB = new LocalDB();
    return localDB.then(function (db) {
      return db.remove(params.data.uri);
    });
  });
};

Backend.put_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "PUT",
    url: "/put_individual",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "individual": isObj ? arg.individual : individual,
      "assigned_subsystems" : (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      "prepare_events": true,
      "event_id" : (isObj ? arg.event_id : event_id) || "",
      "transaction_id" : (isObj ? arg.transaction_id : transaction_id) || ""
    }
  };
  return call_server_put(params)
  .then(function () {
    var localDB = new LocalDB();
    localDB.then(function (db) {
      db.put(params.data.individual["@"], params.data.individual);
    }).catch(console.log);
  });
};

Backend.add_to_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "PUT",
    url: "/add_to_individual",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "individual": isObj ? arg.individual : individual,
      "assigned_subsystems": (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      "prepare_events": true,
      "event_id": (isObj ? arg.event_id : event_id) || "",
      "transaction_id": (isObj ? arg.transaction_id : transaction_id) || ""
    }
  };
  return call_server_put(params);
};

Backend.set_in_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "PUT",
    url: "/set_in_individual",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "individual": isObj ? arg.individual : individual,
      "assigned_subsystems" : (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      "prepare_events": true,
      "event_id" : (isObj ? arg.event_id : event_id) || "",
      "transaction_id" : (isObj ? arg.transaction_id : transaction_id) || ""
    }
  };
  return call_server_put(params);
};

Backend.remove_from_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "PUT",
    url: "/remove_from_individual",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "individual": isObj ? arg.individual : individual,
      "assigned_subsystems" : (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      "prepare_events": true,
      "event_id" : (isObj ? arg.event_id : event_id) || "",
      "transaction_id" : (isObj ? arg.transaction_id : transaction_id) || ""
    }
  };
  return call_server_put(params);
};

Backend.put_individuals = function (ticket, individuals, assigned_subsystems, event_id, transaction_id) {
  var arg = arguments[0];
  var isObj = typeof arg === "object";
  var params = {
    method: "PUT",
    url: "/put_individuals",
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      "individuals": isObj ? arg.individuals : individuals,
      "assigned_subsystems" : (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      "prepare_events": true,
      "event_id" : (isObj ? arg.event_id : event_id) || "",
      "transaction_id" : (isObj ? arg.transaction_id : transaction_id) || ""
    }
  };
  return call_server_put(params)
  .then(function () {
    var localDB = new LocalDB();
    localDB.then(function (db) {
      params.data.individuals.forEach(function (individual) {
        db.put(individual["@"], individual);
      });
    }).catch(console.log);
  });

};

////////////////////////////////////////////////////////////////////////

Backend.uploadFile = function (params, tries) {
  tries = typeof tries === "number" ? tries : 5;
  return new Promise(function (resolve, reject) {
    var file     = params.file,
        path     = params.path,
        uri      = params.uri,
        progress = params.progress,
        url = "/files",
        xhr = new XMLHttpRequest(),
        fd = new FormData();
    xhr.open("POST", url, true);
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = progress;
    xhr.onload = done;
    xhr.onerror = fail;
    xhr.onabort = fail;
    xhr.ontimeout = fail;
    fd.append("path", path);
    fd.append("uri", uri);
    if (file instanceof File) {
      fd.append("file", file);
    } else if (file instanceof Image) {
      fd.append("content", file.src);
    }
    xhr.send(fd);
    function done() {
      if (xhr.status === 200) {
        resolve(params);
      } else {
        reject( new Error("File upload error") );
      }
    }
    function fail() {
      reject( new Error("File upload error") );
    }
  })
  .catch(function (error) {
    if (tries > 0) {
      return Backend.uploadFile(params, --tries);
    }
    throw error;
  });
};

Backend.loadFile = function (url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 10 * 60 * 1000;
    xhr.onload = done;
    xhr.onerror = fail;
    xhr.onabort = fail;
    xhr.ontimeout = fail;
    xhr.send();
    function done() {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject( new Error("File load error") );
      }
    }
    function fail() {
      reject( new Error("File load error") );
    }
  });
};

////////////////////////////////////////////////////////////////////////

// Offline PUT queue
function enqueueCall(params) {
  if (typeof params === "object") {
    params.ticket = undefined;
  }
  var localDB = new LocalDB();
  return localDB.then(function (db) {
    return db.get("offline-queue").then(function(queue) {
      queue = queue || [];
      queue.push( JSON.stringify(params) );
      return db.put("offline-queue", queue);
    });
  });
}
function flushQueue() {
  var localDB = new LocalDB();
  return localDB.then(function (db) {
    return db.get("offline-queue").then(function(queue) {
      if (queue && queue.length) {
        return queue.reduce(function (prom, params) {
          return prom.then(function () {
            params = JSON.parse(params);
            params.ticket = veda.ticket;
            return call_server(params);
          });
        }, Promise.resolve()).then(function () {
          db.remove("offline-queue");
          return queue.length;
        });
      } else {
        return 0;
      }
    });
  });
}
veda.on("online", function () {
  console.log("Veda 'online', flushing queue");
  flushQueue().then(function (queue_length) {
    console.log("Done, queue flushed", queue_length);
  });
});
