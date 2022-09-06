// Browser backend

import BackendError from '../browser/backend_error.js';

export default class BrowserBackend {
  static async get_rights (ticket, uri, user_id) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/get_rights',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'uri': isObj ? arg.uri : uri,
        'user_id': isObj ? arg.user_id : user_id,
      },
    };
    return call_server(params);
  }

  static async get_rights_origin (ticket, uri) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/get_rights_origin',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'uri': isObj ? arg.uri : uri,
      },
    };
    return call_server(params);
  }

  static async get_membership (ticket, uri) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/get_membership',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'uri': isObj ? arg.uri : uri,
      },
    };
    return call_server(params);
  }

  static async authenticate (login, password, secret) {
    const arg = login;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'POST',
      url: '/authenticate',
      data: {
        'login': isObj ? arg.login : login,
        'password': isObj ? arg.password : password,
        'secret': isObj ? arg.secret : secret,
      },
    };
    return call_server(params).then(adjustTicket);
  }

  static async get_ticket_trusted (ticket, login) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/get_ticket_trusted',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'login': isObj ? arg.login : login,
      },
    };
    return call_server(params).then(adjustTicket);
  }

  static async is_ticket_valid (ticket) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/is_ticket_valid',
      ticket: isObj ? arg.ticket : ticket,
      data: {},
    };
    return call_server(params);
  }

  static async logout (ticket) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/logout',
      ticket: isObj ? arg.ticket : ticket,
      data: {},
    };
    return call_server(params);
  }

  static async get_operation_state (module_id, wait_op_id) {
    const arg = module_id;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/get_operation_state',
      data: {
        'module_id': isObj ? arg.module_id : module_id,
        'wait_op_id': isObj ? arg.wait_op_id : wait_op_id,
      },
    };
    return call_server(params);
  }

  static async wait_module (module_id, op_id, __maxCalls = 10) {
    if (!__maxCalls) {
      return Promise.resolve(false);
    }
    const arg = module_id;
    const isObj = typeof arg === 'object';
    module_id = isObj ? arg.module_id : module_id;
    op_id = isObj ? arg.op_id : op_id;
    return wait(250 * (10 - __maxCalls))
      .then(() => BrowserBackend.get_operation_state(module_id, op_id))
      .then((module_op_id) =>
        module_op_id < op_id ?
          BrowserBackend.wait_module(module_id, op_id, --__maxCalls) :
          true,
      );
  }

  static async query (ticket, queryStr, sort, databases, top, limit, from, sql) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'POST',
      url: '/query',
      ticket: isObj ? arg.ticket : ticket,
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
        return wait().then(() => BrowserBackend.query(ticket, queryStr, sort, databases, top, limit, from, sql));
      }
      throw backendError;
    });
  }

  static async get_individual (ticket, uri, cache = true) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'GET',
      url: '/get_individual',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'uri': isObj ? arg.uri : uri,
        ...(!cache && {'vsn': Date.now()}),
      },
    };
    return call_server(params);
  }

  static async get_individuals (ticket, uris) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'POST',
      url: '/get_individuals',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'uris': isObj ? arg.uris : uris,
      },
    };
    return call_server(params);
  }

  static async remove_individual (ticket, uri, assigned_subsystems, event_id, transaction_id) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'PUT',
      url: '/remove_individual',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'uri': isObj ? arg.uri : uri,
        'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
        'prepare_events': true,
        'event_id': (isObj ? arg.event_id : event_id) || '',
        'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
      },
    };
    return call_server(params);
  }

  static async put_individual (ticket, individual, assigned_subsystems, event_id, transaction_id) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'PUT',
      url: '/put_individual',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'individual': isObj ? arg.individual : individual,
        'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
        'prepare_events': true,
        'event_id': (isObj ? arg.event_id : event_id) || '',
        'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
      },
    };
    return call_server(params);
  }

  static async add_to_individual (ticket, individual, assigned_subsystems, event_id, transaction_id) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'PUT',
      url: '/add_to_individual',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'individual': isObj ? arg.individual : individual,
        'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
        'prepare_events': true,
        'event_id': (isObj ? arg.event_id : event_id) || '',
        'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
      },
    };
    return call_server(params);
  }

  static async set_in_individual (ticket, individual, assigned_subsystems, event_id, transaction_id) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'PUT',
      url: '/set_in_individual',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'individual': isObj ? arg.individual : individual,
        'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
        'prepare_events': true,
        'event_id': (isObj ? arg.event_id : event_id) || '',
        'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
      },
    };
    return call_server(params);
  }

  static async remove_from_individual (ticket, individual, assigned_subsystems, event_id, transaction_id) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'PUT',
      url: '/remove_from_individual',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'individual': isObj ? arg.individual : individual,
        'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
        'prepare_events': true,
        'event_id': (isObj ? arg.event_id : event_id) || '',
        'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
      },
    };
    return call_server(params);
  }

  static async put_individuals (ticket, individuals, assigned_subsystems, event_id, transaction_id) {
    const arg = ticket;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'PUT',
      url: '/put_individuals',
      ticket: isObj ? arg.ticket : ticket,
      data: {
        'individuals': isObj ? arg.individuals : individuals,
        'assigned_subsystems': (isObj ? arg.assigned_subsystems : assigned_subsystems) || 0,
        'prepare_events': true,
        'event_id': (isObj ? arg.event_id : event_id) || '',
        'transaction_id': (isObj ? arg.transaction_id : transaction_id) || '',
      },
    };
    return call_server(params);
  }
}

/**
 * Common server call function
 * @param {Object} params
 * @return {Promise<Object>}
 */
async function call_server (params) {
  const url = new URL(params.url, location.origin);
  if (params.method === 'GET') {
    params.data = params.data && Object.entries(params.data).filter(([_, value]) => typeof value !== 'undefined') || '';
    url.search = new URLSearchParams(params.data).toString();
  }
  if (params.ticket) {
    url.searchParams.append('ticket', params.ticket);
  }
  const response = await fetch(url, {
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
  });
  if (response.ok) {
    return response.json();
  }
  throw new BackendError(response.status);
}

function wait (ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function adjustTicket (result) {
  return {
    ticket: result.id,
    user_uri: result.user_uri,
    end_time: Math.floor((result.end_time - 621355968000000000) / 10000),
  };
}
