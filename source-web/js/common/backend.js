// Backend

import veda from '../common/veda.js';

import LocalDB from '../browser/local_db.js';

import BackendError from '../common/backend_error.js';

const serverBackend = {};

const browserBackend = {};

export default veda.Backend = ( veda.env === 'server' ? serverBackend : browserBackend );

// ////////////   SERVER   ///////////////

serverBackend.status = 'limited';

serverBackend.query = function (ticket, queryStr, sort, databases, top, limit, from) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    queryStr = arg.query;
    sort = arg.sort;
    databases = arg.databases;
    top = arg.top;
    limit = arg.limit;
    from = arg.from;
  }
  try {
    return Promise.resolve( query(ticket, queryStr, sort, databases, top, limit, from) );
  } catch (err) {
    return Promise.reject(err);
  }
};

serverBackend.get_individual = function (ticket, uri) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    uri = arg.uri;
  }
  try {
    const json = get_individual(ticket, uri);
    if (json) {
      return Promise.resolve(json);
    } else {
      return Promise.reject(Error('Not found'));
    }
  } catch (err) {
    return Promise.reject(err);
  }
};

serverBackend.reset_individual = serverBackend.get_individual;

serverBackend.get_individuals = function (ticket, uris) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    uris = arg.uris;
  }
  try {
    return Promise.resolve( get_individuals(ticket, uris) );
  } catch (err) {
    return Promise.reject(err);
  }
};

serverBackend.remove_individual = function (ticket, uri) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    uri = arg.uri;
  }
  try {
    return Promise.resolve( remove_individual(ticket, uri) );
  } catch (err) {
    return Promise.reject(err);
  }
};

serverBackend.put_individual = function (ticket, individual) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    individual = arg.individual;
  }
  try {
    return Promise.resolve( put_individual(ticket, individual) );
  } catch (err) {
    return Promise.reject(err);
  }
};

serverBackend.add_to_individual = function (ticket, individual) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    individual = arg.individual;
  }
  try {
    return Promise.resolve( add_to_individual(ticket, individual) );
  } catch (err) {
    return Promise.reject(err);
  }
};

serverBackend.set_in_individual = function (ticket, individual) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    individual = arg.individual;
  }
  try {
    return Promise.resolve( set_in_individual(ticket, individual) );
  } catch (err) {
    return Promise.reject(err);
  }
};

serverBackend.remove_from_individual = function (ticket, individual) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  if (isObj) {
    ticket = arg.ticket;
    individual = arg.individual;
  }
  try {
    return Promise.resolve( remove_from_individual(ticket, individual) );
  } catch (err) {
    return Promise.reject(err);
  }
};

// ////////////   BROWSER   //////////////

const default_timeout = 15000;
const query_timeout = default_timeout * 10;

// Check server health
browserBackend.ping = function () {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (this.status == 200) {
        resolve(this);
      } else {
        reject(Error('ping failed'));
      }
    };
    xhr.onerror = reject;
    xhr.ontimeout = reject;
    xhr.open('GET', '/ping');
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    xhr.timeout = default_timeout;
    xhr.send();
  });
};

browserBackend.status = 'offline';
const status = {};

/**
 * Line status event handler
 * @param {string} state
 * @this AppModel
 */
function setStatus (state) {
  status.line = state === 'online' ? 1 : state === 'offline' ? 0 : status.line;
  status.ccus = state === 'ccus-online' ? 1 : state === 'ccus-offline' ? 0 : status.ccus;
  if (status.line && status.ccus) {
    browserBackend.status = 'online';
  } else if (status.line && !status.ccus) {
    browserBackend.status = 'limited';
  } else {
    browserBackend.status = 'offline';
  }
  this.trigger('status', browserBackend.status);
};
veda.on('online offline ccus-online ccus-offline', setStatus);

let interval;
const duration = default_timeout;
const check = function () {
  browserBackend.ping().then(() => {
    interval = clearInterval(interval);
    veda.trigger('online');
  }).catch(() => {
    veda.trigger('offline');
  });
};

browserBackend.check = function () {
  if (interval) {
    return;
  }
  interval = setInterval(check, duration);
  if (!arguments.length) {
    check();
  }
};
if (typeof window !== 'undefined') {
  window.addEventListener('online', browserBackend.check);
  window.addEventListener('offline', browserBackend.check);
  veda.on('ccus-online', browserBackend.check);
  veda.on('ccus-offline', browserBackend.check);
}

/**
 * Common server call function
 * @param {Object} params
 * @return {Promise<Object>}
 */
function call_server (params) {
  const method = params.method;
  const url = params.url;
  const data = params.data;
  const ticket = params.ticket;
  const timeout = params.timeout || default_timeout;
  let queryParams = [];
  let payload = null;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (this.status == 200) {
        resolve( JSON.parse(this.response) );
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
    if (ticket) {
      queryParams.push('ticket=' + ticket);
    }
    if (method === 'GET') {
      for (const name in data) {
        if (typeof data[name] !== 'undefined') {
          queryParams.push(name + '=' + encodeURIComponent(data[name]));
        }
      }
      queryParams = queryParams.join('&');
    }
    xhr.open(method, url + '?' + queryParams, true);
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    xhr.timeout = timeout;
    if (method !== 'GET') {
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      payload = JSON.stringify(data);
    }
    xhr.send(payload);
  }).catch((error) => {
    if (error.code === 0 || error.code === 503 || error.code === 4000) {
      veda.trigger('offline');
      browserBackend.check();
    }
    if (error.code === 470 || error.code === 471) {
      veda.trigger('login:failed');
    }
    throw error;
  });
}

browserBackend.get_rights = function (ticket, uri) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_rights',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uri': isObj ? arg.uri : uri,
    },
  };
  return call_server(params).catch((BackendError) => {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      return {
        '@': '_',
        'rdf:type': [{'data': 'v-s:PermissionStatement', 'type': 'Uri'}],
        'v-s:canCreate': [{'data': true, 'type': 'Boolean'}],
        'v-s:canDelete': [{'data': false, 'type': 'Boolean'}],
        'v-s:canRead': [{'data': true, 'type': 'Boolean'}],
        'v-s:canUpdate': [{'data': true, 'type': 'Boolean'}],
      };
    } else {
      throw BackendError;
    }
  });
};

browserBackend.get_rights_origin = function (ticket, uri) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_rights_origin',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uri': isObj ? arg.uri : uri,
    },
  };
  return call_server(params).catch((BackendError) => {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      return [];
    } else {
      throw BackendError;
    }
  });
};

browserBackend.get_membership = function (ticket, uri) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_membership',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uri': isObj ? arg.uri : uri,
    },
  };
  return call_server(params).catch((BackendError) => {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      return {
        '@': '_',
        'rdf:type': [{'data': 'v-s:Membership', 'type': 'Uri'}],
        'v-s:memberOf': [{'data': 'v-s:AllResourcesGroup', 'type': 'Uri'}],
        'v-s:resource': [{'data': isObj ? arg.uri : uri, 'type': 'Uri'}],
      };
    } else {
      throw BackendError;
    }
  });
};


browserBackend.authenticate = function (login, password, secret) {
  if (login == 'VedaNTLMFilter') {
    login = 'cfg:Guest';
  }
  const arg = login;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/authenticate',
    timeout: default_timeout,
    data: {
      'login': isObj ? arg.login : login,
      'password': isObj ? arg.password : password,
      'secret': isObj ? arg.secret : secret,
    },
  };
  return call_server(params)
    .then((result) => {
      return {
        ticket: result.id,
        user_uri: result.user_uri,
        end_time: Math.floor((result.end_time - 621355968000000000) / 10000),
      };
    });
};

browserBackend.get_ticket_trusted = function (ticket, login) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_ticket_trusted',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'login': isObj ? arg.login : login,
    },
  };
  return call_server(params);
};

browserBackend.is_ticket_valid = function (ticket) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/is_ticket_valid',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {},
  };
  return call_server(params).catch((BackendError) => {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      return true;
    } else {
      throw BackendError;
    }
  });
};

browserBackend.get_operation_state = function (module_id, wait_op_id) {
  const arg = module_id;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_operation_state',
    timeout: default_timeout,
    data: {
      'module_id': isObj ? arg.module_id : module_id,
      'wait_op_id': isObj ? arg.wait_op_id : wait_op_id,
    },
  };
  return call_server(params);
};

browserBackend.wait_module = function (module_id, in_op_id) {
  let timeout = 1;
  let op_id_from_module;
  for (let i = 0; i < 100; i++) {
    op_id_from_module = browserBackend.get_operation_state(module_id, in_op_id);
    if (op_id_from_module >= in_op_id) {
      break;
    }
    const endtime = new Date().getTime() + timeout;
    while (new Date().getTime() < endtime);
    timeout += 2;
  }
};

browserBackend.query = function (ticket, queryStr, sort, databases, reopen, top, limit, from, sql) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'POST',
    url: '/query',
    ticket: isObj ? arg.ticket : ticket,
    timeout: query_timeout,
    data: {
      'query': isObj ? arg.query : queryStr,
      'sort': isObj ? arg.sort : sort,
      'databases': isObj ? arg.databases : databases,
      'reopen': isObj ? arg.reopen : reopen,
      'top': isObj ? arg.top : top,
      'limit': isObj ? arg.limit : limit,
      'from': isObj ? arg.from : from,
      'sql': isObj ? arg.sql : sql,
    },
  };
  return call_server(params).catch((BackendError) => {
    if (BackendError.code === 999) {
      return browserBackend.query(ticket, queryStr, sort, databases, reopen, top, limit, from, sql);
    } else if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      params.ticket = undefined;
      const localDB = new LocalDB();
      return localDB.then((db) => db.get(JSON.stringify(params)));
    } else {
      throw BackendError;
    }
  }).then((result) => {
    if (result) {
      params.ticket = undefined;
      const localDB = new LocalDB();
      localDB.then((db) => db.put(JSON.stringify(params), result));
    } else {
      result = {
        'result': [],
        'count': 0,
        'estimated': 0,
        'processed': 0,
        'cursor': 0,
        'result_code': 200,
      };
    }
    return result;
  });
};

browserBackend.get_individual = function (ticket, uri, reopen) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uri': isObj ? arg.uri : uri,
      'reopen': (isObj ? arg.reopen : reopen) || false,
    },
  };
  if (browserBackend.status === 'online' || browserBackend.status === 'offline') {
    // Cache first
    const localDB = new LocalDB();
    return localDB
      .then((db) => db.get(params.data.uri))
      .then((result) => {
        return result || call_server(params)
          .then((individual) => {
            const localDB = new LocalDB();
            localDB.then((db) => db.put(individual['@'], individual)).catch(console.log);
            return individual;
          });
      });
  } else {
    // Fetch second
    return browserBackend.reset_individual(ticket, uri, reopen);
  }
};

browserBackend.reset_individual = function (ticket, uri, reopen) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uri': isObj ? arg.uri : uri,
      'reopen': (isObj ? arg.reopen : reopen) || false,
    },
  };
  // Fetch first
  return call_server(params).then((individual) => {
    const localDB = new LocalDB();
    localDB.then((db) => db.put(individual['@'], individual));
    return individual;
  }).catch((BackendError) => {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      // Cache second
      const localDB = new LocalDB();
      return localDB
        .then((db) => db.get(params.data.uri))
        .then((result) => {
          if (result) {
            return result;
          } else {
            throw BackendError;
          }
        });
    } else {
      throw BackendError;
    }
  });
};

browserBackend.get_individuals = function (ticket, uris) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'POST',
    url: '/get_individuals',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uris': isObj ? arg.uris : uris,
    },
  };
  if (browserBackend.status === 'online' || browserBackend.status === 'offline') {
    // Cache first
    const localDB = new LocalDB();
    return localDB.then((db) => {
      const results = [];
      const get_from_server = [];
      return params.data.uris.reduce((p, uri, i) => {
        return p.then(() => {
          return db.get(uri).then((result) => {
            if (typeof result !== 'undefined') {
              results[i] = result;
            } else {
              get_from_server.push(uri);
            }
            return results;
          }).catch(() => {
            get_from_server.push(uri);
            return results;
          });
        });
      }, Promise.resolve(results))
        .then((results) => {
          if (get_from_server.length) {
            params.data.uris = get_from_server;
            return call_server(params);
          } else {
            return [];
          }
        })
        .then((results_from_server) => {
          for (let i = 0, j = 0, length = results_from_server.length; i < length; i++) {
            while (results[j++]); // Fast forward to empty element
            results[j-1] = results_from_server[i];
            db.put(results_from_server[i]['@'], results_from_server[i]);
          }
          return results;
        })
        .catch(console.log);
    });
  } else {
    // Fetch second
    return call_server(params).then((results) => {
      const localDB = new LocalDB();
      localDB.then((db) => {
        results.reduce((p, result) => {
          p.then(() => {
            return db.put(result['@'], result);
          });
        }, Promise.resolve());
      });
      return results;
    }).catch((BackendError) => {
      if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
        // Cache fallback
        const localDB = new LocalDB();
        return localDB.then((db) => {
          const promises = params.data.uris.map((uri) => db.get(uri));
          return Promise.all(promises).then((fulfilled) => fulfilled.filter(Boolean));
        });
      } else {
        throw BackendError;
      }
    });
  }
};

/**
 * Common server PUT call function
 * @param {Object} params
 * @return {Promise<Object>}
 */
function call_server_put (params) {
  return call_server(params).catch((BackendError) => {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      return enqueueCall(params).then((queue) => {
        console.log('Offline operation added to queue, queue length = ', queue.length);
        return {
          'op_id': 0,
          'result': 200,
        };
      });
    } else {
      throw BackendError;
    }
  });
}

browserBackend.remove_individual = function (ticket, uri, assigned_subsystems, event_id, transaction_id) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'PUT',
    url: '/remove_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uri': isObj ? arg.uri : uri,
      'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      'prepare_events': true,
      'event_id': (isObj ? arg.event_id : event_id) || '',
      'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
    },
  };
  return call_server_put(params)
    .then(() => {
      const localDB = new LocalDB();
      return localDB.then((db) => db.remove(params.data.uri));
    });
};

browserBackend.put_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'PUT',
    url: '/put_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'individual': isObj ? arg.individual : individual,
      'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      'prepare_events': true,
      'event_id': (isObj ? arg.event_id : event_id) || '',
      'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
    },
  };
  return call_server_put(params)
    .then(() => {
      const localDB = new LocalDB();
      localDB.then((db) => {
        db.put(params.data.individual['@'], params.data.individual);
      }).catch(console.log);
    });
};

browserBackend.add_to_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'PUT',
    url: '/add_to_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'individual': isObj ? arg.individual : individual,
      'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      'prepare_events': true,
      'event_id': (isObj ? arg.event_id : event_id) || '',
      'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
    },
  };
  return call_server_put(params);
};

browserBackend.set_in_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'PUT',
    url: '/set_in_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'individual': isObj ? arg.individual : individual,
      'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      'prepare_events': true,
      'event_id': (isObj ? arg.event_id : event_id) || '',
      'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
    },
  };
  return call_server_put(params);
};

browserBackend.remove_from_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'PUT',
    url: '/remove_from_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'individual': isObj ? arg.individual : individual,
      'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      'prepare_events': true,
      'event_id': (isObj ? arg.event_id : event_id) || '',
      'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
    },
  };
  return call_server_put(params);
};

browserBackend.put_individuals = function (ticket, individuals, assigned_subsystems, event_id, transaction_id) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'PUT',
    url: '/put_individuals',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'individuals': isObj ? arg.individuals : individuals,
      'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
      'prepare_events': true,
      'event_id': (isObj ? arg.event_id : event_id) || '',
      'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
    },
  };
  return call_server_put(params)
    .then(() => {
      const localDB = new LocalDB();
      localDB.then((db) => {
        params.data.individuals.forEach((individual) => {
          db.put(individual['@'], individual);
        });
      }).catch(console.log);
    });
};

browserBackend.uploadFile = function (params, tries) {
  tries = typeof tries === 'number' ? tries : 5;
  return new Promise((resolve, reject) => {
    const done = () => {
      if (xhr.status === 200) {
        resolve(params);
      } else {
        reject(Error('File upload error'));
      }
    };
    const fail = () => {
      reject(Error('File upload error'));
    };
    const file = params.file;
    const path = params.path;
    const uri = params.uri;
    const progress = params.progress;
    const url = '/files';
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    xhr.open('POST', url, true);
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = progress;
    xhr.onload = done;
    xhr.onerror = fail;
    xhr.onabort = fail;
    xhr.ontimeout = fail;
    fd.append('path', path);
    fd.append('uri', uri);
    if (file instanceof File) {
      fd.append('file', file);
    } else if (file instanceof Image) {
      fd.append('content', file.src);
    }
    xhr.send(fd);
  }).catch((error) => {
    if (tries > 0) {
      return browserBackend.uploadFile(params, --tries);
    }
    throw error;
  });
};

const memoize = (fn) => {
  const cache = {};
  return (...args) => {
    const n = args[0];
    if (n in cache) {
      return cache[n];
    } else {
      const result = fn(n);
      cache[n] = result;
      return result;
    }
  };
};

browserBackend.loadFile = memoize((url) => {
  return new Promise((resolve, reject) => {
    const done = () => {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(Error('File load error'));
      }
    };
    const fail = () => {
      reject(Error('File load error'));
    };
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 10 * 60 * 1000;
    xhr.onload = done;
    xhr.onerror = fail;
    xhr.onabort = fail;
    xhr.ontimeout = fail;
    xhr.send();
  });
});

// //////////////////////////////////////////////////////////////////////

/**
 * Enqueue failed PUT request to Offline queue to execute later
 * @param {Object} params
 * @return {Promise}
 */
function enqueueCall (params) {
  if (typeof params === 'object') {
    params.ticket = undefined;
  }
  const localDB = new LocalDB();
  return localDB.then((db) => {
    return db.get('offline-queue').then((queue) => {
      queue = queue || [];
      queue.push( JSON.stringify(params) );
      return db.put('offline-queue', queue);
    });
  });
}

/**
 * Execute enqueued requests
 * @return {Promise}
 */
function flushQueue () {
  const localDB = new LocalDB();
  return localDB.then((db) => {
    return db.get('offline-queue').then((queue) => {
      if (queue && queue.length) {
        if (veda.ticket) {
          return browserBackend.is_ticket_valid(veda.ticket).then((isValid) => {
            if (isValid) {
              return queue.reduce((prom, params) => {
                return prom.then(() => {
                  params = JSON.parse(params);
                  params.ticket = veda.ticket;
                  return call_server(params);
                }).catch((error) => {
                  console.log('Offline queue operation failed:', params, error);
                });
              }, Promise.resolve()).then(() => {
                db.remove('offline-queue');
                return queue.length;
              });
            } else {
              return Promise.reject(Error('Ticket is not valid, skip queue flushing.'));
            }
          });
        } else {
          return Promise.reject(Error('No ticket, skip queue flushing.'));
        }
      } else {
        return 0;
      }
    });
  });
}
veda.on('online started', () => {
  if (browserBackend.status === 'online') {
    console.log('Veda \'online\', flushing queue');
    flushQueue().then((queue_length) => {
      console.log('Done, queue flushed', queue_length);
    }).catch(console.log);
  }
});
