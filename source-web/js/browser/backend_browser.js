// Browser backend

import veda from '../common/veda.js';

import BackendError from '../browser/backend_error.js';

const BrowserBackend = {};

export default BrowserBackend;

const default_timeout = 15000;

const query_timeout = default_timeout * 10;

/**
 * Common server call function
 * @param {Object} params
 * @return {Promise<Object>}
 */
function call_server (params) {
  const url = new URL(params.url, location.origin);
  if (params.method === 'GET') {
    params.data = params.data && Object.entries(params.data).filter(([_, value]) => typeof value !== 'undefined') || '';
    url.search = new URLSearchParams(params.data).toString();
  }
  if (params.ticket) {
    url.searchParams.append('ticket', params.ticket);
  }
  return fetch(url, {
    method: params.method,
    mode: 'same-origin',
    cache: 'no-cache',
    credentials: 'same-origin',
    ...(params.method !== 'GET' && {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.data),
    }),
  }).then((response) => {
    if (response.ok) {
      return response.json();
    }
    if (response.status === 470 || response.status === 471) {
      veda.trigger('login:failed');
    }
    throw new BackendError(response.status);
  });
}

BrowserBackend.get_rights = function (ticket, uri) {
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
  return call_server(params);
};

BrowserBackend.get_rights_origin = function (ticket, uri) {
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
  return call_server(params);
};

BrowserBackend.get_membership = function (ticket, uri) {
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
  return call_server(params);
};


BrowserBackend.authenticate = function (login, password, secret) {
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

BrowserBackend.get_ticket_trusted = function (ticket, login) {
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
  return call_server(params)
    .then((result) => {
      return {
        ticket: result.id,
        user_uri: result.user_uri,
        end_time: Math.floor((result.end_time - 621355968000000000) / 10000),
      };
    });
};

BrowserBackend.is_ticket_valid = function (ticket) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/is_ticket_valid',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {},
  };
  return call_server(params);
};

BrowserBackend.get_operation_state = function (module_id, wait_op_id) {
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

BrowserBackend.wait_module = function (module_id, in_op_id) {
  let timeout = 1;
  let op_id_from_module;
  for (let i = 0; i < 100; i++) {
    op_id_from_module = BrowserBackend.get_operation_state(module_id, in_op_id);
    if (op_id_from_module >= in_op_id) {
      break;
    }
    const endtime = new Date().getTime() + timeout;
    while (new Date().getTime() < endtime);
    timeout += 2;
  }
};

BrowserBackend.query = function (ticket, queryStr, sort, databases, top, limit, from, sql) {
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
      'top': isObj ? arg.top : top,
      'limit': isObj ? arg.limit : limit,
      'from': isObj ? arg.from : from,
      'sql': isObj ? arg.sql : sql,
    },
  };
  return call_server(params).catch((backendError) => {
    if (backendError.code === 999) {
      return BrowserBackend.query(ticket, queryStr, sort, databases, reopen, top, limit, from, sql);
    }
  });
};

BrowserBackend.get_individual = function (ticket, uri, cache = true) {
  const arg = ticket;
  const isObj = typeof arg === 'object';
  const params = {
    method: 'GET',
    url: '/get_individual',
    ticket: isObj ? arg.ticket : ticket,
    timeout: default_timeout,
    data: {
      'uri': isObj ? arg.uri : uri,
      ...(!cache && {'vsn': Date.now()}),
    },
  };
  return call_server(params);
};

BrowserBackend.get_individuals = function (ticket, uris) {
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
  return call_server(params);
};

BrowserBackend.remove_individual = function (ticket, uri, assigned_subsystems, event_id, transaction_id) {
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
  return call_server(params);
};

BrowserBackend.put_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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
  return call_server(params);
};

BrowserBackend.add_to_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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
  return call_server(params);
};

BrowserBackend.set_in_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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
  return call_server(params);
};

BrowserBackend.remove_from_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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
  return call_server(params);
};

BrowserBackend.put_individuals = function (ticket, individuals, assigned_subsystems, event_id, transaction_id) {
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
  return call_server(params);
};
