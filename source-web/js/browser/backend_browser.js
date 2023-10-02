/**
 * Browser backend
 * @module BrowserBackend
 */

import BackendError from '../browser/backend_error.js';

/**
 * Class representing the backend for browser interactions.
 */
export default class BrowserBackend {
  /**
   * Get rights for a specific ticket, URI, and user ID.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string} uri - The URI for which to get the rights.
   * @param {string} user_id - The user ID for which to get the rights.
   * @return {Promise} A Promise that resolves to the server response.
   */
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

  /**
   * Get rights origin for a specific ticket and URI.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string} uri - The URI for which to get the rights origin.
   * @return {Promise} A Promise that resolves to the server response.
   */
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

  /**
   * Get the membership information for a specific ticket and URI.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string} uri - The URI for which to get the membership information.
   * @return {Promise<object>} A Promise that resolves to the server response containing the membership information.
   *
   * Example server response:
   * {
   *   "@": "_",
   *   "rdf:type": [
   *     {"data":"v-s:Membership","type":"Uri"}
   *   ],
   *   "v-s:memberOf": [
   *     {"data":"v-s:AllResourcesGroup","type":"Uri"},
   *     {"data":"cfg:VedaSystem","type":"Uri"},
   *     {"data":"cfg:SuperUser","type":"Uri"}
   *   ],
   *   "v-s:resource": [
   *     {"data":"cfg:VedaSystem","type":"Uri"}
   *   ]
   * }
   */
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

  /**
   * Authenticate the user with the provided login, password, and secret.
   * @param {string|object} login - The login or an object with the "login" property.
   * @param {string} password - The password of the user.
   * @param {string} secret - The secret associated with the user.
   * @return {Promise<object>} A Promise that resolves to the server response.
   *
   * The server response object will have the following properties:
   * - ticket: The ID of the ticket.
   * - user_uri: The URI of the authenticated user.
   * - end_time: The adjusted end time of the ticket in milliseconds since January 1, 1970 (UNIX timestamp).
   */
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

  /**
   * Get a ticket in a trusted manner. Useful to get a new ticket for the current user to prolongate a session.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string} login - The login for which to get the trusted ticket.
   * @return {Promise<object>} A Promise that resolves to the server response.
   *
   * The server response object will have the following properties:
   * - ticket: The ID of the trusted ticket.
   * - user_uri: The URI of the trusted user.
   * - end_time: The adjusted end time of the trusted ticket in milliseconds since January 1, 1970 (UNIX timestamp).
   */
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

  /**
   * Check if a ticket is valid.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @return {Promise<boolean>} A Promise that resolves to true if the ticket is valid, or false otherwise.
   */
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

  /**
   * Logout the user with the provided ticket.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @return {Promise} A Promise that resolves to the server response.
   */
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

  /**
   * Get the state of an operation for a specific module ID.
   * @param {string|object} module_id - The module ID or an object with the "module_id" property.
   * @param {string} wait_op_id - The operation ID to check.
   * @return {Promise<number>} A Promise that resolves to a number of last operation id processed by a module.
   */
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

  /**
   * Wait for an operation to complete for a specific module ID and operation ID.
   * @param {string|object} module_id - The module ID or an object with the "module_id" property.
   * @param {string} op_id - The ID of the operation to wait for.
   * @param {number} __maxCalls - (Optional) The maximum number of recursive calls to make while waiting for the operation.
   *   The default value is 10.
   * @return {Promise<boolean>} A Promise that resolves to true if the operation completes successfully, or false if the maximum number of calls is reached.
   */
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

  /**
   * Perform a query operation using the provided parameters.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string} queryStr - The query string to execute.
   * @param {string} sort - The sort order for the query.
   * @param {string} databases - The databases to search in.
   * @param {number} top - The number of documents to return.
   * @param {number} limit - The maximum number of results to retrieve.
   * @param {number} from - The starting index for the query results.
   * @param {string} sql - The SQL expression to execute.
   * @param {number} tries - (Optional) The maximum number of retry attempts in case of a 999 error response code from the server.
   *   The default value is 10.
   * @return {Promise<object>} A Promise that resolves to the server response for the query operation.
   * @throws {BackendError} Throws a BackendError with a 429 status code if the maximum number of retry attempts is reached.
   */
  static async query (ticket, queryStr, sort, databases, top, limit, from, sql, tries = 10) {
    if (!tries) throw new BackendError(429);
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
        return wait().then(() => BrowserBackend.query(ticket, queryStr, sort, databases, top, limit, from, sql, --tries));
      }
      throw backendError;
    });
  }

  /**
   * Get the an individual object with the specified URI.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string} uri - The URI of the individual to retrieve information for.
   * @param {boolean} cache - (Optional) Indicates whether to use cached data or fetch fresh data from the server.
   *   The default value is true.
   * @return {Promise<object>} A Promise that resolves to the server response containing the individual object.
   *
   * Example server response:
   * {
   *   "@": "cfg:VedaSystem",
   *   "rdf:type": [
   *     {"data":"v-s:Person","type":"Uri"}
   *   ],
   *   "rdfs:isDefinedBy": [
   *     {"data":"http://semantic-machines.com/veda/system-account","type":"Uri"}
   *   ],
   *   "rdfs:label": [
   *     {"data":"Система","lang":"RU","type":"String"},
   *     {"data":"System","lang":"EN","type":"String"}
   *   ],
   *   ...
   * }
   */
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

  /**
   * Get multiple individuals objects with the specified URIs.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string[]} uris - An array of URIs of the individuals to retrieve.
   * @return {Promise<object[]>} A Promise that resolves to an array of the requested individuals.
   *
   * Example server response for multiple individuals:
   * [
   *   {
   *     "@": "cfg:VedaSystem",
   *     "rdf:type": [
   *       {"data":"v-s:Person","type":"Uri"}
   *     ],
   *     "rdfs:isDefinedBy": [
   *       {"data":"http://semantic-machines.com/veda/system-account","type":"Uri"}
   *     ],
   *     "rdfs:label": [
   *       {"data":"Система","lang":"RU","type":"String"},
   *       {"data":"System","lang":"EN","type":"String"}
   *     ],
   *     // Other properties specific to the individual
   *   },
   *   // Other individuals
   * ]
   */
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

  /**
   * Remove an individual with the specified URI.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {string} uri - The URI of the individual to remove.
   * @param {number} assigned_subsystems - (Optional) The number of assigned subsystems. Default is 0.
   * @param {string} event_id - (Optional) The ID of the event associated with the removal. Default is an empty string.
   * @param {string} transaction_id - (Optional) The ID of the transaction associated with the removal. Default is an empty string.
   * @return {Promise<object>} A Promise that resolves to an object with the operation ID and result of the removal.
   *
   * The resolved object will have the following properties:
   * - op_id: The ID of the operation for the removal.
   * - result: The result status code of the removal operation.
   *
   * Example resolved object:
   * {
   *   "op_id":
   *   "result": 200
   * }
   */
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

  /**
   * Modify or create an individual in the database using the provided individual data.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {object} individual - The individual object to modify or create.
   * @param {number} assigned_subsystems - (Optional) The number of assigned subsystems. Default is 0.
   * @param {string} event_id - (Optional) The ID of the event associated with the modification. Default is an empty string.
   * @param {string} transaction_id - (Optional) The ID of the transaction associated with the modification. Default is an empty string.
   * @return {Promise<object>} A Promise that resolves to an object with the operation ID and result of the modification.
   *
   * The resolved object will have the following properties:
   * - op_id: The ID of the operation for the modification.
   * - result: The result status code of the modification operation.
   *
   * Example resolved object:
   * {
   *   "op_id": 74001,
   *   "result": 200
   * }
   */
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

  /**
   * Add to an individual in the database using the provided individual data.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {object} individual - The individual data to add.
   * @param {number} assigned_subsystems - (Optional) The number of assigned subsystems. Default is 0.
   * @param {string} event_id - (Optional) The ID of the event associated with the addition. Default is an empty string.
   * @param {string} transaction_id - (Optional) The ID of the transaction associated with the addition. Default is an empty string.
   * @return {Promise<object>} A Promise that resolves to an object with the operation ID and result of the addition.
   *
   * The resolved object will have the following properties:
   * - op_id: The ID of the operation for the addition.
   * - result: The result status code of the addition operation.
   *
   * Example resolved object:
   * {
   *   "op_id": 74001,
   *   "result": 200
   * }
   */
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

  /**
   * Update a value in an individual in the database using the provided individual data.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {object} individual - The individual data to update.
   * @param {number} assigned_subsystems - (Optional) The number of assigned subsystems. Default is 0.
   * @param {string} event_id - (Optional) The ID of the event associated with the update. Default is an empty string.
   * @param {string} transaction_id - (Optional) The ID of the transaction associated with the update. Default is an empty string.
   * @return {Promise<object>} A Promise that resolves to an object with the operation ID and result of the update.
   *
   * The resolved object will have the following properties:
   * - op_id: The ID of the operation for the addition.
   * - result: The result status code of the addition operation.
   *
   * Example resolved object:
   * {
   *   "op_id": 74001,
   *   "result": 200
   * }
   */
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

  /**
   * Remove a value from an individual in the database using the provided individual data.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {object} individual - The individual data to remove.
   * @param {number} assigned_subsystems - (Optional) The number of assigned subsystems. Default is 0.
   * @param {string} event_id - (Optional) The ID of the event associated with the removal. Default is an empty string.
   * @param {string} transaction_id - (Optional) The ID of the transaction associated with the removal. Default is an empty string.
   * @return {Promise<object>} A Promise that resolves to an object with the operation ID and result of the removal.
   *
   * The resolved object will have the following properties:
   * - op_id: The ID of the operation for the removal.
   * - result: The result status code of the removal operation.
   *
   * Example resolved object:
   * {
   *   "op_id": 74001,
   *   "result": 200
   * }
   */
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

  /**
   * Modify or create multiple individuals in the database using the provided individual data.
   * @param {string|object} ticket - The ticket or an object with the "ticket" property.
   * @param {object[]} individuals - An array of individual data to modify.
   * @param {number} assigned_subsystems - (Optional) The number of assigned subsystems. Default is 0.
   * @param {string} event_id - (Optional) The ID of the event associated with the modification. Default is an empty string.
   * @param {string} transaction_id - (Optional) The ID of the transaction associated with the modification. Default is an empty string.
   * @return {Promise<object>} A Promise that resolves to an object with the operation ID and result of the modification.
   *
   * The resolved object will have the following properties:
   * - op_id: The ID of the operation for the modification.
   * - result: The result status code of the modification operation.
   *
   * Example resolved object:
   * {
   *   "op_id": 74001,
   *   "result": 200
   * }
   */
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
 * Make a server request using the provided parameters.
 * @param {object} params - The parameters for the server request.
 * @param {string} params.url - The URL of the server endpoint.
 * @param {string} params.method - The HTTP method for the request.
 * @param {object} params.data - The data to be sent with the request.
 * @param {string} params.ticket - The ticket associated with the request.
 * @return {Promise<object>} A Promise that resolves to the JSON response from the server.
 * @throws {BackendError} If the server response status is not okay.
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

/**
 * Wait for a specified amount of time.
 * @param {number} [ms=1000] - The time to wait in milliseconds. Default is 1000ms (1 second).
 * @return {Promise<void>} A Promise that resolves after the specified time has elapsed.
 */
function wait (ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Adjust the ticket response to a standardized format.
 * @param {object} result - The ticket response from the server.
 * @return {object} The adjusted ticket object with standardized properties.
 */
function adjustTicket (result) {
  return {
    ticket: result.id,
    user_uri: result.user_uri,
    end_time: Math.floor((result.end_time - 621355968000000000) / 10000),
  };
}
