// HTTP server functions

import Module from "../common/veda_spa.js";

export default Module(function Backend(veda) { "use strict";

  veda.Backend = {};

  veda.Backend.status = "limited";

  veda.Backend.query = function (ticket, queryStr, sort, databases, top, limit, from) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
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

  veda.Backend.get_individual = function (ticket, uri) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
    if (isObj) {
      ticket = arg.ticket;
      uri = arg.uri;
    }
    try {
      return Promise.resolve( get_individual(ticket, uri) );
    } catch (err) {
      return Promise.reject(err);
    }
  };

  veda.Backend.reset_individual = veda.Backend.get_individual;

  veda.Backend.get_individuals = function (ticket, uris) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
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

////////////////////////////////////////////////////////////////////////

  veda.Backend.remove_individual = function (ticket, uri) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
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

  veda.Backend.put_individual = function (ticket, individual) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
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

  veda.Backend.add_to_individual = function (ticket, individual) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
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

  veda.Backend.set_in_individual = function (ticket, individual) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
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

  veda.Backend.remove_from_individual = function (ticket, individual) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
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

});
