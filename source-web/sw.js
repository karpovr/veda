var API = "api-0";
var FILES = "files-0";
var STATIC = "static-0";

this.addEventListener("activate", function(event) {
  var cacheWhitelist = [ API, FILES, STATIC ];

  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(keyList.map(function(key) {
        if (cacheWhitelist.indexOf(key) === -1) {
          return caches.delete(key);
        }
      }));
    })
  );
});

this.addEventListener("fetch", function(event) {
  var url = new URL(event.request.url);
  var type = url.pathname.indexOf("/ping") === 0 ? "PING" : url.pathname.indexOf("/api") === 0 ? "API" : url.pathname.indexOf("/files") === 0 ? "FILES" : "STATIC";
  switch (type) {
    case "PING":
      event.respondWith(fetch(event.request));
      break;
    case "API":
      event.respondWith(handleAPI(event));
      break;
    case "FILES":
      if (event.request.method === "GET") {
        event.respondWith(handleFILES(event));
      }
      break;
    case "STATIC":
      if (event.request.method === "GET") {
        event.respondWith(handleSTATIC(event));
      }
      break;
  }
});

function handleSTATIC(event) {
  return caches.match(event.request).then(function(resp) {
    return resp || fetch(event.request).then(function(response) {
      return caches.open( STATIC ).then(function(cache) {
        cache.put(event.request, response.clone());
        return response;
      });
    });
  });
}

function handleFILES(event) {
  return caches.match(event.request).then(function(resp) {
    return resp || fetch(event.request).then(function(response) {
      return caches.open( FILES ).then(function(cache) {
        cache.put(event.request, response.clone());
        return response;
      });
    });
  });
}

var api_fns = {
  // GET
  'authenticate':'{"end_time":' + (Date.now() + 12 * 3600 * 1000) + ',"id":"","result":200,"user_uri":""}',
  'get_ticket_trusted':'',
  'is_ticket_valid':'true',
  'get_rights':'{"@":"_","rdf:type":[{"data":"v-s:PermissionStatement","type":"Uri"}],"v-s:canCreate":[{"data":true,"type":"Boolean"}],"v-s:canDelete":[{"data":false,"type":"Boolean"}],"v-s:canRead":[{"data":true,"type":"Boolean"}],"v-s:canUpdate":[{"data":true,"type":"Boolean"}]}',
  'get_rights_origin':'',
  'get_membership':'{"@":"_","rdf:type":[{"data":"v-s:Membership","type":"Uri"}],"v-s:memberOf":[{"data":"v-s:AllResourcesGroup","type":"Uri"}]}',
  //'get_individual':'{"@":"_","rdf:type":[{"type":"Uri","data": "rdfs:Resource"}],"rdfs:label": [{"type": "String", "data": "Нет связи с сервером. Этот объект сейчас недоступен.", "lang": "RU"},{"type": "String", "data": "Server disconnected. This object is not available now.", "lang": "EN"}]}',

  // POST
  'query':'{"result":[],"count":0,"estimated":0,"processed":0,"cursor":0,"result_code":200}',
  'get_individuals':'[]',

  // PUT
  'remove_individual':'{"op_id":0,"result":200}',
  'put_individual':'{"op_id":0,"result":200}',
  'add_to_individual':'{"op_id":0,"result":200}',
  'set_in_individual':'{"op_id":0,"result":200}',
  'remove_from_individual':'{"op_id":0,"result":200}',
  'put_individuals':'{"op_id":0,"result":200}'
};

function handleError(response) {
  if (!response.ok) {
    throw response;
  }
  return response;
}

function handleAPI(event) {
  var cloneRequest = event.request.method !== "GET" && event.request.clone() ;
  var url = new URL(event.request.url);
  var fn = url.pathname.split("/")[2];
  if (event.request.method === "GET") {
    if (fn === "reset_individual") {
      // Fetch first
      return fetch(event.request)
        .then(handleError)
        .then(function(response) {
          return caches.open( API ).then(function(cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
    } else {
      // Cache first
      return caches.match(event.request).then(function(resp) {
        if (resp) { return resp; }
        return fetch(event.request)
          .then(handleError)
          .then(function(response) {
            return caches.open( API ).then(function(cache) {
              cache.put(event.request, response.clone());
              return response;
            });
          })
          .catch(function (error) {
            if (fn === "get_individual") {
              return error;
            } else {
              return new Response(api_fns[fn], { headers: { "Content-Type": "application/json" } });
            }
          });
      });
    }
  } else if (event.request.method === "POST") {
    // Fetch first
    return fetch(event.request)
      .then(handleError)
      .then(function(response) {
        var db = new LocalDB();
        return db.then(function (db) {
          Promise.all([serialize(cloneRequest), serialize(response)]).then(function (req_res) {
            var request = JSON.stringify(req_res[0]);
            var response = req_res[1];
            db.put(request, response);
          });
          return response;
        });
      })
      .catch(function(error) {
        return serialize(cloneRequest).then(function (request) {
          request = JSON.stringify(request);
          var db = new LocalDB();
          return db.then(function (db) {
            return db.get(request).then(deserialize);
          });
        });
      })
      .catch(function(error) {
        return new Response(api_fns[fn], { headers: { "Content-Type": "application/json" } });
      });
  } else if (event.request.method === "PUT") {
    // Fetch first
    return fetch(event.request)
      .then(handleError)
      .catch(function (error) {
        return enqueueRequest(cloneRequest).then(function (queue) {
          console.log("Offline operation added to queue, queue length = ", queue.length);
          return new Response(api_fns[fn], { headers: { "Content-Type": "application/json" } });
        });
      });
  }
}

// Offline PUT queue
function enqueueRequest(request) {
  var db = new LocalDB();
  return db.then(function (db) {
    return serialize(request).then(function (serializedRequest) {
      return db.get("offline-queue").then(function(queue) {
        queue = queue || [];
        queue.push(serializedRequest);
        return db.put("offline-queue", queue);
      });
    });
  });
}
function flushQueue() {
  var db = new LocalDB();
  return db.then(function (db) {
    return db.get("offline-queue").then(function(queue) {
      if (queue && queue.length) {
        return queue.reduce(function (prom, request) {
          return prom.then(function () {
            return deserialize(request);
          }).then(function (request) {
            return fetch(request);
          });
        }, Promise.resolve()).then(function () {
          db.remove("offline-queue");
          return queue.length;
        });
      } else {
        return Promise.resolve(0);
      }
    });
  });
}
this.addEventListener("message", function (event) {
  if (event.data === "online") {
    console.log("Window said 'online', flushing queue");
    flushQueue().then(function (queue_length) {
      console.log("Done, queue flushed", queue_length);
    });
  }
});

// indexedDB for non-GET requests
var db_name = "veda-sw";
var store = "sw";

var fallback = {
  get: function (key) {
    return Promise.resolve(this[key]);
  },
  put: function (key, value) {
    this[key] = value;
    return Promise.resolve(value);
  },
  remove: function (key) {
    var result = delete this[key];
    return Promise.resolve(result);
  }
};

var LocalDB = function () {

  var self = this;

  if (LocalDB.prototype._singletonInstance) {
    return Promise.resolve(LocalDB.prototype._singletonInstance);
  }

  return LocalDB.prototype._singletonInstance = initDB();

  function initDB() {

    return new Promise(function (resolve, reject) {

      var openReq = indexedDB.open(db_name, 1);

      openReq.onsuccess = function (event) {
        var db = event.target.result;
        self.db = db;
        console.log("DB open success");
        resolve(self);
      };

      openReq.onerror = function errorHandler(error) {
        console.log("DB open error", error);
        reject(error);
      };

      openReq.onupgradeneeded = function (event) {
        var db = event.target.result;
        db.createObjectStore(store);
        console.log("DB create success");
      };
    }).catch(function (error) {
      console.log("IndexedDB error, using in-memory fallback.\n", error);
      return fallback;
    });
  }
};

var proto = LocalDB.prototype;

proto.get = function (key) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var request = self.db.transaction([store], "readonly").objectStore(store).get(key);
    request.onerror = function(error) {
      reject(error);
    };
    request.onsuccess = function(event) {
      resolve(request.result);
    };
  });
};

proto.put = function (key, value) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var request = self.db.transaction([store], "readwrite").objectStore(store).put(value, key);
    request.onerror = function(error) {
      reject(error);
    };
    request.onsuccess = function(event) {
      resolve(value);
    };
  });
};

proto.remove = function (key) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var request = self.db.transaction([store], "readwrite").objectStore(store).delete(key);
    request.onerror = function(error) {
      reject(error);
    };
    request.onsuccess = function(event) {
      resolve(request.result);
    };
  });
};

function serialize(subject) {
  var headers = {};
  for (var entry of subject.headers.entries()) {
    headers[entry[0]] = entry[1];
  }
  var serialized;
  if (subject instanceof Request) {
    serialized = {
      url: subject.url,
      headers: headers,
      method: subject.method,
      mode: subject.mode,
      credentials: subject.credentials,
      cache: subject.cache,
      redirect: subject.redirect,
      referrer: subject.referrer
    };
  } else {
      serialized = {
      url: subject.url,
      headers: headers,
      ok: subject.ok,
      redirected: subject.redirected,
      status: subject.status,
      statusText: subject.statusText,
      type: subject.type
    };
  }
  return subject.clone().text().then(function(body) {
    serialized.body = body;
    return serialized;
  });
}

function deserialize(subject) {
  return subject.method ? new Request(subject.url, subject) : new Response(subject.body, subject);
}
