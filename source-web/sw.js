// API calls caching service worker

const veda_version = 7;

const FILES = 'files';
const STATIC = 'static';
const API = [
  '/ping',
  '/get_rights',
  '/get_rights_origin',
  '/get_membership',
  '/authenticate',
  '/get_ticket_trusted',
  '/is_ticket_valid',
  '/get_operation_state',
  '/wait_module',
  '/query',
  '/get_individual',
  '/get_individuals',
  '/remove_individual',
  '/put_individual',
  '/add_to_individual',
  '/set_in_individual',
  '/remove_from_individual',
  '/put_individuals',
];
const NTLM = [
  '/ntlm',
  '/ntlm/',
  '/no',
  '/no/',
  '/ad',
  '/ad/',
];

addEventListener('message', (event) => {
  if (event.data === 'veda_version') {
    event.source.postMessage(veda_version);
  }
});

/**
 * Clear cached resources
 * @param {Event} event
 * @return {void}
 */
function clearCache(event) {
  self.skipWaiting();
  console.log(`Service worker updated, veda_version = ${veda_version}. Clear cache.`);
  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(keyList.map(function(key) {
        return caches.delete(key);
      }));
    }),
  );
}
self.addEventListener('install', clearCache);

self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  const isAPI = API.indexOf(pathname) >= 0;
  const isNTLM = NTLM.indexOf(pathname) >= 0;
  const isFILES = pathname.indexOf('/files') === 0;
  const isSTATIC = !isAPI && !isFILES && !isNTLM;
  const METHOD = event.request.method;
  if (isAPI) {
    event.respondWith(handleAPI(event));
  } else if (isFILES && METHOD === 'GET') {
    event.respondWith(handleFetch(event, FILES));
  } else if (isSTATIC && METHOD === 'GET') {
    event.respondWith(handleFetch(event, STATIC));
  }
});

/**
 * Fetch event handler
 * @param {Event} event
 * @param {string} CACHE
 * @return {Promise<Response>}
 */
function handleFetch(event, CACHE) {
  return caches.match(event.request).then(function(resp) {
    return resp || fetch(event.request).then(function(response) {
      if (response.ok) {
        return caches.open( CACHE ).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      }
      return response;
    });
  });
}

const api_fns = {
  // GET
  'authenticate': '{"end_time":' + (Date.now() + 12 * 3600 * 1000) + ',"id":"","result":200,"user_uri":""}',
  'get_ticket_trusted': '',
  'is_ticket_valid': 'true',
  'get_rights': '{"@":"_","rdf:type":[{"data":"v-s:PermissionStatement","type":"Uri"}],"v-s:canCreate":[{"data":true,"type":"Boolean"}],"v-s:canDelete":[{"data":false,"type":"Boolean"}],"v-s:canRead":[{"data":true,"type":"Boolean"}],"v-s:canUpdate":[{"data":true,"type":"Boolean"}]}',
  'get_rights_origin': '',
  'get_membership': '{"@":"_","rdf:type":[{"data":"v-s:Membership","type":"Uri"}],"v-s:memberOf":[{"data":"v-s:AllResourcesGroup","type":"Uri"}]}',
  // 'get_individual':'{"@":"_","rdf:type":[{"type":"Uri","data": "rdfs:Resource"}],"rdfs:label": [{"type": "String", "data": "Нет связи с сервером. Этот объект сейчас недоступен.", "lang": "RU"},{"type": "String", "data": "Server disconnected. This object is not available now.", "lang": "EN"}]}',

  // POST
  'query': '{"result":[],"count":0,"estimated":0,"processed":0,"cursor":0,"result_code":200}',
  'get_individuals': '[]',

  // PUT
  'remove_individual': '{"op_id":0,"result":200}',
  'put_individual': '{"op_id":0,"result":200}',
  'add_to_individual': '{"op_id":0,"result":200}',
  'set_in_individual': '{"op_id":0,"result":200}',
  'remove_from_individual': '{"op_id":0,"result":200}',
  'put_individuals': '{"op_id":0,"result":200}',
};

/**
 * Common request handler
 * @param {Response} response
 * @return {Response}
 */
function handleError(response) {
  if (!response.ok) {
    throw response;
  }
  return response;
}

/**
 * API call handler
 * @param {Event} event
 * @return {Response}
 */
function handleAPI(event) {
  const cloneRequest = event.request.method !== 'GET' && event.request.clone();
  const url = new URL(event.request.url);
  const fn = url.pathname.split('/')[2];
  if (event.request.method === 'GET') {
    if (fn === 'reset_individual') {
      // Fetch first
      return fetch(event.request)
        .then(handleError)
        .then(function(response) {
          const clone = response.clone();
          caches.open( API ).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        });
    } else {
      // Cache first
      return caches.match(event.request).then(function(resp) {
        if (resp) {
          return resp;
        }
        return fetch(event.request)
          .then(handleError)
          .then(function(response) {
            const clone = response.clone();
            caches.open( API ).then(function(cache) {
              cache.put(event.request, clone);
            });
            return response;
          })
          .catch(function (error) {
            if (fn === 'get_individual') {
              return error;
            } else {
              return new Response(api_fns[fn], {headers: {'Content-Type': 'application/json'}});
            }
          });
      });
    }
  } else if (event.request.method === 'POST') {
    // Fetch first
    return fetch(event.request)
      .then(handleError)
      .then(function(response) {
        const db = new LocalDB();
        return db.then(function (db) {
          Promise.all([serialize(cloneRequest), serialize(response)]).then(function (req_res) {
            const request = JSON.stringify(req_res[0]);
            const response = req_res[1];
            db.put(request, response);
          });
          return response;
        });
      })
      .catch(function(error) {
        return serialize(cloneRequest).then(function (request) {
          request = JSON.stringify(request);
          const db = new LocalDB();
          return db.then(function (db) {
            return db.get(request).then(deserialize);
          });
        });
      })
      .catch(function(error) {
        return new Response(api_fns[fn], {headers: {'Content-Type': 'application/json'}});
      });
  } else if (event.request.method === 'PUT') {
    // Fetch first
    return fetch(event.request)
      .then(handleError)
      .catch(function (error) {
        return enqueueRequest(cloneRequest).then(function (queue) {
          console.log('Offline operation added to queue, queue length = ', queue.length);
          return new Response(api_fns[fn], {headers: {'Content-Type': 'application/json'}});
        });
      });
  }
}

/**
 * Offline PUT queue
 * @param {Request} request
 * @return {Request}
 */
function enqueueRequest(request) {
  const db = new LocalDB();
  return db.then(function (db) {
    return serialize(request).then(function (serializedRequest) {
      return db.get('offline-queue').then(function(queue) {
        queue = queue || [];
        queue.push(serializedRequest);
        return db.put('offline-queue', queue);
      });
    });
  });
}

/**
 * Flush offline PUT queue
 * @return {Promise<Number>}
 */
function flushQueue() {
  const db = new LocalDB();
  return db.then(function (db) {
    return db.get('offline-queue').then(function(queue) {
      if (queue && queue.length) {
        return queue.reduce(function (prom, request) {
          return prom.then(function () {
            return deserialize(request);
          }).then(function (request) {
            return fetch(request);
          });
        }, Promise.resolve()).then(function () {
          db.remove('offline-queue');
          return queue.length;
        });
      } else {
        return Promise.resolve(0);
      }
    });
  });
}
self.addEventListener('message', function (event) {
  if (event.data === 'online') {
    console.log('Window said \'online\', flushing queue');
    flushQueue().then(function (queue_length) {
      console.log('Done, queue flushed', queue_length);
    });
  }
});

// indexedDB for non-GET requests
const db_name = 'veda-sw';
const store = 'sw';

const fallback = {
  get: function (key) {
    return Promise.resolve(this[key]);
  },
  put: function (key, value) {
    this[key] = value;
    return Promise.resolve(value);
  },
  remove: function (key) {
    const result = delete this[key];
    return Promise.resolve(result);
  },
};

const LocalDB = function () {
  const self = this;

  if (LocalDB.prototype._singletonInstance) {
    return Promise.resolve(LocalDB.prototype._singletonInstance);
  }

  return LocalDB.prototype._singletonInstance = initDB();

  /**
   * Init db
   * @return {Request}
   */
  function initDB() {
    return new Promise(function (resolve, reject) {
      const openReq = indexedDB.open(db_name, 1);

      openReq.onsuccess = function (event) {
        const db = event.target.result;
        self.db = db;
        console.log('DB open success');
        resolve(self);
      };

      openReq.onerror = function errorHandler(error) {
        console.log('DB open error', error);
        reject(error);
      };

      openReq.onupgradeneeded = function (event) {
        const db = event.target.result;
        db.createObjectStore(store);
        console.log('DB create success');
      };
    }).catch(function (error) {
      console.log('IndexedDB error, using in-memory fallback.\n', error);
      return fallback;
    });
  }
};

const proto = LocalDB.prototype;

proto.get = function (key) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const request = self.db.transaction([store], 'readonly').objectStore(store).get(key);
    request.onerror = function(error) {
      reject(error);
    };
    request.onsuccess = function(event) {
      resolve(request.result);
    };
  });
};

proto.put = function (key, value) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const request = self.db.transaction([store], 'readwrite').objectStore(store).put(value, key);
    request.onerror = function(error) {
      reject(error);
    };
    request.onsuccess = function(event) {
      resolve(value);
    };
  });
};

proto.remove = function (key) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const request = self.db.transaction([store], 'readwrite').objectStore(store).delete(key);
    request.onerror = function(error) {
      reject(error);
    };
    request.onsuccess = function(event) {
      resolve(request.result);
    };
  });
};

/**
 * Serialize Request / Response
 * @param {Request|Response} subject
 * @return {JSON}
 */
function serialize(subject) {
  const headers = {};
  for (const entry of subject.headers.entries()) {
    headers[entry[0]] = entry[1];
  }
  let serialized;
  if (subject instanceof Request) {
    serialized = {
      url: subject.url,
      headers: headers,
      method: subject.method,
      mode: subject.mode,
      credentials: subject.credentials,
      cache: subject.cache,
      redirect: subject.redirect,
      referrer: subject.referrer,
    };
  } else {
    serialized = {
      url: subject.url,
      headers: headers,
      ok: subject.ok,
      redirected: subject.redirected,
      status: subject.status,
      statusText: subject.statusText,
      type: subject.type,
    };
  }
  return subject.clone().text().then(function(body) {
    serialized.body = body;
    return serialized;
  });
}

/**
 * Deserialize Request / Response
 * @param {JSON} subject
 * @return {Request|Response}
 */
function deserialize(subject) {
  return subject.method ? new Request(subject.url, subject) : new Response(subject.body, subject);
}
