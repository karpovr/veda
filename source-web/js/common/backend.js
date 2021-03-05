'use strict';

import veda from '../common/veda.js';

import LocalDB from '../browser/local_db.js';

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
  return new Promise(function (resolve, reject) {
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
  browserBackend.ping().then(function () {
    interval = clearInterval(interval);
    veda.trigger('online');
  }).catch(function () {
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

// Server errors

/**
 * Server errors constructor
 * @param {Error} result
 */
function BackendError (result) {
  const errorCodes = {
    0: 'Server unavailable',
    200: 'Ok',
    201: 'Created',
    204: 'No content',
    400: 'Bad request',
    403: 'Forbidden',
    404: 'Not found',
    422: 'Unprocessable entity',
    423: 'Locked',
    429: 'Too many requests',
    430: 'Too many password change fails',
    463: 'Password change is not allowed',
    464: 'Secret expired',
    465: 'Empty password',
    466: 'New password is equal to old',
    467: 'Invalid password',
    468: 'Invalid secret',
    469: 'Password expired',
    470: 'Ticket not found',
    471: 'Ticket expired',
    472: 'Not authorized',
    473: 'Authentication failed',
    474: 'Not ready',
    475: 'Fail open transaction',
    476: 'Fail commit',
    477: 'Fail store',
    500: 'Internal server error',
    501: 'Not implemented',
    503: 'Service unavailable',
    904: 'Invalid identifier',
    999: 'Database modified error',
    1021: 'Disk full',
    1022: 'Duplicate key',
    1118: 'Size too large',
    4000: 'Connect error',
  };
  this.code = result.status;
  this.name = errorCodes[this.code];
  this.status = result.status;
  this.message = errorCodes[this.code];
  this.stack = (new Error()).stack;
  if (result.status === 0 || result.status === 503 || result.status === 4000) {
    veda.trigger('offline');
    browserBackend.check();
  }
  if (result.status === 470 || result.status === 471) {
    veda.trigger('login:failed');
  }
}
BackendError.prototype = Object.create(Error.prototype);
BackendError.prototype.constructor = BackendError;

/**
 * Common server call function
 * @param {Object} params
 * @return {Promise<Object>}
 */
function call_server(params) {
  const method = params.method;
  const url = params.url;
  const data = params.data;
  const ticket = params.ticket;
  const timeout = params.timeout || default_timeout;
  let queryParams = [];
  let payload = null;
  return new Promise( function (resolve, reject) {
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
  return call_server(params).catch(function (BackendError) {
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
  return call_server(params).catch(function (BackendError) {
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
  return call_server(params).catch(function (BackendError) {
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
    .then(function (result) {
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
  return call_server(params).catch(function (BackendError) {
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
  return call_server(params).catch(function (BackendError) {
    if (BackendError.code === 999) {
      return browserBackend.query(ticket, queryStr, sort, databases, reopen, top, limit, from, sql);
    } else if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      params.ticket = undefined;
      const localDB = new LocalDB();
      return localDB.then(function (db) {
        return db.get(JSON.stringify(params));
      });
    } else {
      throw BackendError;
    }
  }).then(function (result) {
    if (result) {
      params.ticket = undefined;
      const localDB = new LocalDB();
      localDB.then(function (db) {
        db.put(JSON.stringify(params), result);
      });
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
    return localDB.then(function (db) {
      return db.get(params.data.uri);
    }).then(function (result) {
      return result || call_server(params)
        .then(function (individual) {
          const localDB = new LocalDB();
          localDB.then(function (db) {
            db.put(individual['@'], individual);
          }).catch(console.log);
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
  return call_server(params).then(function (individual) {
    const localDB = new LocalDB();
    localDB.then(function (db) {
      db.put(individual['@'], individual);
    });
    return individual;
  }).catch(function (BackendError) {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      // Cache second
      const localDB = new LocalDB();
      return localDB.then(function (db) {
        return db.get(params.data.uri);
      }).then(function (result) {
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
    return localDB.then(function (db) {
      const results = [];
      const get_from_server = [];
      return params.data.uris.reduce(function (p, uri, i) {
        return p.then(function() {
          return db.get(uri).then(function (result) {
            if (typeof result !== 'undefined') {
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
    return call_server(params).then(function (results) {
      const localDB = new LocalDB();
      localDB.then(function (db) {
        results.reduce(function (p, result) {
          p.then(function () {
            return db.put(result['@'], result);
          });
        }, Promise.resolve());
      });
      return results;
    }).catch(function (BackendError) {
      if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
        // Cache fallback
        const localDB = new LocalDB();
        return localDB.then(function (db) {
          const promises = params.data.uris.map(function (uri) {
            return db.get(uri);
          });
          return Promise.all(promises).then(function (fulfilled) {
            return fulfilled.filter(Boolean);
          });
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
function call_server_put(params) {
  return call_server(params).catch(function (BackendError) {
    if (BackendError.code === 0 || BackendError.code === 503 || BackendError.code === 4000 ) {
      return enqueueCall(params).then(function (queue) {
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
    .then(function () {
      const localDB = new LocalDB();
      return localDB.then(function (db) {
        return db.remove(params.data.uri);
      });
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
    .then(function () {
      const localDB = new LocalDB();
      localDB.then(function (db) {
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
    .then(function () {
      const localDB = new LocalDB();
      localDB.then(function (db) {
        params.data.individuals.forEach(function (individual) {
          db.put(individual['@'], individual);
        });
      }).catch(console.log);
    });
};

browserBackend.uploadFile = function (params, tries) {
  tries = typeof tries === 'number' ? tries : 5;
  return new Promise(function (resolve, reject) {
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
  }).catch(function (error) {
    if (tries > 0) {
      return browserBackend.uploadFile(params, --tries);
    }
    throw error;
  });
};

browserBackend.loadFile = function (url) {
  return new Promise(function (resolve, reject) {
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
};

// //////////////////////////////////////////////////////////////////////

/**
 * Enqueue failed PUT request to Offline queue to execute later
 * @param {Object} params
 * @return {Promise}
 */
function enqueueCall(params) {
  if (typeof params === 'object') {
    params.ticket = undefined;
  }
  const localDB = new LocalDB();
  return localDB.then(function (db) {
    return db.get('offline-queue').then(function(queue) {
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
function flushQueue() {
  const localDB = new LocalDB();
  return localDB.then(function (db) {
    return db.get('offline-queue').then(function(queue) {
      if (queue && queue.length) {
        if (veda.ticket) {
          return browserBackend.is_ticket_valid(veda.ticket).then(function (isValid) {
            if (isValid) {
              return queue.reduce(function (prom, params) {
                return prom.then(function () {
                  params = JSON.parse(params);
                  params.ticket = veda.ticket;
                  return call_server(params);
                }).catch(function (error) {
                  console.log('Offline queue operation failed:', params, error);
                });
              }, Promise.resolve()).then(function () {
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
veda.on('online started', function () {
  if (browserBackend.status === 'online') {
    console.log('Veda \'online\', flushing queue');
    flushQueue().then(function (queue_length) {
      console.log('Done, queue flushed', queue_length);
    }).catch(console.log);
  }
});
