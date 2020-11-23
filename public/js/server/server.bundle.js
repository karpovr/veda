var veda = (function () {
  'use strict';

  /* Riot 1.0.4, @license MIT, (c) 2014 Muut Inc + contributors */

  var riot = {};

  riot.observable = function(el) {

    if (el.on && el.one && el.off && el.trigger) { return el; }

    var callbacks = {}, slice = [].slice;

    el.on = function(events, fn) {
      if (typeof fn === "function") {
        events.replace(/[^\s]+/g, function(name, pos) {
          (callbacks[name] = callbacks[name] || []).push(fn);
          fn.typed = pos > 0;
        });
      }
      return el;
    };

    el.off = function(events, fn) {
      if (events === "*") callbacks = {};
      else if (fn) {
        var arr = callbacks[events];
        for (var i = 0, cb; (cb = arr && arr[i]); ++i) {
          if (cb === fn) { arr.splice(i, 1); i--; }
        }
      } else {
        events.replace(/[^\s]+/g, function(name) {
          callbacks[name] = [];
        });
      }
      return el;
    };

    // only single event supported
    el.one = function(name, fn) {
      if (fn) fn.one = true;
      return el.on(name, fn);
    };

    el.trigger = function(name) {
      var args = slice.call(arguments, 1),
        fns = callbacks[name] || [];

      for (var i = 0, fn; (fn = fns[i]); ++i) {
        //if (!fn.busy) {
          //fn.busy = true;
          fn.apply(el, fn.typed ? [name].concat(args) : args);
          if (fn.one) { fns.splice(i, 1); i--; }
          //fn.busy = false;
        //}
      }

      return el;
    };

    return el;

  };

  var FN = {}, // Precompiled templates (JavaScript functions)
    template_escape = {"\\": "\\\\", "\n": "\\n", "\r": "\\r", "'": "\\'"},
    render_escape = {'&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;'};

  function default_escape_fn(str, key) {
    return str == null ? '' : (str+'').replace(/[&\"<>]/g, function(char) {
      return render_escape[char];
    });
  }

  riot.render = function(tmpl, data, escape_fn) {
    if (escape_fn === true) escape_fn = default_escape_fn;
    tmpl = tmpl || '';

    return (FN[tmpl] = FN[tmpl] || new Function("_", "e", "return '" +
      tmpl.replace(/[\\\n\r']/g, function(char) {
        return template_escape[char];
      }).replace(/{\s*([\w\.]+)\s*}/g, "' + (e?e(_.$1,'$1'):_.$1||(_.$1==null?'':_.$1)) + '") + "'")
    )(data, escape_fn);
  };
  /* Cross browser popstate */
  (function () {
    // for browsers only
    if (typeof window === "undefined") return;

    var pops = riot.observable({}),
      listen = window.addEventListener,
      doc = document;

    function pop(hash) {
      hash = hash.type ? location.hash : hash;
      //if (hash !== currentHash) pops.trigger("pop", hash);
      pops.trigger("pop", hash);
    }

    /* Always fire pop event upon page load (normalize behaviour across browsers) */

    // standard browsers
    if (listen) {
      listen("popstate", pop, false);
      //doc.addEventListener("DOMContentLoaded", pop, false);

    // IE
    } else {
      doc.attachEvent("onreadystatechange", function() {
        //if (doc.readyState === "complete") pop("");
        pop("");
      });
    }

    /* Change the browser URL or listen to changes on the URL */
    riot.route = function(to, prevent) {
      // listen
      if (typeof to === "function") return pops.on("pop", to);

      // fire
      if (history.pushState) history.pushState(0, 0, to);
      if (!prevent) pop(to);
    };
  })();

  // Application instance

  var veda = riot.observable({
    env: typeof window === "undefined" ? "server" : "browser"
  });

  // Veda common utility functions

  var Util = veda.Util || {};

  var Util$1 = veda.Util = Util;

  Util.mergeMutualChanges = function (high, low, base) {
    var key, merged = {};
    for (key in base) {
      merged[key] = base[key];
    }
    var highBaseDiff = Util.diff(high, base);
    var lowBaseDiff = Util.diff(low, base);
    var highLowDiff = Util.diff(high, low);
    var lowHighDiff = Util.diff(low, high);
    for (key in lowBaseDiff.missing) {
      delete merged[key];
    }
    for (key in highBaseDiff.missing) {
      delete merged[key];
    }
    for (key in lowBaseDiff.added) {
      merged[key] = lowBaseDiff.added[key];
    }
    for (key in highBaseDiff.added) {
      merged[key] = highBaseDiff.added[key];
    }
    for (key in lowBaseDiff.differ) {
      merged[key] = lowBaseDiff.differ[key];
    }
    for (key in highBaseDiff.diff) {
      merged[key] = highBaseDiff.differ[key];
    }
    return {
      merged: merged,
      conflicts: {
        high: highLowDiff.differ,
        low: lowHighDiff.differ
      }
    };
  };

  Util.diff = function (changed, base) {
    var delta = {
      added: {},
      missing: {},
      differ: {}
    };
    var key, values, value, length, i, hasValue;
    for (key in base) {
      if ( !(key in changed) ) {
        delta.missing[key] = base[key];
      } else {
        if (key === "@") {
          if (changed[key] !== base[key]) {
            delta.differ[key] = changed[key];
          }
          continue;
        }
        values = base[key];
        length = values.length;
        hasValue = (length === changed[key].length);
        for (i = 0; i < length && hasValue; i++) {
          value = values[i];
          hasValue = hasValue && Util.hasValue(changed, key, value);
        }
        if ( !hasValue ) {
          delta.differ[key] = changed[key];
        }
      }
    }
    for (key in changed) {
      if ( !(key in base) ) {
        delta.added[key] = changed[key];
      }
    }
    return delta;
  };

  Util.decimalDatetimeReviver = function (key, value) {
    return key === "data" && this.type === "Datetime" ? new Date(value) : key === "data" && this.type === "Decimal" ? parseFloat(value) : value ;
  };

  Util.hasValue = function(individual, property, value) {
    var any = !!(individual && individual[property] && individual[property].length);
    if (!value) return any;
    return !!(any && individual[property].filter( function(i) {
      return (i.type === value.type && i.data.valueOf() === value.data.valueOf());
    }).length);
  };

  Util.toJson = function (value) {
    return JSON.stringify(value, null, 2);
  };

  Util.generate_passes = function (length, count) {
    var result = {};
    for (var i = 0; i < count; i++) {
      var pass = generate_pass(length);
      var hash = Sha256.hash(pass);
      result[pass] = hash;
    }
    return result;
  };

  function generate_pass (length) {
    var ranges = [[48, 57], [97, 122]];
    var pass = "";
    for (var i = 0; i < length; i++) {
      var range = ranges[randomInRange(0, ranges.length - 1)];
      var charcode = randomInRange(range[0], range[1]);
      pass += String.fromCharCode(charcode);
    }
    return pass;
  }
  function randomInRange(begin, end) {
    return Math.round(Math.random() * (end - begin) + begin);
  }
  Util.simpleHash = function (str) {
    var hash = 0, char;
    if (str.length === 0) {
        return hash;
    }
    for (var i = 0; i < str.length; i++) {
      char = str.charCodeAt(i);
      hash = ((hash<<5)-hash)+char;
      hash = hash & hash;
    }
    return hash;
  };

  Util.processQuery = function (vql, sql, sort, limit, queryDelta, processDelta, pause, fn) {
    if (typeof vql === "object") {
      sort  = vql.sort;
      limit = vql.limit;
      queryDelta = vql.queryDelta;
      processDelta = vql.processDelta;
      pause = vql.pause;
      fn    = vql.fn;
      sql   = vql.sql;
      vql   = vql.vql;
    }
    console.log((new Date()).toISOString(), "Process query results |||", "query:", vql || sql, " | ", "limit:", limit, " | ", "query delta:", queryDelta, " | ", "process delta:", processDelta, " | ", "pause:", pause);
    var result = [], append = [].push, fetchingProgress = 0;
    console.time("Fetching total");
    fetchResult();
    return;

    function fetchResult(cursor) {
      var from = cursor || 0;
      Backend.query({
        ticket: veda.ticket,
        query: vql,
        sql: sql,
        sort: sort || "'v-s:created' desc",
        from: from,
        top: queryDelta,
        limit: limit
      }).then(function (query_result) {
        var cursor = query_result.cursor;
        var estimated = query_result.estimated;
        if ( limit > estimated ) {
          limit = estimated;
        }
        append.apply(result, query_result.result);
        if ( cursor/limit - fetchingProgress >= 0.05 ) {
          fetchingProgress = cursor/limit;
          console.log("Fetching progress:", Math.floor(fetchingProgress * 100) + "%", "(" + cursor, "of", limit + ")");
        }
        if ( cursor === estimated || cursor >= limit ) {
          console.log((new Date()).toString(), "Fetching done:", limit);
          console.timeEnd("Fetching total");
          result.splice(limit - cursor || limit); // cut result to limit
          Util.processResult(result, processDelta, pause, fn);
        } else {
          fetchResult(query_result.cursor);
        }
      });
    }
  };

  Util.processResult = function (result, delta, pause, fn) {
    var total = result.length;
    var processingProgress = 0;
    console.log((new Date()).toISOString(), "Process results |||", "total:", total, " | ", "delta:", delta, " | ", "pause:", pause);
    console.time("Processing total");
    processPortion();

    function processPortion() {
      var portion = result.splice(0, delta);
      portion.reduce(function (prom, item) {
        return prom.then(function () {
          return fn(item);
        }).catch(function (error) {
          console.log("Error processing item:", item);
          console.log(error, error.stack);
        });
      }, Promise.resolve()).then(function () {
        if ( (total - result.length) / total - processingProgress >= 0.05 ) {
          processingProgress = (total - result.length) / total;
          console.log("Processing progress:", Math.floor(processingProgress * 100) + "%", "(" + (total - result.length), "of", total + ")");
        }
        if ( result.length ) {
          setTimeout ? setTimeout(processPortion, pause) : processPortion();
        } else {
          console.log("Processing done:", total);
          console.timeEnd("Processing total");
        }
      });
    }
  };

  Util.genUri = function () {
    var uid = Util.guid(), re = /^\d/;
    return (re.test(uid) ? "d:a" + uid : "d:" + uid);
  };
  Util.guid = function () {
    var d = new Date().getTime();
    if (typeof performance !== "undefined" && typeof performance.now === "function"){
      d += performance.now(); //use high-precision timer if available
    }
    return "xxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function (c) {
      var r = (d + Math.random() * 36) % 36 | 0;
      d = Math.floor(d / 36);
      return r.toString(36);
    });
  };

  Util.isInteger = function (n) { return n % 1 === 0; };

  function zeroPref(n) {
    return n > 9 ? n : "0" + n;
  }

  Util.formatValue = function (value) {
    var formatted;
    switch (true) {
      case value instanceof Date:
        formatted = formatDate(value);
        break;
      case value instanceof Number || typeof value === "number":
        formatted = formatNumber(value);
        break;
      case value instanceof String || typeof value === "string":
        formatted = formatString(value);
        break;
      default:
        formatted = typeof value !== "undefined" ? value.toString() : value;
    }
    return formatted;
  };
  function formatString (value) {
    var condition = !value.language || value.language === "NONE" || ( veda.user && veda.user.preferences && veda.user.preferences.language && value.language in veda.user.preferences.language ) ;
    return condition ? value : undefined;
  }
  function formatDate (date) {
    var day = date.getDate(),
      month = date.getMonth() + 1,
      year = date.getFullYear(),
      hours = date.getHours(),
      mins = date.getMinutes(),
      secs = date.getSeconds(),

      UTCday = date.getUTCDate(),
      UTCmonth = date.getUTCMonth() + 1,
      UTCyear = date.getUTCFullYear(),
      UTChours = date.getUTCHours(),
      UTCmins = date.getUTCMinutes(),
      UTCsecs = date.getUTCSeconds(),
      UTCmillis = date.getUTCMilliseconds(),
      fdate, ftime;
    if ( (UTChours + UTCmins + UTCsecs + UTCmillis) === 0 ) {
      return [zeroPref(day), zeroPref(month), year].join(".");
    }
    fdate = [zeroPref(day), zeroPref(month), year].join(".");
    ftime = [zeroPref(hours), zeroPref(mins), zeroPref(secs)].join(":");
    return (fdate === "01.01.1970" ? "" : fdate) + (ftime === "00:00:00" ? "" : " " + ( secs === 0 ? ftime.substr(0, 5) : ftime) );
  }function formatNumber (n) {
    return (n+"").replace(/.(?=(?:[0-9]{3})+\b)/g, '$& ');
  }
  Util.forSubIndividual = function (net, property, id, func) {
    if (net[property] === undefined) { return; }
    net[property].forEach(function(el) {
      if (el.id == id) {
        func(el);
      }
    });
  };

  Util.removeSubIndividual = function (net, property, id) {
    if (net[property] === undefined) { return; }
    return net[property].filter( function (item) {
      return item.id !== id;
    });
  };

  /*
   * from http://stackoverflow.com/questions/27266550/how-to-flatten-nested-array-in-javascript
   * by http://stackoverflow.com/users/2389720/aduch
   *
   * This is done in a linear time O(n) without recursion
   * memory complexity is O(1) or O(n) if mutable param is set to false
   */
  Util.flatten = function (array, mutable) {
    var toString = Object.prototype.toString;
    var arrayTypeStr = '[object Array]';

    var result = [];
    var nodes = (mutable && array) || array.slice();
    var node;

    if (!array.length) {
      return result;
    }

    node = nodes.pop();

    do {
      if (toString.call(node) === arrayTypeStr) {
        nodes.push.apply(nodes, node);
      } else {
        result.push(node);
      }
    } while (nodes.length && (node = nodes.pop()) !== undefined);

    result.reverse(); // we reverse result to restore the original order
    return result;
  };

  Util.unique = function (arr) {
    var n = {}, r = [];
    for(var i = 0; i < arr.length; i++) {
      if (!n[arr[i]]) {
        n[arr[i]] = true;
        r.push(arr[i]);
      }
    }
    return r;
  };

  Number.isFinite = Number.isFinite || function(value) {
    return typeof value === 'number' && isFinite(value);
  };
  Number.isInteger = Number.isInteger || function(value) {
    return typeof value === 'number'
      && Number.isFinite(value)
      && !(value % 1);
  };
  Number.isFloat = Number.isFloat || function(value) {
    return typeof value === 'number'
      && Number.isFinite(value)
      && (value % 1);
  };

  Util.queryFromIndividualPT = function (individual, sort) {
    var re = /[^a-zA-Z0-9]/g;
    try {
      var query = buildQuery;
      var order = orderBy(sort);
      query = query && order ? query + " ORDER BY " + order : query;
      return query;
    } catch (error) {
      console.log(error);
    }

    function orderBy(sort) {
      if (typeof sort === "string" || sort instanceof String) {
        return sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri, dir) {
          var range = veda.ontology.properties[property_uri].get("rdfs:range")[0];
          var by = property_uri.replace(re, "_");
          var clause;
          switch (range.id) {
            case "xsd:dateTime":
              clause = by + ".date " + dir;
              break;
            case "xsd:boolean":
            case "xsd:integer":
              clause = by + ".int " + dir;
              break;
            case "xsd:decimal":
              clause = by + ".dec " + dir;
              break;
            case "xsd:string":
            default:
              clause = by + ".str " + dir;
              break;
          }
          return clause;
        });
      }
    }

    function buildQuery (individual) {
      var tables = [];
      var i = -1;
      var where = Object.keys(individual.properties)
        .map(function (property_uri) {
          if (property_uri.indexOf(".") >= 0 || property_uri.indexOf("*") >= 0) { throw new Error("VQL style property nesting: " + property_uri); }
          if (property_uri === "@") { return; }
          i++;
          var table = "veda_pt.`" + property_uri + "` as p" + i;
          tables[i] = table ;
          var values = individual.get(property_uri).sort(function (a, b) {
            return a < b ? - 1 : a === b ? 0 : 1;
          });
          var oneProp;
          switch (true) {
            case Number.isInteger(values[0]):
              oneProp = "p" + i + ".int[1] >= " + values[0] + " AND p" + i + ".int[1] <= " + values[values.length-1];
              break;
            case Number.isFloat(values[0]):
              oneProp = "p" + i + ".dec[1] >= " + values[0] + " AND p" + i + ".dec[1] <= " + values[values.length-1];
              break;
            case values[0] instanceof Date:
              var start = new Date(values[0]);
              var end = new Date(values[values.length-1]);
              start.setHours(0,0,0,0);
              end.setHours(23,59,59,999);
              start = Math.floor(start.valueOf() / 1000);
              end = Math.floor(end.valueOf() / 1000);
              oneProp = "p" + i + ".date[1] >= toDateTime(" + start + ") AND p" + i + ".date[1] <= toDateTime(" + end + ")";
              break;
            case typeof values[0] === "boolean":
              oneProp = values
                .map(function (value) {
                  return "p" + i + ".int[1] = " + (value ? 1 : 0);
                }).join(" OR ");
              break;
            case values[0] instanceof String:
              oneProp = values
                .filter(Boolean)
                .map( function (value) {
                  var q = value;
                  var lines = q.trim().split("\n");
                  var lineQueries = lines.map(function (line) {
                    var words = line
                      .trim()
                      .replace(/[-*\s]+/g, " ")
                      .split(" ");
                    return words.length && "arrayStringConcat(" + "p" + i + ".str, ' ') LIKE '%" + words.join("% %").replace(/\'/g, "\\'").replace(/\"/g, "'") + "%'";
                  });
                  return lineQueries.filter(Boolean).join(" OR ");
                })
                .filter(Boolean)
                .join(" OR ");
              break;
            case values[0] instanceof IndividualModel:
              oneProp = values
                .filter(Boolean)
                .map( function (value) {
                  if ( value.isNew() ) {
                    return;
                  } else {
                    return "has(" + "p" + i + ".str, '" + value.id + "')";
                  }
                })
                .filter(Boolean)
                .join(" OR ");
              break;
          }
          if (!oneProp) { return; }
          return oneProp.indexOf(" OR ") > 0 ? "( " + oneProp + " )" : oneProp;
        })
        .filter(Boolean)
        .join(" AND ");

      var from = tables.reduce(function (acc, table, i) {
        return acc ? acc + " JOIN " + table + " ON p" + (i - 1) + ".id = p" + i + ".id" : table;
      }, "");

      return "SELECT DISTINCT id FROM " + from + (where ? " WHERE " + where : "");
    }
  };

  Util.queryFromIndividualTT_SUB = function (individual, sort, withDeleted) {
    try {
      var visited = {};
      var re = /[^a-zA-Z0-9]/g;
      var query = buildQuery(individual);
      var group = groupBy(sort);
      query = query && group ? query + " GROUP BY " + group : query;
      var order = orderBy(sort);
      query = query ? query + " HAVING sum(sign) > 0" : query;
      query = query && order ? query + " ORDER BY " + order : query;
      return query;
    } catch (error) {
      console.log(error);
    }

    function groupBy(sort) {
      var by = "id";
      if (typeof sort === "string" || sort instanceof String) {
        var props = sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri) {
          var range = veda.ontology.properties[property_uri].get("rdfs:range")[0];
          var by = property_uri.replace(re, "_");
          switch (range.id) {
            case "xsd:dateTime":
              by = by + "_date";
              break;
            case "xsd:boolean":
            case "xsd:integer":
              by = by + "_int";
              break;
            case "xsd:decimal":
              by = by + "_dec";
              break;
            case "xsd:string":
            default:
              by = by + "_str";
              break;
          }
          return by;
        });
      }
      return props ? by + ", " + props : by;
    }

    function orderBy(sort) {
      if (typeof sort === "string" || sort instanceof String) {
        return sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri, dir) {
          var range = veda.ontology.properties[property_uri].get("rdfs:range")[0];
          var by = property_uri.replace(re, "_");
          var clause;
          switch (range.id) {
            case "xsd:dateTime":
              clause = by + "_date " + dir;
              break;
            case "xsd:boolean":
            case "xsd:integer":
              clause = by + "_int " + dir;
              break;
            case "xsd:decimal":
              clause = by + "_dec " + dir;
              break;
            case "xsd:string":
            default:
              clause = by + "_str " + dir;
              break;
          }
          return clause;
        });
      }
    }

    function buildQuery(individual) {
      if (individual.id in visited) {
        return;
      } else {
        visited[individual.id] = true;
      }
      var where = Object.keys(individual.properties)
        .map(function (property_uri, i) {
          if (property_uri.indexOf(".") >= 0 || property_uri.indexOf("*") >= 0) { throw new Error("VQL style property nesting: " + property_uri); }
          if (property_uri === "@" || property_uri === "rdf:type") { return; }
          var values = individual.get(property_uri).sort(function (a, b) {
            return a < b ? - 1 : a === b ? 0 : 1;
          });
          var prop = property_uri.replace(re, "_");
          var oneProp;
          switch (true) {
            case Number.isInteger(values[0]):
              oneProp = prop + "_int[1] >= " + values[0] + " AND " + prop + "_int[1] <= " + values[values.length-1];
              break;
            case Number.isFloat(values[0]):
              oneProp = prop + "_dec[1] >= " + values[0] + " AND " + prop + "_dec[1] <= " + values[values.length-1];
              break;
            // Date
            case values[0] instanceof Date:
              var start = new Date(values[0]);
              var end = new Date(values[values.length-1]);
              start.setHours(0,0,0,0);
              end.setHours(23,59,59,999);
              start = Math.floor(start.valueOf() / 1000);
              end = Math.floor(end.valueOf() / 1000);
              oneProp = prop + "_date[1] >= toDateTime(" + start + ") AND " + prop + "_date[1] <= toDateTime("  + end + ")";
              break;
            case typeof values[0] === "boolean":
              oneProp = values
                .map(function (value) {
                  return prop + "_int[1] = " + (value ? 1 : 0);
                }).join(" OR ");
              break;
            case values[0] instanceof String:
              oneProp = values
                .filter(Boolean)
                .map( function (value) {
                  var q = value;
                  var lines = q.trim().split("\n");
                  var lineQueries = lines.map(function (line) {
                    var words = line
                      .trim()
                      .replace(/[-*\s]+/g, " ")
                      .split(" ");
                    return words.length && "arrayStringConcat(" + prop + "_str, ' ') LIKE '%" + words.join("% %").replace(/\'/g, "\\'").replace(/\"/g, "'") + "%'";
                  });
                  return lineQueries.filter(Boolean).join(" OR ");
                })
                .filter(Boolean)
                .join(" OR ");
              break;
            case values[0] instanceof IndividualModel:
              oneProp = values
                .filter(Boolean)
                .map( function (value) {
                  if ( value.isNew() ) {
                    var sub = buildQuery(value);
                    return sub ? prop + "_str IN ( " + sub + " )" : undefined;
                  } else {
                    return "has(" + prop + "_str, '" + value + "')";
                  }
                })
                .filter(Boolean)
                .join(" OR ");
              break;
          }
          if (!oneProp) { return; }
          return oneProp.indexOf(" OR ") > 0 ? "( " + oneProp + " )" : oneProp;
        })
        .filter(Boolean)
        .join(" AND ");

      if (!withDeleted) {
        where += where ? " AND " : "";
        where += "NOT v_s_deleted_int = [1]";
      }

      if (Object.keys(visited).length > 1 && !where) { return; }

      return individual.get("rdf:type").map(function (type) {
        var from = "veda_tt.`" + type.id + "`";
        var query = "SELECT id FROM " + from + (where ? " WHERE " + where : "");
        return query;
      })
      .filter(Boolean)
      .join(" UNION ALL ");
    }
  };

  Util.queryFromIndividualTT_JOIN = function (individual, sort, withDeleted) {
    var table_counter = 0;
    var re = /[^a-zA-Z0-9]/g;
    try {
      return individual["rdf:type"].map(function (_type, type_index) {
        var from = "";
        var where = "";
        var visited = visited || {};
        buildQuery(individual, undefined, type_index);
        var query = from ? "SELECT id FROM " + from : "";
        query = query && where ? query + " WHERE " + where : query;
        var group = groupBy(sort);
        query = query && group ? query + " GROUP BY " + group : query;
        var order = orderBy(sort);
        query = query ? query + " HAVING sum(sign) > 0" : query;
        query = query && order ? query + " ORDER BY " + order : query;
        return query;

        function groupBy(sort) {
          var by = "id";
          if (typeof sort === "string" || sort instanceof String) {
            var props = sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri) {
              var range = veda.ontology.properties[property_uri].get("rdfs:range")[0];
              var by = property_uri.replace(re, "_");
              switch (range.id) {
                case "xsd:dateTime":
                  by = by + "_date";
                  break;
                case "xsd:boolean":
                case "xsd:integer":
                  by = by + "_int";
                  break;
                case "xsd:decimal":
                  by = by + "_dec";
                  break;
                case "xsd:string":
                default:
                  by = by + "_str";
                  break;
              }
              return by;
            });
          }
          return props ? by + ", " + props : by;
        }

        function orderBy(sort) {
          if (typeof sort === "string" || sort instanceof String) {
            return sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri, dir) {
              var range = veda.ontology.properties[property_uri].get("rdfs:range")[0];
              var by = property_uri.replace(re, "_");
              var clause;
              switch (range.id) {
                case "xsd:dateTime":
                  clause = by + "_date " + dir;
                  break;
                case "xsd:boolean":
                case "xsd:integer":
                  clause = by + "_int " + dir;
                  break;
                case "xsd:decimal":
                  clause = by + "_dec " + dir;
                  break;
                case "xsd:string":
                default:
                  clause = by + "_str " + dir;
                  break;
              }
              return clause;
            });
          }
        }

        // Recursive from & where population
        function buildQuery(individual, parent_prop, type_index) {
          table_counter++;
          type_index = type_index || 0;
          var type = individual.get("rdf:type")[type_index].id;
          var alias = "t" + table_counter;
          visited[individual.id] = alias;
          var table_aliased = "veda_tt.`" + type + "` AS " + alias;
          if (!parent_prop) {
            from +=  table_aliased;
          } else {
            from += " JOIN " + table_aliased + " ON " + parent_prop + " = [" + alias + ".id]";
          }

          if (!withDeleted) {
            where += where ? " AND " : "";
            where += "NOT " + alias + ".v_s_deleted_int = [1]";
          }

          var where_aliased = Object.keys(individual.properties)
            .map(function (property_uri, i) {
              if (property_uri.indexOf(".") >= 0 || property_uri.indexOf("*") >= 0) { throw new Error("VQL style property nesting: " + property_uri); }
              if (property_uri === "@" || property_uri === "rdf:type") { return; }
              var values = individual.get(property_uri).sort(function (a, b) {
                return a < b ? - 1 : a === b ? 0 : 1;
              });
              var prop = alias + "." + property_uri.replace(re, "_");
              var oneProp;
              switch (true) {
                case Number.isInteger(values[0]):
                  oneProp = prop + "_int[1] >= " + values[0] + " AND " + prop + "_int[1] <= " + values[values.length-1];
                  break;
                case Number.isFloat(values[0]):
                  oneProp = prop + "_dec[1] >= " + values[0] + " AND " + prop + "_dec[1] <= " + values[values.length-1];
                  break;
                case values[0] instanceof Date:
                  var start = new Date(values[0]);
                  var end = new Date(values[values.length-1]);
                  start.setHours(0,0,0,0);
                  end.setHours(23,59,59,999);
                  start = Math.floor(start.valueOf() / 1000);
                  end = Math.floor(end.valueOf() / 1000);
                  oneProp = prop + "_date[1] >= toDateTime(" + start + ") AND " + prop + "_date[1] <= toDateTime("  + end + ")";
                  break;
                case typeof values[0] === "boolean":
                  oneProp = values
                    .map(function (value) {
                      return prop + "_int[1] = " + (value ? 1 : 0);
                    }).join(" OR ");
                  break;
                case values[0] instanceof String:
                  oneProp = values
                    .filter(Boolean)
                    .map( function (value) {
                      var q = value;
                      var lines = q.trim().split("\n");
                      var lineQueries = lines.map(function (line) {
                        var words = line
                          .trim()
                          .replace(/[-*\s]+/g, " ")
                          .split(" ");
                        return words.length && "arrayStringConcat(" + prop + "_str, ' ') LIKE '%" + words.join("% %").replace(/\'/g, "\\'").replace(/\"/g, "'") + "%'";
                      });
                      return lineQueries.filter(Boolean).join(" OR ");
                    })
                    .filter(Boolean)
                    .join(" OR ");
                  break;
                case values[0] instanceof IndividualModel:
                  oneProp = values
                    .filter(Boolean)
                    .map( function (value) {
                      if ( value.isNew() && !(value.id in visited)) {
                        return buildQuery(value, prop + "_str");
                      } else if ( value.isNew() && value.id in visited ) {
                        return "has(" + prop + "_str, " + visited[value.id] + ".id" + ")";
                      } else {
                        return "has(" + prop + "_str, '" + value + "')";
                      }
                    })
                    .filter(Boolean)
                    .join(" OR ");
                  break;
              }
              if (!oneProp) { return; }
              return oneProp.indexOf(" OR ") > 0 ? "( " + oneProp + " )" : oneProp;
            })
            .filter(Boolean)
            .join(" AND ");

          if (!where_aliased) { return; }

          if (!where) {
            where = where_aliased;
          } else {
            where += " AND " + where_aliased;
          }
        }
      }).join(" UNION ALL ");
    } catch (error) {
      console.log(error);
    }
  };

  Util.queryInbox = function (taskBlank, sort, withDeleted) {
    var re = /[^a-zA-Z0-9]/g;
    var task_from = taskBlank.get("v-wf:from"),
        task_to = taskBlank.get("v-wf:to"),
        task_label = taskBlank.get("rdfs:label"),
        task_created = taskBlank.get("v-s:created"),
        task_given = taskBlank.get("v-wf:dateGiven"),
        task_completed = taskBlank.get("v-wf:isCompleted"),
        document_type,
        document_label,
        decision_created;

    if ( taskBlank.hasValue("v-wf:onDocument") ) {
      var document = taskBlank.get("v-wf:onDocument")[0];
      document_type = document.get("rdf:type")[0];
      document_label = document.get("rdfs:label")[0];
    }
    if ( taskBlank.hasValue("v-wf:takenDecision") ) {
      var decision = taskBlank.get("v-wf:takenDecision")[0];
      decision_created = decision.get("v-s:created");
    }

    var from = "veda_tt.`v-wf:DecisionForm` AS t0";
    if (document_type) {
      from += " JOIN veda_pt.`rdf:type` AS t1 ON t0.`v_wf_onDocument_str`[1] = t1.id";
    }
    if (document_label) {
      from += " JOIN veda_pt.`rdfs:label` AS t2 ON t0.`v_wf_onDocument_str`[1] = t2.id";
    }
    if (decision_created && decision_created.length) {
      from += " JOIN veda_pt.`rdf:type` AS t3 ON t0.`v_wf_takenDecision_str`[1] = t3.id";
    }

    var where_arr = [];

    if (!withDeleted) {
      var where_deleted = !withDeleted ? "NOT (t0.`v_s_deleted_int` = [1])" : false;
      where_arr.push("(" + where_deleted + ")");
    }
    if (task_completed.length) {
      var bool = task_completed[0];
      var where_task_completed = "t0.`v_wf_isCompleted_int` = [" + (bool ? 1 : 0) + "]";
      where_arr.push("(" + where_task_completed + ")");
    }
    if (task_from.length) {
      var where_task_from = task_from.map(function (val) {
        return "has(t0.`v_wf_from_str`, '" + val + "')";
      }).join(" OR ");
      where_arr.push("(" + where_task_from + ")");
    }
    if (task_to.length) {
      var where_task_to = task_to.map(function (val) {
        return "has(t0.`v_wf_to_str`, '" + val + "')";
      }).join(" OR ");
      where_arr.push("(" + where_task_to + ")");
    }
    if (task_label.length) {
      var where_task_label = task_label
      .filter(Boolean)
      .map( function (value) {
        var q = value;
        var lines = q.trim().split("\n");
        var lineQueries = lines.map(function (line) {
          var words = line
            .trim()
            .replace(/[-*\s]+/g, " ")
            .split(" ");
          return words.length && "arrayStringConcat(t0.`rdfs_label_str`, ' ') LIKE '%" + words.join("% %").replace(/\'/g, "\\'").replace(/\"/g, "'") + "%'";
        });
        return lineQueries.filter(Boolean).join(" OR ");
      })
      .filter(Boolean)
      .join(" OR ");
      where_arr.push("(" + where_task_label + ")");
    }
    if (task_created.length) {
      task_created = task_created.sort(function (a, b) {return a - b});
      var start = new Date(task_created[0]);
      var end = new Date(task_created[task_created.length - 1]);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      start = Math.floor(start.valueOf() / 1000);
      end = Math.floor(end.valueOf() / 1000);
      var where_task_created = "t0.`v_s_created_date`[1] >= toDateTime(" + start + ") AND t0.`v_s_created_date`[1] <= toDateTime("  + end + ")";
      where_arr.push("(" + where_task_created + ")");
    }
    if (task_given.length) {
      task_given = task_given.sort(function (a, b) {return a - b});
      var start = new Date(task_given[0]);
      var end = new Date(task_given[task_given.length - 1]);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      start = Math.floor(start.valueOf() / 1000);
      end = Math.floor(end.valueOf() / 1000);
      var where_task_given = "t0.`v_wf_taskGiven_date`[1] >= toDateTime(" + start + ") AND t0.`v_wf_taskGiven_date`[1] <= toDateTime("  + end + ")";
      where_arr.push("(" + where_task_given + ")");
    }
    if (document_type) {
      var where_document_type = "has(t1.str, '" + document_type.id + "')";
      where_arr.push("(" + where_document_type + ")");
    }
    if (document_label) {
      var where_document_label = [document_label]
      .filter(Boolean)
      .map( function (value) {
        var q = value;
        var lines = q.trim().split("\n");
        var lineQueries = lines.map(function (line) {
          var words = line
            .trim()
            .replace(/[-*\s]+/g, " ")
            .split(" ");
          return words.length && "arrayStringConcat(t2.str, ' ') LIKE '%" + words.join("% %").replace(/\'/g, "\\'").replace(/\"/g, "'") + "%'";
        });
        return lineQueries.filter(Boolean).join(" OR ");
      })
      .filter(Boolean)
      .join(" OR ");
      where_arr.push("(" + where_document_label + ")");
    }
    if (decision_created && decision_created.length) {
      decision_created = decision_created.sort(function (a, b) {return a - b});
      var start = new Date(decision_created[0]);
      var end = new Date(decision_created[decision_created.length - 1]);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      start = Math.floor(start.valueOf() / 1000);
      end = Math.floor(end.valueOf() / 1000);
      var where_decision_created = "t3.`v_s_created_date` >= toDateTime(" + start + ") AND t3.`v_s_created_date` <= toDateTime("  + end + ")";
      where_arr.push("(" + where_decision_created + ")");
    }
    var where = where_arr.join(" AND ");

    var query = "SELECT id FROM " + from + " WHERE " + where;
    var group = groupBy(sort);
    query = group ? query + " GROUP BY " + group : query;
    var order = orderBy(sort);
    query = query ? query + " HAVING sum(sign) > 0" : query;
    query = order ? query + " ORDER BY " + order : query;
    return query;

    function groupBy(sort) {
      var by = "id";
      if (typeof sort === "string" || sort instanceof String) {
        var props = sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri) {
          var range = veda.ontology.properties[property_uri].get("rdfs:range")[0];
          var by = property_uri.replace(re, "_");
          switch (range.id) {
            case "xsd:dateTime":
              by = by + "_date";
              break;
            case "xsd:boolean":
            case "xsd:integer":
              by = by + "_int";
              break;
            case "xsd:decimal":
              by = by + "_dec";
              break;
            case "xsd:string":
            default:
              by = by + "_str";
              break;
          }
          return by;
        });
      }
      return props ? by + ", " + props : by;
    }

    function orderBy(sort) {
      if (typeof sort === "string" || sort instanceof String) {
        return sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri, dir) {
          var range = veda.ontology.properties[property_uri].get("rdfs:range")[0];
          var by = property_uri.replace(re, "_");
          var clause;
          switch (range.id) {
            case "xsd:dateTime":
              clause = by + "_date " + dir;
              break;
            case "xsd:boolean":
            case "xsd:integer":
              clause = by + "_int " + dir;
              break;
            case "xsd:decimal":
              clause = by + "_dec " + dir;
              break;
            case "xsd:string":
            default:
              clause = by + "_str " + dir;
              break;
          }
          return clause;
        });
      }
    }
  };

  Util.queryFromIndividual = function (individual) {
    var query;
    var flat = flattenIndividual(individual.properties);
    if ( individual.hasValue("*") && individual.get("*")[0].indexOf("==") > 0 ) {
      return individual.get("*")[0];
    }
    var allProps = Object.getOwnPropertyNames(flat)
      .map(function (property_uri) {
        if (property_uri === "@" || property_uri === "v-s:isDraft") { return; }
        var values = flat[property_uri].sort(function (a, b) {
          return a.data < b.data ? - 1 : a.data === b.data ? 0 : 1;
        });
        var oneProp;
        switch (values[0].type) {
          case "Integer":
          case "Decimal":
            oneProp = "'" + property_uri + "'==[" + values[0].data + "," + values[values.length-1].data + "]";
            break;
          // Date
          case "Datetime":
            var start = new Date(values[0].data);
            var end = new Date(values[values.length-1].data);
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            oneProp = "'" + property_uri + "'==[" + start.toISOString() + "," + end.toISOString() + "]";
            break;
          case "Boolean":
            oneProp = values
              .map( function (value) {
                return "'" + property_uri + "'=='" + value.data + "'";
              })
              .join(" || ");
            break;
          case "String":
            oneProp = values
              .filter(function(item){return !!item && !!item.valueOf();})
              .map( function (value) {
                var q = value.data;
                if ( !q.match(/[\+\-\*]/) ) {
                  var lines = q.trim().split("\n");
                  var lineQueries = lines.map(function (line) {
                    var words = line
                      .trim()
                      .replace(/[-*\s]+/g, " ")
                      .split(" ");
                    line = words.map(function (word) { return "+" + word + "*"; }).join(" ");
                    return "'" + property_uri + "'=='" + line + "'";
                  });
                  return lineQueries.join(" || ");
                } else {
                  return "'" + property_uri + "'=='" + q + "'";
                }
              })
              .join(" || ");
            break;
          case "Uri":
            oneProp = values
              .filter(function(item){return !!item && !!item.valueOf();})
              .map( function (value) {
                if (property_uri === "rdf:type") {
                  return "'" + property_uri + "'=='" + value.data + "'";
                } else {
                  return "'" + property_uri + "'=='" + value.data + "'";
                }
              })
              .join(" || ");
            break;
        }
        return oneProp ? "( " + oneProp + " )" : undefined;
      })
      .filter(function(item){return typeof item !== undefined;})
      .join(" && ");
    query = allProps ? "( " + allProps + " )" : undefined;
    return query;
  };

  function flattenIndividual(object, prefix, union, visited) {
    var uri = object["@"];
    union = typeof union !== "undefined" ? union : {};
    prefix = typeof prefix !== "undefined" ? prefix : "";
    visited = typeof visited !== "undefined" ? visited : [];
    if (visited.indexOf(uri) > -1) {
      return;
    } else {
      visited.push(uri);
    }
    for (var property_uri in object) {
      if (property_uri === "@") { continue; }
      var values = object[property_uri];
      var prefixed = prefix ? prefix + "." + property_uri : property_uri;
      for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (value.type === "Uri") {
          var individ = new IndividualModel(value.data);
          if ( individ.isNew() ) {
            flattenIndividual(individ.properties, prefixed, union, visited);
          } else {
            union[prefixed] = union[prefixed] ? union[prefixed] : [];
            union[prefixed].push( value );
          }
        } else {
          union[prefixed] = union[prefixed] ? union[prefixed] : [];
          union[prefixed].push( value );
        }
      }
    }
    return union;
  }

  /**
   * Сформировать составное наименование объекта
   *
   * @param individual индивид
   * @returns {Array}
   */

  Util.complexLabel = function (individual) {

    individual = individual.properties || individual;
    var cache = {};
    cache[ individual["@"] ] = individual;
    var re_date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/i;
    function get (uri) {
      return cache[uri] ? cache[uri] : cache[uri] = get_individual(veda.ticket, uri);
    }
    try {

      var availableLanguages = get("v-ui:AvailableLanguage");
      var languages = availableLanguages["rdf:value"].map(function (languageValue) {
        var languageUri = languageValue.data;
        var language = get(languageUri);
        return language["rdf:value"][0].data;
      });
      return individual["rdf:type"].reduce(function (acc, typeValue) {
        var typeUri = typeValue.data;
        var type = get(typeUri);
        if ( !type || !Util.hasValue(type, "v-s:labelPattern") ) { return acc; }
        var pattern = type["v-s:labelPattern"][0].data;
        languages.forEach(function (language) {
          var replaced = pattern.replace(/{(\s*([^{}]+)\s*)}/g, function (match, group) {
            var indexes = null;
            if (group.indexOf(' ') != -1) {
              var temp = group.split(' ');
              group = temp[0];
              indexes = temp[1].substring(1, temp[1].length-1).split(',');
            }
            var chain = group.split(".");
            if (chain[0] === "@") {
              chain[0] = individual["@"];
            }
            var localedChain = get_localized_chain.apply({}, [language].concat(chain));
            return indexes == null? localedChain : localedChain.substring(+indexes[0], +indexes[1]);
          });
          var result = {
            data: replaced,
            lang: language,
            type: "String"
          };
          acc.push(result);
        });
        return acc;
      }, []);
    } catch (err) {
      console.log("Complex label error", err, err.stack);
      return [];
    }

    function get_localized_chain(language, uri) {
      var properties = [].slice.call(arguments, 2);
      var startPoint = get(uri);
      if (!startPoint) { return ""; }
      var intermediates = [startPoint];
      for (var i = 0, property; (property = properties[i]); i++) {
        var length = properties.length;
        if (i === length - 1) {
          var parts = [];
          intermediates.forEach(function(item) {
            if (item[property]) {
              var part = item[property].reduce(function (acc, value) {
                if ( !value.lang || value.lang === "NONE" || value.lang.toLowerCase() === language.toLowerCase() ) {
                  var data = value.data;
                  if ( data instanceof Date || re_date.test(data) ) {
                    data = new Date(data);
                    data = new Date(data.getTime() - (data.getTimezoneOffset() * 60000)).toISOString().substr(0, 10);
                  }
                  return acc += data;
                } else {
                  return acc;
                }
              }, "");
              parts.push(part);
            }

          });
          return parts.join(", ");
        }
        var temp = [];
        intermediates.forEach(function(item) {
          if (Util.hasValue(item, property)) {
            item[property].forEach(function(propertyItem) {
              temp.push(get(propertyItem.data));
            });
          }
        });
        if (temp.length) {
          intermediates = temp;
        } else {
          return "";
        }
      }
      return "";
    }
  };

  Util.clone = function (obj) {
    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" !== typeof obj) {

      return obj;

    } else if (obj instanceof Date) {

      // Handle Date
      copy = new Date();
      copy.setTime(obj.getTime());
      return copy;

    } else if (obj instanceof Array) {

      // Handle Array
      copy = [];
      for (var i = 0, len = obj.length; i < len; i++) {
        copy[i] = Util.clone(obj[i]);
      }
      return copy;

    } else if (obj instanceof Object) {

      // Handle Object
      copy = {};
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = Util.clone(obj[attr]);
      }
      return copy;

    } else {

      throw new Error("Unable to copy obj! Its type isn't supported.");

    }

  };

  Util.addToGroup = function (ticket, group, resource, allow, deny) {

    var new_membership_uri = Util.genUri() + "-mbh";
    var new_membership = {
      '@': new_membership_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:memberOf': Util.newUri(group),
      'v-s:resource': Util.newUri(resource)
    };

    (allow || []).forEach(function (right) {
      new_membership[right] = Util.newBool(true);
    });

    (deny || []).forEach(function (right) {
      new_membership[right] = Util.newBool(false);
    });

    var res = put_individual(ticket, new_membership);
    return [new_membership, res];
  };

  Util.removeFromGroup = function (ticket, group, resource) {

    var new_membership_uri = Util.genUri() + "-mbh";
    var new_membership = {
      '@': new_membership_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:memberOf': Util.newUri(group),
      'v-s:resource': Util.newUri(resource),
      'v-s:deleted': Util.newBool(true)
    };

    var res = put_individual(ticket, new_membership);
    return [new_membership, res];
  };

  Util.addRight = function (ticket, subj_uri, obj_uri, allow, deny) {

    if (subj_uri === undefined || obj_uri === undefined) {
      var error = new Error("Util.addRight: INVALID ARGS");
      console.log("subj_uri =", subj_uri);
      console.log("obj_uri =", obj_uri);
      console.log("Error stack:", error.stack);
      return;
    }

    var uri = Util.genUri() + "-r";

    var permission = {
      '@': uri,
      'rdf:type': Util.newUri('v-s:PermissionStatement'),
      'v-s:permissionObject': Util.newUri(obj_uri),
      'v-s:permissionSubject': Util.newUri(subj_uri)
    };

    (allow || []).forEach(function (right) {
      permission[right] = Util.newBool(true);
    });

    (deny || []).forEach(function (right) {
      permission[right] = Util.newBool(false);
    });

    var res = put_individual(ticket, permission);
    return [permission, res];
  };

  Util.newUri = function (uri) {
    return [{
      data: uri,
      type: "Uri"
    }];
  };

  Util.newStr = function (_data, _lang) {
    var value = {
      data: _data,
      type: "String"
    };
    if (_lang && _lang !== 'NONE') {
      value.lang = _lang;
    }
    return [ value ];
  };

  Util.newStrFromBundle = function (_bundle1, _bundle2, _sep) {
    if (!_sep)
      _sep = ' ' ;
    var str = _bundle1['rdfs:label'][0] + _sep + _bundle2['rdfs:label'][0] ;
    return str ;
  };

  Util.newBool = function (_data) {
    return [{
      data: _data,
      type: "Boolean"
    }];
  };

  Util.newInt = function (_data) {
    return [{
      data: _data,
      type: "Integer"
    }];
  };

  Util.newDecimal = function (_data) {
    return [{
      data: _data,
      type: "Decimal"
    }];
  };

  Util.newDate = function (_data) {
    return [{
      data: _data,
      type: "Datetime"
    }];
  };

  Util.addDay = function (_data, _days) {
    if (!_data) {
      _data = new Date();
    }
    try {
      _data.setDate(_data.getDate() + _days);
    } catch (e) {
      console.log(e);
    }
    return _data;
  };

  Util.getValues = function (property_value) {
    var res = [];
    if (property_value) {
      for (var i in property_value) {
        res.push(property_value[i].data);
      }
    }
    return res;
  };

  Util.getUris = function (property_value) {
    var res = [];
    if (property_value) {
      for (var i in property_value) {
        res.push(property_value[i].data);
      }
    }
    return res;
  };

  Util.getStrings = function (property_value) {
    var res = [];
    if (property_value) {
      for (var i in property_value) {
        res.push(property_value[i].data);
      }
    }
    return res;
  };

  Util.getUri = function (property_value) {
    if (property_value && property_value.length > 0) {
      return property_value[0].data;
    }
  };

  Util.getFirstValue = function (property_value) {
    if (property_value && property_value.length > 0) {
      if (property_value[0].type == "Integer") {
        return parseInt(property_value[0].data, 10);
      } else if (property_value[0].type == "Datetime") {
        return new Date(property_value[0].data);
      }
      return property_value[0].data;
    }
  };

  Util.getFirstValueUseLang = function (property_value, lang) {
    for (var i in property_value) {
      if (property_value[i].lang == lang) {
        return property_value[i].data;
      }
    }
    return null;
  };

  Util.mlstring = function (ruString, enString) {
    return [{type: "String", data: ruString, lang: "RU"}, {type: "String", data: enString, lang: "EN"}];
  };

  // Returns literal value or resource id for given property chain
  Util.getPropertyChain = function () {
    var value = arguments[0];
    var argsLength = arguments.length;
    if (typeof value === "string") {
      value = get_individual(veda.ticket, value);
    }
    var i, property_uri, type;
    for (i = 1; i < argsLength; i++) {
      property_uri = arguments[i];
      if ( Util.hasValue(value, property_uri) ) {
        if (i === (argsLength - 1) ) {
          return value[property_uri].map(function (el) {
            return el.data;
          });
        } else {
          type = value[property_uri][0].type;
          value = value[property_uri][0].data;
          if (type === "Uri") {
            value = get_individual(veda.ticket, value);
            continue;
          }
        }
      }
      return;
    }
    return value;
  };

  Util.areEqual = function (x, y) {
    if ( x === y ) return true;
    if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
    if ( x.constructor !== y.constructor ) return false;
    for ( var p in x ) {
      if ( ! x.hasOwnProperty( p ) ) continue;
      if ( ! y.hasOwnProperty( p ) ) return false;
      if ( x[ p ] === y[ p ] ) continue;
      if ( typeof( x[ p ] ) !== "object" ) return false;
      if ( ! Util.areEqual( x[ p ],  y[ p ] ) ) return false;
    }
    for ( p in y ) {
      if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
    }
    return true;
  };

  /**
    Local database for individuals
  */

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

  function LocalDB() {
    var self = this;
    var version = veda.manifest.veda_version;
    this.db_name = veda.manifest.short_name;
    this.store_name = "store";

    // Singleton pattern
    if (LocalDB.prototype[this.db_name + this.store_name]) {
      return Promise.resolve(LocalDB.prototype[this.db_name + this.store_name]);
    }

    return LocalDB.prototype[this.db_name + this.store_name] = initDB(this.db_name, this.store_name);

    function initDB(db_name, store_name) {

      return new Promise(function (resolve, reject) {

        var openReq = window.indexedDB.open(db_name, version);

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
          var stores = [];
          for (var i = 0; i < db.objectStoreNames.length; i++) {
            stores.push( db.objectStoreNames[i] );
          }
          stores.forEach(function (store) {
            db.deleteObjectStore(store);
            console.log("DB store deleted:", store);
          });
          db.createObjectStore(self.store_name);
          console.log("DB create success");
        };
      }).catch(function (error) {
        console.log("IndexedDB error, using in-memory fallback.", error);
        return fallback;
      });
    }
  }
  var proto = LocalDB.prototype;

  proto.get = function (key) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var request = self.db.transaction([self.store_name], "readonly").objectStore(self.store_name).get(key);
      request.onerror = function(error) {
        reject(error);
      };
      request.onsuccess = function(event) {
        resolve(event.target.result);
      };
    });
  };

  proto.put = function (key, value) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var request = self.db.transaction([self.store_name], "readwrite").objectStore(self.store_name).put(value, key);
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
      var request = self.db.transaction([self.store_name], "readwrite").objectStore(self.store_name).delete(key);
      request.onerror = function(error) {
        reject(error);
      };
      request.onsuccess = function(event) {
        resolve(event.target.result);
      };
    });
  };

  var serverBackend = {};

  var browserBackend = {};

  var Backend = veda.Backend = ( veda.env === "server" ? serverBackend : browserBackend );

  //////////////   SERVER   ///////////////

  serverBackend.status = "limited";

  serverBackend.query = function (ticket, queryStr, sort, databases, top, limit, from) {
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

  serverBackend.get_individual = function (ticket, uri) {
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

  serverBackend.reset_individual = serverBackend.get_individual;

  serverBackend.get_individuals = function (ticket, uris) {
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

  serverBackend.remove_individual = function (ticket, uri) {
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

  serverBackend.put_individual = function (ticket, individual) {
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

  serverBackend.add_to_individual = function (ticket, individual) {
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

  serverBackend.set_in_individual = function (ticket, individual) {
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

  serverBackend.remove_from_individual = function (ticket, individual) {
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

  //////////////   BROWSER   //////////////

  var default_timeout = 15000;
  var query_timeout = default_timeout * 10;

  // Check server health
  browserBackend.ping = function () {
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

  browserBackend.status = "offline";
  var status = {};
  function setStatus(state) {
    status.line = state === "online" ? 1 : state === "offline" ? 0 : status.line;
    status.ccus = state === "ccus-online" ? 1 : state === "ccus-offline" ? 0 : status.ccus;
    if (status.line && status.ccus) {
      browserBackend.status = "online";
    } else if (status.line && !status.ccus) {
      browserBackend.status = "limited";
    } else {
      browserBackend.status = "offline";
    }
    this.trigger("status", browserBackend.status);
  }
  veda.on("online offline ccus-online ccus-offline", setStatus);

  var interval;
  var duration = default_timeout;
  browserBackend.check = function () {
    if (interval) { return; }
    interval = setInterval(check, duration);
    if (!arguments.length) { check(); }
    function check() {
      browserBackend.ping().then(function () {
        interval = clearInterval(interval);
        veda.trigger("online");
      }).catch(function () {
        veda.trigger("offline");
      });
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", browserBackend.check);
    window.addEventListener("offline", browserBackend.check);
    veda.on("ccus-online", browserBackend.check);
    veda.on("ccus-offline", browserBackend.check);
  }

  // Server errors
  function browserBackendError (result) {
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
      browserBackend.check();
    }
    if (result.status === 470 || result.status === 471) {
      veda.trigger("login:failed");
    }
  }
  browserBackendError.prototype = Object.create(Error.prototype);
  browserBackendError.prototype.constructor = browserBackendError;

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
          resolve( JSON.parse(this.response, Util$1.decimalDatetimeReviver) );
        } else {
          reject( new browserBackendError(this) );
        }
      };
      xhr.onerror = function () {
        reject( new browserBackendError(this) );
      };
      xhr.ontimeout = function () {
        reject( new browserBackendError(this) );
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

  browserBackend.get_rights = function (ticket, uri) {
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
    return call_server(params).catch(function (browserBackendError) {
      if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
        return {
          "@":"_",
          "rdf:type":[{"data":"v-s:PermissionStatement", "type":"Uri"}],
          "v-s:canCreate":[{"data":true, "type":"Boolean"}],
          "v-s:canDelete":[{"data":false, "type":"Boolean"}],
          "v-s:canRead":[{"data":true, "type":"Boolean"}],
          "v-s:canUpdate":[{"data":true, "type":"Boolean"}]
        };
      } else {
        throw browserBackendError;
      }
    });
  };

  browserBackend.get_rights_origin = function (ticket, uri) {
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
    return call_server(params).catch(function (browserBackendError) {
      if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
        return [];
      } else {
        throw browserBackendError;
      }
    });
  };

  browserBackend.get_membership = function (ticket, uri) {
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
    return call_server(params).catch(function (browserBackendError) {
      if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
        return {
          "@":"_",
          "rdf:type":[{"data":"v-s:Membership", "type":"Uri"}],
          "v-s:memberOf":[{"data":"v-s:AllResourcesGroup", "type":"Uri"}],
          "v-s:resource":[{"data": isObj ? arg.uri : uri, "type":"Uri"}]
        };
      } else {
        throw browserBackendError;
      }
    });
  };


  browserBackend.authenticate = function (login, password, secret) {
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
    return call_server(params)
    .then(function (result) {
      return {
        ticket: result.id,
        user_uri: result.user_uri,
        end_time: Math.floor((result.end_time - 621355968000000000) / 10000)
      };
    });
  };

  browserBackend.get_ticket_trusted = function (ticket, login) {
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

  browserBackend.is_ticket_valid = function (ticket) {
    var arg = arguments[0];
    var isObj = typeof arg === "object";
    var params = {
      method: "GET",
      url: "/is_ticket_valid",
      ticket: isObj ? arg.ticket : ticket,
      timeout: default_timeout,
      data: {}
    };
    return call_server(params).catch(function (browserBackendError) {
      if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
        return true;
      } else {
        throw browserBackendError;
      }
    });
  };

  browserBackend.get_operation_state = function (module_id, wait_op_id) {
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

  browserBackend.wait_module = function (module_id, in_op_id) {
    var timeout = 1;
    var op_id_from_module;
    for (var i = 0; i < 100; i++) {
      op_id_from_module = browserBackend.get_operation_state (module_id, in_op_id);
      if (op_id_from_module >= in_op_id) { break; }
      var endtime = new Date().getTime() + timeout;
      while (new Date().getTime() < endtime);
      timeout += 2;
    }
  };

  browserBackend.query = function (ticket, queryStr, sort, databases, reopen, top, limit, from, sql) {
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
    return call_server(params).catch(function (browserBackendError) {
      if (browserBackendError.code === 999) {
        return browserBackend.query(ticket, queryStr, sort, databases, reopen, top, limit, from, sql);
      } else if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
        params.ticket = undefined;
        var localDB = new LocalDB();
        return localDB.then(function (db) {
          return db.get(JSON.stringify(params));
        });
      } else {
        throw browserBackendError;
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

  browserBackend.get_individual = function (ticket, uri, reopen) {
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
    if (browserBackend.status === "online" || browserBackend.status === "offline") {
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
      return browserBackend.reset_individual(ticket, uri, reopen);
    }
  };

  browserBackend.reset_individual = function (ticket, uri, reopen) {
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
    }).catch(function (browserBackendError) {
      if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
        // Cache second
        var localDB = new LocalDB();
        return localDB.then(function (db) {
          return db.get(params.data.uri);
        }).then(function (result) {
          if (result) {
            return result;
          } else {
            throw browserBackendError;
          }
        });
      } else {
        throw browserBackendError;
      }
    });
  };

  browserBackend.get_individuals = function (ticket, uris) {
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
    if (browserBackend.status === "online" || browserBackend.status === "offline") {
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
      }).catch(function (browserBackendError) {
        if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
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
          throw browserBackendError;
        }
      });
    }
  };

  function call_server_put(params) {
    return call_server(params).catch(function (browserBackendError) {
      if (browserBackendError.code === 0 || browserBackendError.code === 503 || browserBackendError.code === 4000 ) {
        return enqueueCall(params).then(function (queue) {
          console.log("Offline operation added to queue, queue length = ", queue.length);
          return {
            "op_id":0,
            "result":200
          };
        });
      } else {
        throw browserBackendError;
      }
    });
  }

  browserBackend.remove_individual = function (ticket, uri, assigned_subsystems, event_id, transaction_id) {
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

  browserBackend.put_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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

  browserBackend.add_to_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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

  browserBackend.set_in_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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

  browserBackend.remove_from_individual = function (ticket, individual, assigned_subsystems, event_id, transaction_id) {
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

  browserBackend.put_individuals = function (ticket, individuals, assigned_subsystems, event_id, transaction_id) {
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

  browserBackend.uploadFile = function (params, tries) {
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
        return browserBackend.uploadFile(params, --tries);
      }
      throw error;
    });
  };

  browserBackend.loadFile = function (url) {
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

  // Class to manipulate individuals.

  /**
   * @constructor
   * @param {String} uri URI of individual. If not specified, than id of individual will be generated automatically.
   * @param {boolean} cache Use cache true / false. If true or not set, then object will be return from application cache (veda.cache). If false or individual not found in application cache - than individual will be loaded from database
   * @param {boolean} init individual with class model at load. If true or not set, then individual will be initialized with class specific model upon load.
   */

  var IndividualModel = veda.IndividualModel = IndividualModel$1;

  function IndividualModel$1(uri, cache, init) {
    // IndividualModel({...})
    if (typeof uri === "object" && !uri["@"]) {
      cache = uri.cache;
      init  = uri.init;
      uri   = uri.uri;
    }

    // Define Model data
    this._ = {
      cache: typeof cache === "boolean" ? cache : cache || true,
      init: typeof init !== "undefined" ? init : true,
      isNew: typeof uri === "undefined",
      isSync: typeof uri === "object",
      isLoaded: typeof uri === "object",
      pending: {},
      uri: uri
    };

    if (typeof uri === "object") {
      this.properties = uri;
      this.original = JSON.stringify(uri);
    } else {
      this.properties = {};
    }

    if (this._.cache) {
      var cached;
      if (typeof uri === "string") {
        this.id = uri;
        cached = veda.cache.get(this.id);
      } else if (typeof uri === "object") {
        cached = veda.cache.get(this.id);
        if (cached && !cached.isLoaded()) {
          cached.properties = uri;
        }
      } else if (typeof uri === "undefined") {
        this.id = Util$1.genUri();
      }
      if (cached) {
        return cached;
      } else {
        veda.cache.set(this, this._.cache);
      }
    }

    var self = riot.observable(this);

    this.on("rdf:type", this.init);
    this.on("beforeSave", beforeSaveHandler);

    return self;
  }
  function beforeSaveHandler() {
    var now = new Date();
    var user = veda.appointment ? veda.appointment : veda.user;

    if ( !this.hasValue("v-s:creator") ) { this.set("v-s:creator", [user]); }
    if ( !this.hasValue("v-s:created") ) { this.set("v-s:created", [now]); }

    if (veda.user.id === "cfg:Administrator") {
      return;
    } else if (
      !this.hasValue("v-s:lastEditor")
      || !this.hasValue("v-s:edited")
      || this.get("v-s:lastEditor")[0].id !== user.id
      || (now - this.get("v-s:edited")[0]) > 1000
    ) {
      this.set("v-s:edited", [now]);
      this.set("v-s:lastEditor", [user]);
    }
  }

  var proto$1 = IndividualModel$1.prototype;

  proto$1.get = function (property_uri) {
    var self = this;
    if (!self.properties[property_uri]) return [];
    return self.properties[property_uri].map( parser );
  };

  proto$1.set = function (property_uri, values, silently) {
    this.isSync(false);
    if ( !Array.isArray(values) ) {
      values = [values];
    }
    values = values.filter(function (i) { return i !== undefined && i !== null && i !== ""; });
    var serialized = values.map(serializer).filter(Boolean);
    var uniq = unique(serialized);
    if ( JSON.stringify(uniq) !== JSON.stringify(this.properties[property_uri] || []) ) {
      if (uniq.length) {
        this.properties[property_uri] = uniq;
      } else {
        delete this.properties[property_uri];
      }
      if ( !silently ) {
        values = this.get(property_uri);
        this.trigger("propertyModified", property_uri, values);
        this.trigger(property_uri, values);
      }
    }
    return this;
  };

  function unique (arr) {
    var n = {}, r = [];
    for(var i = 0, val; i < arr.length; i++) {
      val = arr[i].type + arr[i].data + (arr[i].lang || "");
      if (!n[val]) {
        n[val] = true;
        r.push(arr[i]);
      }
    }
    return r;
  }

  // Define properties from ontology in IndividualModel.prototype
  IndividualModel$1.defineProperty = function (property_uri) {
    Object.defineProperty(proto$1, property_uri, {
      get: function () {
        return this.get(property_uri);
      },
      set: function (values) {
        return this.set(property_uri, values);
      },
      configurable: false,
      enumerable: false
    });
  };

  function parser(value) {
    if (value.type === "String") {
      var string = new String(value.data);
      if (value.lang !== "NONE") { string.language = value.lang; }
      return string;
    } else if (value.type === "Uri") {
      return new IndividualModel$1(value.data);
    } else if (value.type === "Datetime") {
      return new Date(Date.parse(value.data));
    } else if (value.type === "Decimal") {
      return parseFloat(value.data);
    } else {
      return value.data;
    }
  }

  var reg_uri = /^[a-z-0-9]+:([a-zA-Z0-9-_])*$/;
  var reg_date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  var reg_ml_string = /^(.*)@([a-z]{2})$/i;

  function serializer (value) {
    if (typeof value === "number" ) {
      return {
        type: Util$1.isInteger(value) ? "Integer" : "Decimal",
        data: value
      };
    } else if (typeof value === "boolean") {
      return {
        type: "Boolean",
        data: value
      };
    } else if (value instanceof Date) {
      return {
        type: "Datetime",
        data: value.toISOString()
      };
    } else if (value instanceof IndividualModel$1) {
      return {
        type: "Uri",
        data: value.id
      };
    } else if (typeof value === "string" || value instanceof String) {
      if ( reg_uri.test(value) ) {
        return {
          type: "Uri",
          data: value.valueOf()
        };
      } else if ( reg_date.test(value) ) {
        return {
          type: "Datetime",
          data: value.valueOf()
        };
      } else if ( reg_ml_string.test(value) ) {
        return {
          type: "String",
          data: value.replace(reg_ml_string, "$1"),
          lang: value.replace(reg_ml_string, "$2").toUpperCase()
        };
      } else {
        return {
          type: "String",
          data: value.valueOf(),
          lang: value.language || "NONE"
        };
      }
    }
  }

  // Special properties
  Object.defineProperty(proto$1, "id", {
    get: function () {
      return this.properties["@"];
    },
    set: function (value) {
      var previous = this.properties && this.properties["@"];
      this.properties["@"] = value;
      if (previous && this._.cache && veda.cache.get(previous)) {
        veda.cache.remove(previous);
        veda.cache.set(this, this._.cache);
      }
    }
  });

  Object.defineProperty(proto$1, "membership", {
    get: function () {
      var self = this;
      //if (this._.membership) { return Promise.resolve(this._.membership); }
      if (this.isNew()) {
        this._.membership = new IndividualModel$1({ cache: false });
        return Promise.resolve(this._.membership);
      }
      return Backend.get_membership(veda.ticket, this.id).then(function (membershipJSON) {
        self._.membership = new IndividualModel$1({ uri: membershipJSON, cache: false });
        return self._.membership.load();
      }).catch(function  (error) {
        console.log("membership error", self.id, error);
        self._.membership = new IndividualModel$1({ cache: false });
        return self._.membership.load();
      });
    },
    configurable: false,
    enumerable: false
  });

  proto$1.memberOf = function () {
    return this.membership.then(function (membership) {
      return membership.hasValue("v-s:memberOf") ? membership.properties["v-s:memberOf"].map(function (group_item) {
        return group_item.data;
      }) : [];
    })
  };

  proto$1.isMemberOf = function (group_uri) {
    return this.membership.then(function (membership) {
      return membership.hasValue("v-s:memberOf", group_uri);
    });
  };

  Object.defineProperty(proto$1, "rights", {
    get: function () {
      var self = this;
      //if (this._.rights) { return Promise.resolve(this._.rights); }
      if (this.isNew()) {
        this._.rights = new IndividualModel$1({ cache: false });
        this._.rights["v-s:canCreate"] = [ true ];
        this._.rights["v-s:canRead"] = [ true ];
        this._.rights["v-s:canUpdate"] = [ true ];
        this._.rights["v-s:canDelete"] = [ true ];
        return Promise.resolve(this._.rights);
      }
      return Backend.get_rights(veda.ticket, this.id).then(function (rightsJSON) {
        return self._.rights = new IndividualModel$1( rightsJSON, false );
      }).catch(function  (error) {
        console.log("rights error", self.id, error);
        return self._.rights = new IndividualModel$1({ cache: false });
      });
    },
    configurable: false,
    enumerable: false
  });

  proto$1.can = function (action) {
    action = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
    return this.rights.then(function (rights) {
      return rights.hasValue("v-s:can" + action, true);
    });
  };
  proto$1.canCreate = function () {
    return this.can("Create");
  };
  proto$1.canRead = function () {
    return this.can("Read");
  };
  proto$1.canUpdate = function () {
    return this.can("Update");
  };
  proto$1.canDelete = function () {
    return this.can("Delete");
  };

  Object.defineProperty(proto$1, "rightsOrigin", {
    get: function () {
      var self = this;
      //if (this._.rightsOrigin) { return Promise.resolve(this._.rightsOrigin); }
      return Backend.get_rights_origin(veda.ticket, this.id).then(function (rightsOriginArr) {
        return self._.rightsOrigin = Promise.all(rightsOriginArr.map(function (item) {
          return new IndividualModel$1( item, false );
        }));
      }).catch(function  (error) {
        console.log("rights error", self.id, error);
        return self._.rightsOrigin = [];
      });
    },
    configurable: false,
    enumerable: false
  });

  /**
   * @method
   * Load individual specified by uri from database. If cache parameter (from constructor) is true, than try to load individual from browser cache first.
   * @param {String} uri individual uri
   */
  proto$1.load = function () {
    if ( this.isLoading() && typeof window !== "undefined" ) {
      return this.isLoading();
    }
    var self = this;
    this.trigger("beforeLoad");
    if ( this.isLoaded() && ( Backend.status === "online" || Backend.status === "offline" ) ) {
      this.trigger("afterLoad", this);
      return Promise.resolve( this );
    } else if ( this.isLoaded() && Backend.status === "limited" ) {
      if (typeof window !== "undefined") {
        return this.is("v-s:UserThing").then(function (isUserThing) {
          if (isUserThing) {
            return self.reset();
          } else {
            return self;
          }
        }).then(function (self) {
          self.trigger("afterLoad", self);
          return self;
        });
      } else {
        return self.reset()
        .then(function (self) {
          self.trigger("afterLoad", self);
          return self;
        });
      }
    }
    var uri = this._.uri ;
    if (typeof uri === "string") {
      var loadingPromise = Backend.get_individual(veda.ticket, uri).then(function (individualJson) {
        self.isLoading(false);
        self.isNew(false);
        self.isSync(true);
        self.isLoaded(true);
        self.properties = individualJson;
        self.original = JSON.stringify(individualJson);
        self.trigger("afterLoad", self);
        if (self._.init) {
          return self.init();
        }
        return self;
      }).catch(function (error) {
        self.isLoading(false);
        console.log("load individual error", self.id, error);
        if (error.code === 422 || error.code === 404) {
          self.isNew(true);
          self.isSync(false);
          self.isLoaded(false);
          self.properties = {
            "@": uri,
            "rdf:type": [{type: "Uri", data: "rdfs:Resource"}],
            "rdfs:label": [
              {type: "String", data: "Объект не существует [" + uri + "]", lang: "RU"},
              {type: "String", data: "Object does not exist [" + uri + "]", lang: "EN"}
            ]
          };
        } else if (error.code === 472) {
          self.isNew(false);
          self.isSync(false);
          self.isLoaded(false);
          self.properties = {
            "@": uri,
            "rdf:type": [{type: "Uri", data: "rdfs:Resource"}],
            "rdfs:label": [
              {type: "String", data: "Нет прав на объект", lang: "RU"},
              {type: "String", data: "Insufficient rights", lang: "EN"}
            ]
          };
        } else if (error.code === 470 || error.code === 471) {
          self.isNew(false);
          self.isSync(false);
          self.isLoaded(false);
        } else if (error.code === 0 || error.code === 4000 || error.code === 503) {
          self.isNew(false);
          self.isSync(false);
          self.isLoaded(false);
          self.properties = {
            "@": uri,
            "rdf:type": [{type: "Uri", data: "rdfs:Resource"}],
            "rdfs:label": [
              {type: "String", data: "Нет связи с сервером. Этот объект сейчас недоступен.", lang: "RU"},
              {type: "String", data: "Server disconnected. This object is not available now.", lang: "EN"}
            ]
          };
          veda.one("online", function () {
            self.reset();
          });
        } else {
          self.isNew(false);
          self.isSync(false);
          self.isLoaded(false);
          self.properties = {
            "@": uri,
            "rdf:type": [{type: "Uri", data: "rdfs:Resource"}],
            "rdfs:label": [{type: "String", data: uri, lang: "NONE"}]
          };
        }
        self.trigger("afterLoad", self);
        return self;
      });
      return this.isLoading(loadingPromise);

    } else if (typeof uri === "object") {
      this.isNew(false);
      this.isSync(true);
      this.isLoaded(true);
      this.properties = uri;
    } else if (typeof uri === "undefined") {
      this.isNew(true);
      this.isSync(false);
      this.isLoaded(false);
    }
    this.trigger("afterLoad", this);
    if (this._.init) {
      return this.init();
    }
    return Promise.resolve(this);
  };

  /**
   * @method
   * Save current individual to database
   */
  proto$1.save = function() {
    // Do not save individual to server if nothing changed
    if (this.isSync()) { return Promise.resolve(this); }
    if ( this.isSaving() && this.isSync() && typeof window !== "undefined" ) {
      return this.isSaving();
    }
    var self = this;
    this.trigger("beforeSave");
    Object.keys(this.properties).reduce(function (acc, property_uri) {
      if (property_uri === "@") return acc;
      acc[property_uri] = acc[property_uri].filter(function (item) {
        return item && item.data !== "" && item.data !== undefined && item.data !== null;
      });
      if (!acc[property_uri].length) delete acc[property_uri];
      return acc;
    }, this.properties);

    var original = this.original ? JSON.parse(this.original, Util$1.decimalDatetimeReviver) : {"@": this.id};
    var delta = Util$1.diff(this.properties, original);

    var promise = (this.isNew() ?
      Backend.put_individual(veda.ticket, this.properties) :
      Promise.all([
        delta.added && Object.keys(delta.added).length ? (delta.added["@"] = this.id, Backend.add_to_individual(veda.ticket, delta.added)) : undefined,
        delta.differ && Object.keys(delta.differ).length ? (delta.differ["@"] = this.id, Backend.set_in_individual(veda.ticket, delta.differ)) : undefined,
        delta.missing && Object.keys(delta.missing).length? (delta.missing["@"] = this.id, Backend.remove_from_individual(veda.ticket, delta.missing)) : undefined
      ])
    ).then(function () {
      self.original = JSON.stringify(self.properties);
      self.isSaving(false);
      self.isNew(false);
      self.isSync(true);
      self.isLoaded(true);
      self.trigger("afterSave");
      return self;
    }).catch(function (error) {
      self.isSaving(false);
      console.log("save individual error", self.id, error);
      throw error;
    });

    return this.isSaving(promise);
  };

  /**
   * @method
   * Reset current individual to  database
   */
  proto$1.reset = function (original) {
    var self = this;
    if ( this.isResetting() && typeof window !== "undefined" ) {
      return this.isResetting();
    }
    this.trigger("beforeReset");
    if (this.isNew()) {
      this.trigger("afterReset");
      return Promise.resolve(this);
    }
    var promise = (original ? Promise.resove(original) : Backend.reset_individual(veda.ticket, self.id))
      .then(processOriginal)
      .then(function () {
        self.isResetting(false);
        self.isNew(false);
        self.isSync(true);
        self.isLoaded(true);
        self.trigger("afterReset");
        return self;
      })
      .catch(function (error) {
        self.isResetting(false);
        console.log("reset individual error", self.id, error);
        throw error;
      });
    return self.isResetting(promise);

    function processOriginal(original) {
      self.original = JSON.stringify(original);
      var self_property_uris = Object.keys(self.properties);
      var original_property_uris = Object.keys(original);
      var union = Util$1.unique( self_property_uris.concat(original_property_uris) );
      union.forEach(function (property_uri) {
        var modified = false;
        if (property_uri === "@") { return; }
        if (!self.properties[property_uri]) {
          self.properties[property_uri] = original[property_uri];
          modified = true;
        } else if (!original[property_uri]) {
          delete self.properties[property_uri];
          modified = true;
        } else {
          var currentSum = JSON.stringify(self.properties[property_uri]).split("").reduce(function (acc, char) {return acc += char.charCodeAt(0);}, 0);
          var originalSum = JSON.stringify(original[property_uri]).split("").reduce(function (acc, char) {return acc += char.charCodeAt(0);}, 0);
          if (currentSum !== originalSum) {
            self.properties[property_uri] = original[property_uri];
            modified = true;
          }
        }
        if (modified) {
          var values = self.get(property_uri);
          self.trigger("propertyModified", property_uri, values);
          self.trigger(property_uri, values);
        }
      });
    }
  };

  /**
   * @method
   * Mark current individual as deleted in database (add v-s:deleted property)
   */
  proto$1.delete = function () {
    this.trigger("beforeDelete");
    if ( this.isNew() ) {
      this.trigger("afterDelete");
      return Promise.resolve(this);
    }
    this["v-s:deleted"] = [ true ];
    this.trigger("afterDelete");
    return this.save();
  };

  /**
   * @method
   * Remove individual from database
   */
  proto$1.remove = function () {
    var self = this;
    this.trigger("beforeRemove");
    if ( this._.cache && veda.cache && veda.cache.get(this.id) ) {
      veda.cache.remove(this.id);
    }
    if ( this.isNew() ) {
      this.trigger("afterRemove");
      return Promise.resolve(this);
    }
    return Backend.remove_individual(veda.ticket, this.id).then(function () {
      self.trigger("afterRemove");
      return self;
    });
  };

  /**
   * @method
   * Recover current individual in database (remove v-s:deleted property)
   */
  proto$1.recover = function () {
    this.trigger("beforeRecover");
    this["v-s:deleted"] = [];
    this.trigger("afterRecover");
    return this.save();
  };

  /**
   * @method
   * @param {String} property_uri property name
   * @return {boolean} is requested property exists in this individual
   */
  proto$1.hasValue = function (property_uri, value) {
    if (!property_uri && typeof value !== "undefined" && value !== null) {
      var found = false;
      for (var property_uri in this.properties) {
        if (property_uri === "@") { continue; }
        found = found || this.hasValue(property_uri, value);
      }
      return found;
    }
    var result = !!(this.properties[property_uri] && this.properties[property_uri].length);
    if (typeof value !== "undefined" && value !== null) {
      var serialized = serializer(value);
      result = result && !!this.properties[property_uri].filter( function (item) {
        return ( item.data == serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
      }).length;
    }
    return result;
  };

  /**
   * @method
   * @param {String} property_uri property name
   * @param {Any allowed type} value
   * @return {this}
   */
  proto$1.addValue = function (property_uri, values, silently) {
    if (typeof values === "undefined" || values === null) {
      return this;
    }
    this.properties[property_uri] = this.properties[property_uri] || [];
    if ( Array.isArray(values) ) {
      var that = this;
      values.forEach(function (value) {
        addSingleValue.call(that, property_uri, value);
      });
    } else {
      addSingleValue.call(this, property_uri, values);
    }
    this.isSync(false);
    if ( !silently ) {
      values = this.get(property_uri);
      this.trigger("propertyModified", property_uri, values);
      this.trigger(property_uri, values);
    }
    return this;
  };
  function addSingleValue(property_uri, value) {
    if (value != undefined) {
      var serialized = serializer(value);
      this.properties[property_uri].push(serialized);
    }
  }

  /**
   * @method
   * @param {String} property_uri property name
   * @param {Any allowed type} value
   * @return {this}
   */
  proto$1.removeValue = function (property_uri, values, silently) {
    if (!this.properties[property_uri] || !this.properties[property_uri].length || typeof values === "undefined" || values === null) {
      return this;
    }
    if ( Array.isArray(values) ) {
      var that = this;
      values.forEach(function (value) {
        removeSingleValue.call(that, property_uri, value);
      });
    } else {
      removeSingleValue.call(this, property_uri, values);
    }
    this.isSync(false);
    if ( !silently ) {
      values = this.get(property_uri);
      this.trigger("propertyModified", property_uri, values);
      this.trigger(property_uri, values);
    }
    return this;
  };
  function removeSingleValue (property_uri, value) {
    if (value != undefined) {
      var serialized = serializer(value);
      this.properties[property_uri] = (this.properties[property_uri] || []).filter(function (item) {
        return !( item.data == serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
      });
    }
  }

  /**
   * @method
   * @param {String} property_uri property name
   * @param {Any allowed type} value
   * @return {this}
   */
  proto$1.toggleValue = function (property_uri, values, silently) {
    if (typeof values === "undefined" || values === null) {
      return this;
    }
    this.properties[property_uri] = this.properties[property_uri] || [];
    if ( Array.isArray(values) ) {
      var that = this;
      values.forEach(function (value) {
        toggleSingleValue.call(that, property_uri, value);
      });
    } else {
      toggleSingleValue.call(this, property_uri, values);
    }
    this.isSync(false);
    if ( !silently ) {
      values = this.get(property_uri);
      this.trigger("propertyModified", property_uri, values);
      this.trigger(property_uri, values);
    }
    return this;
  };
  function toggleSingleValue (property_uri, value) {
    if (value != undefined) {
      if ( this.hasValue(property_uri, value) ) {
        removeSingleValue.call(this, property_uri, value);
      } else {
        addSingleValue.call(this, property_uri, value);
      }
    }
  }

  /**
   * @method
   * @param {String} property_uri property name
   * @return {this}
   */
  proto$1.clearValue = function (property_uri, silently) {
    if (!this.properties[property_uri] || !this.properties[property_uri].length) {
      return this;
    } else {
      delete this.properties[property_uri];
      this.isSync(false);
      if ( !silently ) {
        var empty = [];
        this.trigger("propertyModified", property_uri, empty);
        this.trigger(property_uri, empty);
      }
    }
    return this;
  };

  /**
   * @method
   * @param {String} id of class to check
   * @return {boolean} is individual rdf:type subclass of requested class
   */
  proto$1.is = function (_class) {
    var self = this;
    if (typeof _class.valueOf() === "string") {
      _class = new IndividualModel$1( _class.valueOf() );
    }
    var types = self.get("rdf:type");
    var is = eval(
      types.map(function (type) {
        return self.hasValue("rdf:type", _class.id);
      }).join("||")
    );
    if (is) {
      return Promise.resolve(is);
    } else {
      return Promise.all(types.map(isSub)).then(function (results) {
        return eval(results.join("||"));
      });
    }

    function isSub(type) {
      if (is) { return is; }
      if (!type.hasValue("rdfs:subClassOf")) {
        return (is = is || false);
      } else if (type.hasValue("rdfs:subClassOf", _class.id)) {
        return (is = is || true);
      } else {
        var types = type.get("rdfs:subClassOf");
        return Promise.all(types.map(isSub)).then(function (results) {
          return eval(results.join("||"));
        });
      }
    }
  };

  /**
   * @method
   * Initialize individual with class specific domain properties and methods
   */
  proto$1.init = function () {
    var self = this;
    var isClass = this.hasValue("rdf:type", "owl:Class") || this.hasValue("rdf:type", "rdfs:Class");
    if ( this.hasValue("v-ui:hasModel") && !isClass ) {
      return this.get("v-ui:hasModel")[0].load()
        .then(function (model) {
          if ( !model.modelFn ) {
            model.modelFn = new Function("veda", model["v-s:script"][0]);
          }
          model.modelFn.call(self, veda);
          return self;
        });
    } else {
      var types_promises = this.get("rdf:type").map( function (type_promise) {
        return type_promise.load();
      });
      return Promise.all( types_promises )
        .then( function (types) {
          var models_promises = [];
          types.map( function (type) {
            if ( type.hasValue("v-ui:hasModel") ) {
              models_promises.push( type.get("v-ui:hasModel")[0].load() );
            }
          });
          return Promise.all( models_promises );
        })
        .then( function (models) {
          models.map(function (model) {
            if ( !model.modelFn ) {
              model.modelFn = new Function("veda", model.get("v-s:script")[0]);
            }
            model.modelFn.call(self, veda);
          });
          return self;
        });
    }
  };

  /**
   * @method
   * Clone individual with different (generated) id
   * @return {IndividualModel} clone of this individual with different id.
   */
  proto$1.clone = function () {
    var cloneProperties = JSON.parse( JSON.stringify(this.properties), Util$1.decimalDatetimeReviver );
    cloneProperties["@"] = Util$1.genUri();
    var clone = new IndividualModel$1(cloneProperties);
    clone.isNew(true);
    clone.isSync(false);
    clone.clearValue("v-s:updateCounter");
    return clone.init();
  };

  /**
   * @method
   * Check whether individual is synchronized with db
   * @return {boolean}
   */
  proto$1.isSync = function (value) {
    return ( typeof value !== "undefined" ? this._.isSync = value : this._.isSync );
  };

  /**
   * @method
   * Check whether individual is new (not saved in db)
   * @return {boolean}
   */
  proto$1.isNew = function (value) {
    return ( typeof value !== "undefined" ? this._.isNew = value : this._.isNew );
  };

  /**
   * @method
   * Check whether individual was loaded from db
   * @return {boolean}
   */
  proto$1.isLoaded = function (value) {
    return ( typeof value !== "undefined" ? this._.isLoaded = value : this._.isLoaded );
  };

  proto$1.isPending = function(operation, value) {
    return ( typeof value !== "undefined" ? this._.pending[operation] = value : this._.pending[operation] );
  };

  proto$1.isLoading = function (value) {
    return this.isPending("load", value);
  };
  proto$1.isSaving = function (value) {
    return this.isPending("save", value);
  };
  proto$1.isResetting = function (value) {
    return this.isPending("reset", value);
  };

  /**
   * @method
   * Serialize to JSON
   * @return {Object} JSON representation of individual.
   */
  proto$1.toJson = function () {
    return this.properties;
  };

  /**
   * @method
   * Serialize to string
   * @return {String} String representation of individual.
   */
  proto$1.toString = function () {
    return this.hasValue("rdfs:label") ? this.get("rdfs:label").map(Util$1.formatValue).join(" ") : this.hasValue("rdf:type") ? this.get("rdf:type")[0].toString() + ": " + this.id : this.id ;
  };

  /**
   * @method
   * Return self
   * @return {Object} self.
   */
  proto$1.valueOf = function () {
    return this.id;
  };

  /**
   * @method
   * Get values for first property chain branch.
   * @param {property_uri, ...} Property chain to get values.
   */
  proto$1.getPropertyChain = function () {
    var args = Array.prototype.slice.call(arguments);
    var property_uri = args.shift();
    return this.load().then(function (self) {
      if ( self.hasValue(property_uri) ) {
        if ( !args.length ) {
          return self[property_uri];
        } else {
          return self.getPropertyChain.apply(self[property_uri][0], args);
        }
      }
      return [];
    }).catch(function (error) {
      console.log(error);
    });
  };

  /**
   * @method
   * Get values for all property chain branches.
   * @param {property_uri, ...} Property chain to get values.
   */
  proto$1.getChainValue = function () {
    var individuals = this;
    if ( !Array.isArray(individuals) ) {
      individuals = [individuals];
    }
    var properties = Array.prototype.slice.call(arguments);
    var property_uri = properties.shift();
    var promises = individuals.map(function (individual) {
      return individual.load();
    });
    return Promise.all(promises).then(function (individuals) {
      var children = individuals.reduce(function (acc, individual) {
        return acc.concat(individual.get(property_uri));
      }, []);
      if ( !properties.length ) {
        return children;
      } else {
        return proto$1.getChainValue.apply(children, properties);
      }
    }).catch(function (error) {
      console.log(error);
      return [];
    });
  };

  /**
   * @method
   * Check value for all property chain branches.
   * @param {property_uri, ..., value} Property chain and a value to check.
   */
  proto$1.hasChainValue = function () {
    var length = arguments.length;
    var sought_value = arguments[length - 1];
    var args = Array.prototype.slice.call(arguments, 0, length - 1);
    return this.getChainValue.apply(this, args).then(function (values) {
      return values.reduce(function (state, value) {
        return state || sought_value.valueOf() == value.valueOf();
      }, false);
    });
  };

  /**
   * @method
   * Prefetch linked objects. Useful for presenting objects with many links.
   * @param {Number} Depth of the object tree to prefetch.
   * @param {allowed_property_uri, ...} Allowed property uri for links. If defined the tree is formed only for allowed properties.
   */
  proto$1.prefetch = function (depth) {
    var allowed_props = [].slice.call(arguments, 1);
    depth = depth || 1;
    return this.load().then(function (self) {
      return prefetch.apply(self, [[], depth, [self.id]].concat(allowed_props) );
    });
  };

  function prefetch(result, depth, uris) {
    var self = this;
    var allowed_props = [].slice.call(arguments, 3);
    uris = Util$1.unique( uris );
    var toGet = uris.filter(function (uri) {
      var cached = veda.cache.get(uri);
      if ( cached && result.indexOf(cached) < 0 ) {
        result.push(cached);
      }
      return !cached;
    });
    return (toGet.length ? Backend.get_individuals(veda.ticket, toGet) : Promise.resolve([])).then(function (got) {
      var nextUris = [];
      got.forEach(function (json) {
        if (json) {
          var individual = new IndividualModel$1(json);
          if ( result.indexOf(individual) < 0 ) {
            result.push(individual);
          }
        }
      });
      if (depth - 1 === 0) { return result; }
      uris.forEach(function (uri) {
        var individual = new IndividualModel$1(uri);
        var data = individual.properties;
        Object.keys(data).forEach( function (key) {
          if ( key === "@" || (allowed_props.length && allowed_props.indexOf(key) < 0) ) { return; }
          data[key].map(function (value) {
            if (value.type === "Uri") {
              nextUris.push(value.data);
            }
          });
        });
      });
      if (!nextUris.length) { return result; }
      return prefetch.apply(self, [result, depth-1, nextUris].concat(allowed_props) );
    });
  }

  // Ontology Model

  var OntologyModel = veda.OntologyModel = OntologyModel$1;

  function OntologyModel$1 () {

    // Singleton pattern
    if (OntologyModel$1.prototype._singletonInstance) {
      return OntologyModel$1.prototype._singletonInstance;
    }

    this.ontology = [];
    this.ontologies = {};
    this.datatypes = {};
    this.classes = {};
    this.properties = {};
    this.specifications = {};
    this.models = {};
    this.classTree = {};
    this.templates = {};

    return OntologyModel$1.prototype._singletonInstance = this.init();
  }
  var proto$2 = OntologyModel$1.prototype;

  proto$2.init = function () {
    var self = this;
    if (typeof window !== "undefined") {
      return Backend.loadFile("/ontology.json")
      .then(function (ontologyJSON) {
        self.ontology = JSON.parse(ontologyJSON);
        return self.processOntology();
      })
      .catch(function (error) {
        console.log("Ontology load error.", error);
        return error;
      });
    } else {
      return Backend.query(veda.ticket, "'rdf:type' == 'owl:Ontology' || 'rdf:type' == 'rdfs:Class' || 'rdf:type' == 'rdf:Property' || 'rdf:type' == 'rdfs:Datatype' || 'rdf:type' == 'v-ui:PropertySpecification' || 'rdf:type' == 'v-ui:ClassModel'")
      .then(function (queryResult) {
        var ontology_uris = queryResult.result;
        return Backend.get_individuals(veda.ticket, ontology_uris);
      })
      .then(function (ontology) {
        self.ontology = ontology;
        console.log("Ontology length:", ontology.length);
        return self.processOntology();
      });
    }
  };

  proto$2.getClassProperties = function (_class_uri) {
    var classTree = this.classTree;
    return Util$1.unique( getProps(_class_uri) );

    function getProps (_class_uri) {
      var _class = classTree[_class_uri];
      var props;
      if (_class) {
        props = _class.properties;
        return [].concat.apply( props, _class.superClasses.map( getProps ) );
      } else {
        return getProps("rdfs:Resource");
      }
    }};

  proto$2.getClassSpecifications = function (_class_uri) {
    var classTree = this.classTree;
    return getSpecs(_class_uri);

    function getSpecs (_class_uri) {
      var _class = classTree[_class_uri];
      var specs;
      if (_class) {
        specs = _class.specifications;
        var superSpecsArray = _class.superClasses.map( getSpecs );
        superSpecsArray.map( function (superSpecs) {
          for (var property_uri in superSpecs) {
            if ( !specs[property_uri] ) {
              specs[property_uri] = superSpecs[property_uri];
            }
          }
        });
      } else {
        specs = getSpecs( "rdfs:Resource" );
      }
      return specs;
    }
  };

  proto$2.getClassTemplate = function (_class_uri) {
    var classTemplates = this.templates[_class_uri];
    if (!classTemplates) return null;
    return classTemplates[0];
  };

  proto$2.processOntology = function () {
    var self = this;
    var ontology = this.ontology;
    var ontologies = this.ontologies;
    var datatypes = this.datatypes;
    var classes = this.classes;
    var properties = this.properties;
    var specifications = this.specifications;
    var classTree = this.classTree;
    var models = this.models;
    var templates = this.templates;

    // Allocate ontology objects
    var ontologyPromises = ontology.map( function (json) {
      if (JSON.stringify(json) === '{"@":""}') { return; }
      return new IndividualModel( json, 1, false ).load();
    });
    return Promise.all(ontologyPromises).then(function (ontology) {
      ontology.forEach( function (individual) {
        if ( !individual ) { return; }
        var type = individual.properties["rdf:type"][0].data;
        var uri = individual.id;

        switch ( type ) {
          case "rdfs:Class" :
          case "owl:Class" :
            classes[uri] = individual;
            break;
          case "rdf:Property" :
          case "owl:DatatypeProperty" :
          case "owl:ObjectProperty" :
          case "owl:OntologyProperty" :
          case "owl:AnnotationProperty" :
            properties[uri] = individual;
            // Initialize individual properties in IndividualModel.prototype
            if ( !IndividualModel.prototype.hasOwnProperty(uri) ) {
              IndividualModel.defineProperty(uri);
            }
            break;
          case "v-ui:PropertySpecification" :
          case "v-ui:DatatypePropertySpecification" :
          case "v-ui:ObjectPropertySpecification" :
            specifications[uri] = individual;
            break;
          case "owl:Ontology" :
            ontologies[uri] = individual;
            break;
          case "rdfs:Datatype" :
            datatypes[uri] = individual;
            break;
          case "v-ui:ClassModel" :
            models[uri] = individual;
            break;
          case "v-ui:TemplateSpecification" :
            var forClass = individual.properties["v-ui:forClass"][0].data;
            if (templates[forClass]) {
              templates[forClass].push(individual);
            } else {
              templates[forClass] = [individual];
            }
            break;
        }
      });

      // Process classes
      Object.keys(classes).forEach( function (uri) {
        var _class = classes[uri];
        // populate classTree
        if ( !classTree[_class.id] ) {
          classTree[_class.id] = {
            superClasses: [],
            properties: [],
            specifications: {}
          };
        }
        // rdfs:Resource is a top level class
        if ( _class.id === "rdfs:Resource" ) { return; }
        // If class is not a subclass of another then make it a subclass of rdfs:Resource
        if ( !_class.hasValue("rdfs:subClassOf") ) {
          _class["rdfs:subClassOf"] = [ classes["rdfs:Resource"] ];
        }
        _class["rdfs:subClassOf"].map( function ( superClass ) {
          classTree[_class.id].superClasses.push( superClass.id );
        });
      });

      // Process properties
      Object.keys(properties).forEach( function (uri) {
        try {
          var property = properties[uri];
          if (!property["rdfs:domain"]) { return; }
          property["rdfs:domain"].map( function ( _class ) {
            classTree[_class.id].properties.push(property.id);
          });
        } catch (err) {
          console.error("Ontology init error, uri = %s", uri, err.name);
        }
      });

      // Process specifications
      Object.keys(specifications).forEach( function (uri) {
        try {
          var spec = specifications[uri];
          if (!spec["v-ui:forClass"]) { return; }
          spec["v-ui:forClass"].map( function ( _class ) {
            spec["v-ui:forProperty"].map( function (prop) {
              classTree[_class.id].specifications[prop.id] = spec.id;
            });
          });
        } catch (err) {
          console.error("Ontology init error, uri = %s", uri, err.name);
        }
      });

      // Process template specifications
      Object.keys(templates).forEach(function (uri) {
        try {
          templates[uri] = templates[uri].sort(function(cur, prev) {
            if (cur.properties["v-s:loadPriority"]) {
              if (prev.properties["v-s:loadPriority"]) {
                return cur.properties["v-s:loadPriority"][0].data - prev.properties["v-s:loadPriority"][0].data;
              } else {
                return -1;
              }
            } else {
              return 1
            }
          }).map(function(templateSpec) {
            return templateSpec.properties["v-ui:defaultTemplate"][0].data;
          });
        } catch (err) {
          console.error("Ontology init error, uri = %s", uri, err.name);
        }
      });

      // Init ontology individuals
      var initPromises = ontology.map( function (individual) {
        if ( !individual ) { return; }
        return individual.init().catch(function (error) {
          console.error("Ontology individual init error, uri = %s", individual.id, error);
        });
      });

      return Promise.all(initPromises).then(function () {
        return self;
      });

    });
  };

  // User Model

  var UserModel = veda.UserModel = UserModel$1;

  function UserModel$1(uri) {

    var self = IndividualModel.call(this, uri);

    return self;

  }
  UserModel$1.prototype = Object.create(IndividualModel.prototype);

  UserModel$1.prototype.constructor = UserModel$1;

  var proto$3 = UserModel$1.prototype;

  proto$3._init = function () {
    var self = this;
    return this.load()
      .then(self.initAspect.bind(self))
      .then(self.initAppointment.bind(self))
      .then(self.initPreferences.bind(self))
      .then(self.initLanguage.bind(self))
      .then(self.save.bind(self));
  };

  proto$3.initAspect = function () {
    var self = this;
    if ( self.hasValue("v-s:hasAspect") ) {
      self.aspect = self["v-s:hasAspect"][0];
      return self.aspect.load();
    } else {
      var aspect_id = self.id + "_aspect";
      return new IndividualModel(aspect_id).load().then(function(loadedAspect) {
        if (loadedAspect.hasValue("rdf:type", "rdfs:Resource")) {
          self.aspect = new IndividualModel(aspect_id);
          self.aspect["rdf:type"] = [ new IndividualModel("v-s:PersonalAspect") ];
          self.aspect["v-s:owner"] = [ self ];
          self.aspect["rdfs:label"] = [ "PersonalAspect_" + self.id ];
          self["v-s:hasAspect"] = [ self.aspect ];
          return self.aspect.save();
        } else {
          self.aspect = loadedAspect;
          self["v-s:hasAspect"] = [ self.aspect ];
          return self.aspect;
        }
      });
    }
  };

  proto$3.initAppointment = function () {
    var self = this;
    if (self.hasValue("v-s:defaultAppointment")) {
      veda.appointment = self["v-s:defaultAppointment"][0];
    } else if (self.hasValue("v-s:hasAppointment")) {
      self["v-s:defaultAppointment"] = [ self["v-s:hasAppointment"][0] ];
      veda.appointment = self["v-s:defaultAppointment"][0];
    } else {
      return veda.appointment = undefined;
    }
    return veda.appointment.load();
  };

  proto$3.initPreferences = function () {
    var self = this;
    if ( self.hasValue("v-ui:hasPreferences") ) {
      self.preferences = self["v-ui:hasPreferences"][0];
      return self.preferences.load();
    } else {
      var preferences_id = self.id + "_pref";
      self.preferences = new IndividualModel(preferences_id);
      self.preferences["v-s:owner"] = [ self ];
      self.preferences["rdf:type"] = [ new IndividualModel("v-ui:Preferences") ];
      self.preferences["rdfs:label"] = [ "Preferences_" + self.id ];
      self["v-ui:hasPreferences"] = [ self.preferences ];
      return self.preferences;
    }
  };

  proto$3.initLanguage = function (preferences) {
    var self = this;
    if ( !preferences.hasValue("v-ui:preferredLanguage") || !preferences.hasValue("v-ui:displayedElements")) {
      var defaultDisplayedElements = 10;
      var defaultLanguage = new IndividualModel("v-ui:RU");
      preferences["v-ui:preferredLanguage"] = [ defaultLanguage ];
      preferences["v-ui:displayedElements"] = [ defaultDisplayedElements ];
      preferences.save();
    }
    preferences.on("v-ui:preferredLanguage", setLanguage);
    preferences.on("v-ui:displayedElements", setDisplayedElements);
    preferences.on("v-ui:preferredLanguage v-ui:displayedElements", updatePreferences);
    setLanguage();
    setDisplayedElements();
    function setLanguage() {
      preferences.language = preferences["v-ui:preferredLanguage"].reduce( function (acc, lang) {
        acc[lang.id.substr(lang.id.indexOf(":") + 1)] = lang;
        return acc;
      }, {});
      veda.trigger("language:changed");
    }
    function setDisplayedElements() {
      preferences.displayedElements = preferences["v-ui:displayedElements"][0] || 10;
    }
    function updatePreferences() {
      if ( self.id !== "cfg:Guest" ) {
        preferences.save();
      }
    }
  };

  // Update service for individuals that were changed on server

  function UpdateService() {

    var self = this;

    // Singleton pattern
    if (UpdateService.prototype._singletonInstance) {
      return UpdateService.prototype._singletonInstance;
    }

    this.list = {};
    var buffer = [];
    var socketDelay = 1000;
    var socketTimeout;
    var reconnectDelayInitial = 2500 + Math.round(Math.random() * 2500); // 2.5 - 5 sec
    var reconnectDelay = reconnectDelayInitial;
    var reconnectDelayFactor = 1.1;
    var reconnectDelayLimit = 5 * 60 * 1000; // 5 min
    var lastPing = Date.now();
    var pingTimeout = 5000;
    var pingInterval;

    return UpdateService.prototype._singletonInstance = initSocket();

    function initSocket() {
      return Backend.reset_individual(veda.ticket, "cfg:ClientUpdateServicePort").then(function (ccusPortCfg) {
        var ccusPort = ccusPortCfg["rdf:value"] && ccusPortCfg["rdf:value"][0].data,
            protocol = location.protocol === "http:" ? "ws:" : "wss:",
            port = ccusPort || ( protocol === "ws:" ? 80 : 443 ),
            address = protocol + "//" + location.hostname + ":" + port + "/ccus",
            socket = new WebSocket(address);

        socket.onopen = openedHandler;
        socket.onclose = closedHandler;
        socket.onerror = errorHandler;
        socket.onmessage = messageHandler;
        socket.receiveMessage = receiveMessage;
        socket.sendMessage = sendMessage;
        self.socket = socket;
        return self;
      });
    }

    function sendMessage (msg) {
      var socket = this;
      if (msg === "=" || msg === "-*" || msg.indexOf("ccus") === 0) {
        if (socket.readyState === 1) {
          socket.send(msg);
          //console.log("client -> server:", msg);
        }
        return;
      }
      buffer.push(msg);
      if ( !socketTimeout ) {
        socketTimeout = setTimeout(function () {
          var message = buffer.join(",");
          if (socket.readyState === 1) {
            socket.send(message);
            //console.log("client -> server:", message);
          }
          buffer = [];
          socketTimeout = undefined;
        }, socketDelay);
      }
    }

    function receiveMessage(msg) {
      //console.log("server -> client:", msg);
      if (msg === "") {
        lastPing = Date.now();
        return;
      }
      var uris = msg.indexOf("=") === 0 ? msg.substr(1) : msg;
      if (uris.length === 0) {
        return;
      }
      uris = uris.split(",");
      for (var i = 0; i < uris.length; i++) {
        try {
          var tmp = uris[i].split("=");
          var uri = tmp[0];
          if ( !uri ) {
            continue;
          }
          var updateCounter = parseInt(tmp[1]);
          var individual = new IndividualModel(uri);
          if ( individual.hasValue("v-s:updateCounter", updateCounter) ) { continue; }
          if (self.list[uri]) {
            self.list[uri].updateCounter = updateCounter;
          }
          if (self.list[uri].action) {
            self.list[uri].action.call(individual, updateCounter); // Call action
          } else if (updateCounter !== 0) {
            individual.reset(); // Default action
          }
        } catch (error) {
          console.log("error: individual update service failed", error);
        }
      }
    }

    function openedHandler(event) {
      reconnectDelay = reconnectDelayInitial;
      console.log("client: websocket opened", event.target.url);
      this.sendMessage("ccus=" + veda.ticket);
      self.restore();
      veda.trigger("ccus-online");

      pingInterval = setInterval(function (that) {
        if (Date.now() - lastPing > 2 * pingTimeout) {
          console.log("client: ping missed, close socket");
          veda.trigger("ccus-offline");
          clearInterval(pingInterval);
          that.close();
          return;
        }
      }, pingTimeout, this);
    }

    function messageHandler(event) {
      var msg = event.data;
      this.receiveMessage(msg);
    }

    function errorHandler(event) {
      console.log("client: ccus error", event);
      this.close();
    }

    function closedHandler(event) {
      reconnectDelay = reconnectDelay < reconnectDelayLimit ? reconnectDelay * reconnectDelayFactor : reconnectDelayLimit ;
      console.log("client: websocket closed", event.target.url, "| re-connect in", reconnectDelay / 1000, "sec");
      setTimeout(initSocket, reconnectDelay);
      veda.trigger("ccus-offline");
      clearInterval(pingInterval);
    }

  }
  var proto$4 = UpdateService.prototype;

  proto$4.subscribe = function (uri, action) {
    var self = this;
    if ( this.list[uri] ) {
      ++this.list[uri].subscribeCounter;
    } else {
      var individual = new IndividualModel(uri);
      individual.load().then(function (individual) {
        var updateCounter = individual.hasValue("v-s:updateCounter") ? individual.get("v-s:updateCounter")[0] : 0;
        self.list[uri] = {
          subscribeCounter: 1,
          updateCounter: updateCounter
        };
        if (action) {
          self.list[uri].action = action;
        }
        self.socket.sendMessage("+" + uri + "=" + updateCounter);
      });
    }
  };

  proto$4.unsubscribe = function (uri) {
    if ( !uri ) {
      this.list = {};
      this.socket.sendMessage("-*");
    } else if ( this.list[uri] && this.list[uri].subscribeCounter > 1) {
      --this.list[uri].subscribeCounter;
    } else {
      delete this.list[uri];
      this.socket.sendMessage("-" + uri);
    }
  };

  proto$4.restore = function () {
    this.socket.sendMessage("-*");
    for (var uri in this.list) {
      this.socket.sendMessage("+" + uri + "=" + this.list[uri].updateCounter);
    }
  };

  // Veda application Model

  function AppModel(manifest) {

    var self = riot.observable(this);

    self.manifest = manifest;
    self.ticket = self.ticket || "";
    self.ontology = {};
    self.cache = {
      limit: 20000,
      count: 0,
      delta: 1000,
      storage: {},
      expire: {},
      get: function (key) {
        return this.storage[key];
      },
      set: function (obj, expires) {
        var that = this;
        var count = this.count;
        var limit = this.limit;
        var delta = this.delta;
        if ( count >= limit ) {
          var keys = Object.keys(this.expire);
          // First key is for ontology objects
          for (var i = 1, key; (key = keys[i]) && (limit - count < delta); i++) {
            this.expire[ key ] = this.expire[ key ].filter(function (obj) {
              if (limit - count >= delta) { return true; }
              delete that.storage[ obj.id ];
              count--;
              return false;
            });
            if (this.expire[key].length === 0) {
              delete this.expire[key];
            }
          }
          this.count = count;
          console.log("veda.cache limit (" + this.limit + " elements) reached, " + this.delta + " removed.");
        }
        var expire_key = typeof expires === "number" ? expires : Date.now();
        obj.expires = expire_key;
        this.storage[ obj.id ] = obj;
        this.expire[ expire_key ] = this.expire[ expire_key ] || [];
        this.expire[ expire_key ].push(obj);
        this.count++;
        if (typeof window !== "undefined" && expire_key !== 1) {
          var updateService = new UpdateService();
          updateService.then(function (updateService) {
            updateService.subscribe(obj.id);
          });
        }
      },
      remove: function (key) {
        var obj = this.storage[key];
        var expires = obj.expires;
        this.expire[expires] = this.expire[expires].filter(function (item) { return item.id !== key });
        if (this.expire[expires].length === 0) {
          delete this.expire[expires];
        }
        this.count--;
        if (typeof window !== "undefined") {
          var updateService = new UpdateService();
          updateService.then(function (updateService) {
            updateService.unsubscribe(key);
          });
        }
        return delete this.storage[key];
      },
      clear: function () {
        this.count = 0;
        this.storage = {};
        this.expire = {};
        if (typeof window !== "undefined") {
          var updateService = new UpdateService();
          updateService.then(function (updateService) {
            updateService.unsubscribe();
          });
        }
      }
    };

    // Load ontology
    self.init = function (user) {
      var ontology = new OntologyModel();
      return ontology.then(function (ontology) {
        self.ontology = ontology;
        self.user = new UserModel(user);
        return self.user._init();
      });
    };

    return self;
  }

  // Codelets

  var Codelet = {};

  veda.Codelet = Codelet;

  Codelet.down_right_and_store = function (process, task)
  {
      return Codelet.change_rights(process, task, [
      {
          "data": "-r--"
      }]);
  };

  Codelet.change_rights = function (process, task, rightset)
  {
      return Codelet.change_rights_actor(process, task, [
      {
          "data": "-r--"
      }], 'actor');
  };

  Codelet.change_rights_actor = function (process, task, rightset, actor, docId, executors)
  {
      try
      {
          var doc_id;
          if (docId) {
              doc_id = docId;
          } else {
              doc_id = process.getInputVariable('docId');
          }
          //print ("@JS change_rights_actor");
          //print ("@JS doc_id=", veda.Util.toJson (doc_id));
          //print ("@JS rightset=", veda.Util.toJson (rightset));
          var allow_set = [];
          if (rightset[0].data.indexOf('r') >= 0)
          {
              allow_set.push("v-s:canRead");
          }
          if (rightset[0].data.indexOf('u') >= 0)
          {
              allow_set.push("v-s:canUpdate");
          }
          if (doc_id)
          {
              //print ("@JS0 actor=", actor);
              //print ("@JS1 process.getLocalVariable (" + actor + ")=", veda.Util.toJson(process.getLocalVariable (actor)));
              //print ("@JS2 process.getExecutor()=", veda.Util.toJson(process.getExecutor()));
              var executorArr;
              if (executors) {
                executorArr = executors;
              } else {
                  executorArr = (process.getLocalVariable(actor)) ? process.getLocalVariable(actor) : process.getExecutor();
                  if (!executorArr) executorArr = task.getInputVariable(actor);
                  if (!executorArr) {
                    try {
                      var length = executorArr.length;
                    } catch (e) {
                      executorArr = [executorArr];
                    }
                  };
              }

              for (var i = 0; i<executorArr.length; i++) {
                var executor = [executorArr[i]];
                print ("@JS3 executor=", veda.Util.toJson(executor));
                var employee = veda.Workflow.get_properties_chain(executor, [
                {
                    $get: 'v-s:employee'
                }], undefined);

                print ("@JS4 employee=", veda.Util.toJson(employee));
                if (employee)
                {
                    var employee_uri = veda.Util.getUri(employee);

                    if (employee_uri) {
                        veda.Util.addRight(ticket, employee_uri, veda.Util.getUri(doc_id), allow_set);
                    } else
                        print("ERR! change_rights_actor: undefined employee_uri, actor=[" + actor + "], executor=" + veda.Util.toJson(executor) + ", doc_id=" + veda.Util.getUri(doc_id) + ", process=" + veda.Util.getUri(process) + ", task=" + veda.Util.getUri(task));
                }

                executor = veda.Workflow.get_properties_chain(executor, [
                {
                    $get: 'v-s:occupation'
                }], executor);

                if (!executor)
                {
                    print("@JS executor undefined, actor=", process.getLocalVariable(actor));
                }

                if (executor)
                {
                    var executor_uri = veda.Util.getUri(executor);
                    if (executor_uri) {
                        veda.Util.addRight(ticket, executor_uri, veda.Util.getUri(doc_id), allow_set);
                    } else
                        print("ERR! change_rights_actor: undefined executor_uri, actor=[" + actor + "], executor=" + veda.Util.toJson(executor) + ", doc_id=" + veda.Util.getUri(doc_id) + ", process=" + veda.Util.getUri(process) + ", task=" + veda.Util.getUri(task));
                }
              }


              //var instanceOf = veda.Util.getUri(process['v-wf:instanceOf']);
              //var net_doc_id = instanceOf + "_" + doc_id[0].data;
              //print("[WORKFLOW]:down_right_and_store, find=", net_doc_id);
          }
          return [veda.Workflow.get_new_variable('right', veda.Util.newStr('acl1'))];
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  Codelet.restore_right = function (task)
  {
      try
      {
          //print("[WORKFLOW]:restore_right, task=", veda.Util.toJson(task));
          //print("[WORKFLOW]:restore_right function RESTORE RIGHT IS NOT IMPLIMENTED");
          var right = task.getInputVariable('originalRights');
          //print("[WORKFLOW]:restore_right ", veda.Util.toJson(right));
          return [veda.Workflow.get_new_variable('result', veda.Util.newStr('Ok'))];

      }
      catch (e)
      {
          print(e.stack);
      }
  };

  Codelet.complete_process = function (ticket, process, _event_id)
  {
      Codelet.change_process_status(ticket, process, 'v-wf:Completed', _event_id);
  };

  Codelet.interrupt_process = function (ticket, process, _event_id)
  {
      Codelet.change_process_status(ticket, process, 'v-wf:Interrupted', _event_id);
  };

  Codelet.change_process_status = function (ticket, process, status, _event_id)
  {
      //print('>>> '+veda.Util.toJson(process));
      var vars = process['v-wf:inVars'];
      if (!vars) return;
      for (var i = 0; i < vars.length; i++)
      {
          var variable = get_individual(process.ticket, vars[i].data);
          if (variable &&
              variable['v-wf:variableName'][0] &&
              variable['v-wf:variableName'][0].data == 'docId')
          {
              var doc = get_individual(ticket, variable['v-wf:variableValue'][0].data);

              if (!doc['v-wf:isProcess'])  return;
              for(var j = 0; j < doc['v-wf:isProcess'].length; j++) {
                //print('>>> '+veda.Util.toJson(doc['v-wf:isProcess'][j].data));
                if (doc['v-wf:isProcess'][j].data == process['@']) {
                  delete doc['v-wf:isProcess'];
                  doc['v-wf:hasStatusWorkflow'] = veda.Util.newUri(status);
                  put_individual(ticket, doc, _event_id);
                }
              }
          }
      }
  };

  Codelet.change_document_workflow_status = function (process, status)
  {
      //status: InProcess, InReworking
      var doc_id = process.getInputVariable('docId');
      //print('$$$$ doc:', veda.Util.toJson(doc_id));
      if (doc_id) {
          var set_in_document = {
              '@': veda.Util.getUri(doc_id)
          };
          set_in_document['v-wf:hasStatusWorkflow'] = veda.Util.newUri(status);

          set_in_individual(process.ticket, set_in_document, _event_id);
      }    return [veda.Workflow.get_new_variable('workflowStatus', veda.Util.newStr(status))];
  };

  Codelet.change_document_status = function (process, status)
  {

      // print ("@JS setStatus=", veda.Util.toJson(process.getInputVariable('setStatus')));
      if ( status ) {
          var setStatus=process.getInputVariable('setStatus');
          if (setStatus && setStatus[0].data == true) {
              var doc_id = process.getInputVariable('docId');
              if (doc_id) {
                  var set_in_document = {
                      '@': veda.Util.getUri(doc_id)
                  };
                  set_in_document['v-s:hasStatus'] = veda.Util.newUri(status);
                  if (status == 'v-s:StatusExecuted') {
                      set_in_document['v-s:dateFact'] = veda.Util.newDate(Date.now());
                  }
                  //print ("@JS set_in_document=", veda.Util.toJson(set_in_document));
                  set_in_individual(process.ticket, set_in_document, _event_id);
              }        }
      }    return [veda.Workflow.get_new_variable('status', veda.Util.newStr(status))];
  };

  Codelet.createPermissionStatement = function(process, stage)
  {
      print("###### Start Codelet.createPermissionStatement ######");
      var docId = process.getInputVariable("docId");
      print("docId:", veda.Util.toJson(docId));
      var subjectAppointmentUri;
      var statementUri;
      if (stage === "rework") {
        subjectAppointmentUri = process.getLocalVariable ('responsible');
        statementUri = docId[0].data + '-pf-rework';
      } else if (stage === "task") {
        subjectAppointmentUri = process.getLocalVariable ('actor');
        statementUri = docId[0].data + '-pf-task';
      }    print("subjectAppointmentUri: ", veda.Util.toJson(subjectAppointmentUri));
      if (subjectAppointmentUri) {
        var subjectAppointment = get_individual(ticket, subjectAppointmentUri[0].data);
        if (subjectAppointment) {
          var permissionStatement= {
            '@' : statementUri,
            'rdf:type': veda.Util.newUri('v-s:PermissionStatement'),
            'v-s:useFilter': veda.Util.newUri('v-s:StatusStarted'),
            'v-s:permissionObject': docId,
            'v-s:permissionSubject': subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation']),
            'v-s:canUpdate': veda.Util.newBool('true')
          };
          print('@@@@@responsible:', veda.Util.toJson(subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation'])));
          put_individual(ticket, permissionStatement, _event_id);
          print("put_individual: ", statementUri);
        } else {
          print('Error create_permission_statement_executor: not found subjectAppointment: ', subjectAppointmentUri);
        }
      } else {
        print("Error create_permission_statement_executor: not found local variable 'responsible'");
      }
      print("###### Finish Codelet.createPermissionStatement ######");
      return veda.Util.newStr(statementUri);
  };

  Codelet.deletePermissionStatement = function(process, stage)
  {
      print("###### Start Codelet.deletePermissionStatement ######");
      var docId = process.getInputVariable("docId");
      print("docId:", veda.Util.toJson(docId));
      var statementUri;
      if (stage === "rework") {
        statementUri = docId[0].data + '-pf-rework';
      } else if (stage === "task") {
        statementUri = docId[0].data + '-pf-task';
      }    var set_in_statement = {
        '@' : statementUri,
        'v-s:deleted': veda.Util.newBool('true')
      };
      set_in_individual(ticket, set_in_statement);
      print("###### Finish Codelet.deletePermissionStatement ######");
      return veda.Util.newStr("empty");
  };

  Codelet.is_exists_net_executor = function (process)
  {
      try
      {
          var res = process.getExecutor() !== undefined;
          return [veda.Workflow.get_new_variable('res', veda.Util.newBool(res))];
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  Codelet.get_type_of_docId = function (task)
  {
      try
      {
          var res = '?';

          if (task)
          {
              var doc_id = task.getInputVariable('docId');
              if (doc_id)
              {
                  var doc = get_individual(task.ticket, doc_id[0].data);

                  if (doc)
                  {
                      res = doc['rdf:type'][0].data;
                  }
              }

          }

          return [veda.Workflow.get_new_variable('res', veda.Util.newUri(res))];
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  Codelet.is_in_docflow_and_set_if_true = function (task)
  {

      // # 322
      //// # 285
      //    return [veda.Workflow.get_new_variable('result', veda.Util.newUri(false))];

      try
      {
          var res = false;
          if (task)
          {
              var doc_id = task.getInputVariable('docId');
              if (doc_id)
              {
                  var forProcess = veda.Util.getUri(task.src_data['v-wf:forProcess']);
                  //print("[Z1Z] := "+veda.Util.toJson(forProcess));
                  var process = get_individual(task.ticket, forProcess);
                  //print("[Z2Z] := "+veda.Util.toJson(process));
                  if (process)
                  {
                      var instanceOf = veda.Util.getUri(process['v-wf:instanceOf']);

                      var net_doc_id = instanceOf + "_" + doc_id[0].data;
                      //print("[WORKFLOW]:is_in_docflow_and_set_if_true, find=", net_doc_id);

                      var in_doc_flow = get_individual(task.ticket, net_doc_id);
                      //print("[Z3Z] := "+veda.Util.toJson(in_doc_flow));

                      //                   if (in_doc_flow)
                      //                   {
                      // # 322
                      //                        res = true;
                      //                        res = false;
                      //
                      //                    }
                      //                    else
                      {
                          var new_doc = {
                              '@': net_doc_id,
                              'rdf:type': [
                              {
                                  data: 'v-wf:Variable',
                                  type: "Uri"
                              }]
                          };
                          put_individual(task.ticket, new_doc, _event_id);

                          var add_to_document = {
                              '@': doc_id[0].data,
                              'v-wf:isProcess': veda.Util.newUri(process['@'])
                          };
                          print('$ add_to_document >>' + veda.Util.toJson(add_to_document));
                          add_to_individual(ticket, add_to_document, _event_id);
                      }
                  }
              }

          }

          return [veda.Workflow.get_new_variable('result', veda.Util.newUri(res))];
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  Codelet.distribution = function (process, task)
  {};

  Codelet.add_value_to_document = function (process, task)
  {
      try
      {
          var src;

          if (task)
          {
              var src_uri = task.getInputVariable('src_uri');
              var name_uri = task.getInputVariable('name_uri');
              var value = task.getInputVariable('value');

              var src;

              if (name_uri && value)
              {
                  src = get_individual(task.ticket, veda.Util.getUri(src_uri));
                  if (src)
                  {
                      name_uri = veda.Util.getUri(name_uri);
                      var ch_value = src[name_uri];

                      if (!ch_value)
                          ch_value = [];

                      for (var key in value)
                          ch_value.push(value[key]);

                      src[name_uri] = ch_value;
                      put_individual(ticket, src, _event_id);
                  }
              }
          }

          return [veda.Workflow.get_new_variable('res', src_uri)];
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  Codelet.set_value_to_document = function (process, task)
  {
      try
      {
          var src;

          if (task)
          {
              var src_uri = task.getInputVariable('src_uri');
              var name_uri = task.getInputVariable('name_uri');
              var value = task.getInputVariable('value');

              var src;

              if (name_uri && value)
              {
                  src = get_individual(task.ticket, veda.Util.getUri(src_uri));
                  if (src)
                  {
                      name_uri = veda.Util.getUri(name_uri);
                      src[name_uri] = value;
                      put_individual(ticket, src, _event_id);
                  }
              }
          }

          return [veda.Workflow.get_new_variable('res', src_uri)];
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  Codelet.create_use_transformation = function (process, task)
  {
      try
      {
          var new_items_uri = [];

          if (task)
          {
              var src_doc_id = task.getInputVariable('src_uri');
              var transform_link = task.getInputVariable('transformation_uri');

              if (transform_link)
              {
                  var transform = get_individual(task.ticket, veda.Util.getUri(transform_link));
                  if (transform)
                  {
                      var document = get_individual(task.ticket, veda.Util.getUri(src_doc_id));
                      if (document)
                      {
                          var new_items = veda.Util.transformation(task.ticket, document, transform, null, null, veda.Util.newUri(process.src_data['@']));
                          for (var i = 0; i < new_items.length; i++)
                          {
                              put_individual(ticket, new_items[i], _event_id);
                              new_items_uri.push(
                              {
                                  data: new_items[i]['@'],
                                  type: "Uri"
                              });
                          }
                      }
                  }

              }
          }

          return [veda.Workflow.get_new_variable('res', new_items_uri)];
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  // скрипт поиска в документе uri > 64
  Codelet.find_long_terms = function (ticket, uri, execute_script)
  {
      var event_id = '';
      var cid = get_from_ght('cid');
      //print ("exist cid=" + cid);
      if (!cid)
      {
          var count_appts = 0;
          var cid = new_uris_consumer();
          put_to_ght('cid', cid);
          print("new cid=" + cid);

          var i_uri = "?";
          while (i_uri)
          {
              i_uri = uris_pop(cid);

              if (i_uri)
              {
                  uris_commit_and_next(cid, true);
                  if (i_uri.length > 63)
                  {
                      var document = get_individual(ticket, i_uri);

                      if (document)
                      {
                          if ( veda.Util.hasValue(document, "rdf:type", {data: "v-s:Appointment", type: "Uri"}) )
                          {
                              var hash = Sha256.hash(i_uri);

                              hash = "d:appt_" + hash.substr(0, 50);
                              put_to_ght(i_uri, hash);
                              count_appts++;
                          }
                      }
                  }
              }
          }

          print("found appointments : " + count_appts);

      }
      else
      {
          var document = get_individual(ticket, uri);

          if (document)
          {
              var is_changed = false;
              for (var key in document)
              {
                  var values = document[key];
                  if (key != '@')
                  {
                      var new_values = [];
                      for (var idx in values)
                      {
                          var value = values[idx];
                          var new_uri = get_from_ght(value.data);
                          if (new_uri)
                          {
                              print("found: value>63," + uri + " " + key + "=" + value.data + " -> " + new_uri);
                              value.data = new_uri;
                              is_changed = true;
                          }

                          new_values.push(value);
                      }

                      if (is_changed == true)
                          document[key] = new_values;
                  }
                  else
                  {
                      if (get_from_ght(values))
                      {
                          var new_uri = get_from_ght(values);
                          if (new_uri)
                          {
                              print("found: uri>63," + values + "(remove) -> " + new_uri);
                              document['@'] = new_uri;
                              put_individual(ticket, document, event_id);
                              remove_individual(ticket, uri, event_id);
                          }
                      }
                  }
              }

              if (is_changed == true)
              {
                  put_individual(ticket, document, event_id);
              }
          }

      }
  };

  // скрипт переименования онтологии
  Codelet.onto_rename = function (ticket, document, execute_script)
  {
      //    print ('$$$$$$$$$$$$$$ script_onto_rename:doc= ' + document['@']);
      try
      {
          //print ('$ script_onto_rename:execute_script= ' + veda.Util.toJson (execute_script));
          if (document['@'] === execute_script['@'])
              return;

          var args_uris = execute_script['v-s:argument'];
          var args = veda.Util.loadVariablesUseField(ticket, args_uris);

          for (var idx in args_uris)
          {
              var arg_uri = args_uris[idx].data;
              if (arg_uri === document['@'])
                  return;
          }

          var rename_template = args["rename_template"];
          var is_update = false;
          var is_replace = false;
          var prev_doc_uri = document['@'];
          var prev_doc = veda.Util.clone(document);
          var from_2_to = {};

          for (var idx in rename_template)
          {
              var template = rename_template[idx];

              var cc = template.split(',');
              if (!cc || cc.length != 2)
                  continue;

              var from = cc[0];
              var to = cc[1];
              from_2_to[from] = to;

              var from_u = from.replace(':', '_');
              var to_u = to.replace(':', '_');

              if (from_u !== from)
                  from_2_to[from_u] = to_u;
          }

          for (var key in document)
          {
              var values = document[key];
              if (key != '@')
              {
                  for (var from in from_2_to)
                  {
                      if (key === from)
                      {
                          var to = from_2_to[from];
                          document[to] = values;
                          delete document[from];
                      }
                  }

                  for (var idx in values)
                  {
                      var value = values[idx];

                      for (var from in from_2_to)
                      {
                          if (value.type == "Uri" || value.type == "String")
                          {
                              var to = from_2_to[from];
                              var new_str = veda.Util.replace_word(value.data, from, to);
                              if (new_str !== value.data)
                              {
                                  is_update = true;
                                  value.data = new_str;
                              }
                          }
                      }
                  }
              }
              else
              {
                  // replace in uri
                  for (var from in from_2_to)
                  {
                      var to = from_2_to[from];
                      //print ('values=', values, ', from=', from, ', to=', to);
                      var new_str = veda.Util.replace_word(values, from, to);
                      if (new_str !== values)
                      {
                          is_replace = true;
                          document['@'] = new_str;
                      }
                  }
              }
          }

          if (is_replace)
          {
              remove_individual(ticket, prev_doc_uri, "");
              put_individual(ticket, document, "");
              //print('$ script_onto_rename:is_replace, ' + prev_doc['@'] + '->' + document['@']);
          }
          else
          {
              if (is_update)
              {
                  put_individual(ticket, document, "");
                  //print('$ script_onto_rename:is_update, ' + prev_doc['@'] + '->' + document['@']);
                  //            print('$ script_onto_rename:is_update, ' + veda.Util.toJson(prev_doc) + '->' + veda.Util.toJson(document));
              }
          }

          if (is_replace || is_update)
          {
              //            print('$ script_onto_rename:is_update, ' + prev_doc['@'] + '->' + document['@']);
              //                        print('$ script_onto_rename:is_update, ' + veda.Util.toJson(prev_doc) + '->' + veda.Util.toJson(document));
          }


      }
      catch (e)
      {
          if (typeof window === "undefined")
          {
              print(e.stack);
          }
          else
          {
              console.log(e.stack);
          }
      }
  };

  // Workflow engine

  var Workflow = veda.Workflow || {};

  veda.Workflow = Workflow;

  /*
   *   обработка формы решения пользователя
   */
  Workflow.prepare_decision_form = function (ticket, document, prev_state)
  {
      try
      {
          var decision_form = document;

          if (decision_form['sys:source'])
              return;

          var prev_state_decision_form = prev_state;
          var f_prev_takenDecision = null;

          if (prev_state_decision_form)
      f_prev_takenDecision = prev_state_decision_form['v-wf:takenDecision'];

          var f_takenDecision = decision_form['v-wf:takenDecision'];
          if (!f_takenDecision && !f_prev_takenDecision)
              return;

      var enforce_processing = veda.Util.hasValue(decision_form, 'v-wf:enforceProcessing', {data: true, type: "Boolean"});
      if (f_prev_takenDecision && !enforce_processing)
      {
      if (!f_takenDecision)
      {
        veda.Util.set_err_on_indv("attempt clear decision[" + veda.Util.getUri(f_prev_takenDecision) + "], restore previous decision", document, "prepare decision form");
                veda.Util.set_field_to_document ('v-wf:takenDecision', f_prev_takenDecision, decision_form['@']);
      }
      else if (f_takenDecision.length != f_prev_takenDecision.length || veda.Util.getUri(f_takenDecision) != veda.Util.getUri(f_prev_takenDecision))
      {
        veda.Util.set_err_on_indv("attempt set another decision " + veda.Util.toJson (f_takenDecision) + ", restore previous decision", document, "prepare decision form");
                veda.Util.set_field_to_document ('v-wf:takenDecision', f_prev_takenDecision, decision_form['@']);
      }
      return;
      }

          if (decision_form['v-wf:isCompleted'] && decision_form['v-wf:isCompleted'][0].data == true)
              return;

          var f_onWorkOrder = document['v-wf:onWorkOrder'];
          var _work_order = get_individual(ticket, veda.Util.getUri(f_onWorkOrder));
          if (!_work_order)
          {
              veda.Util.set_err_on_indv("WorkOrder[" + veda.Util.getUri(f_onWorkOrder) + "], not found", document, "prepare decision form");
              return;
          }

          var f_executor = _work_order['v-wf:executor'];
          var executor;

          if (f_executor && f_executor.length > 0)
              executor = f_executor[0];

          //print ("@@@executor=", veda.Util.toJson (executor));
          //print("[WORKFLOW][DF1].1");

          var f_forWorkItem = _work_order['v-wf:forWorkItem'];
          var work_item = get_individual(ticket, veda.Util.getUri(f_forWorkItem));
          if (!work_item)
          {
              veda.Util.set_err_on_indv("invalid WorkOrder[" + veda.Util.getUri(f_onWorkOrder) + "], field v-wf:forWorkItem[" + veda.Util.getUri(f_forWorkItem) + "], not found", document, "prepare decision form");
              return;
          }

          var wi_isCompleted = work_item['v-wf:isCompleted'];
          if (wi_isCompleted)
          {
              if (wi_isCompleted[0].data === true)
              {
                  veda.Util.set_err_on_indv("WorkItem[" + veda.Util.getUri(f_forWorkItem) + "], already is completed, skip decision form...", document, "prepare decision form");
                  return;
              }
          }

          var forProcess = work_item['v-wf:forProcess'];
          var forProcess_uri = veda.Util.getUri(forProcess);
          var _process = get_individual(ticket, forProcess_uri);
          if (!_process)
          {
              veda.Util.set_err_on_indv("invalid WorkItem[" + veda.Util.getUri(f_forWorkItem) + "], field v-wf:forProcess[" + veda.Util.getUri(forProcess) + "], not found", document, "prepare decision form");
              return;
          }

          var isStopped = _process['v-wf:isStopped'];
          if (isStopped && isStopped[0].data === true)
              return;

          var trace_journal_uri = Workflow.create_new_trace_subjournal(forProcess_uri, work_item, "prepare_decision_form:" + decision_form['@'], 'v-wf:DecisionFormStarted');

          //print("[WORKFLOW][DF1].2");

          var f_forNetElement = work_item['v-wf:forNetElement'];
          var net_element = get_individual(ticket, veda.Util.getUri(f_forNetElement));
          if (!net_element)
          {
              veda.Util.set_err_on_indv("invalid WorkItem[" + veda.Util.getUri(f_forWorkItem) + "], field v-wf:forNetElement[" + veda.Util.getUri(f_forNetElement) + "], not found", document, "prepare decision form");
              return;
          }

          //print("[WORKFLOW][DF1].3");

          var transform_link = veda.Util.getUri(net_element['v-wf:completeDecisionTransform']);
          if (!transform_link)
          {
              veda.Util.set_err_on_indv("invalid net_element[" + veda.Util.getUri(f_forNetElement) + "], field v-wf:completeDecisionTransform[" + transform_link + "], not found", document, "prepare decision form");
              return;
          }

          var transform = get_individual(ticket, transform_link);
          if (!transform)
          {
              veda.Util.set_err_on_indv("invalid net_element[" + veda.Util.getUri(f_forNetElement) + "], field v-wf:completeDecisionTransform[" + transform_link + "], not found", document, "prepare decision form");
              return;
          }

          //print("[WORKFLOW][DF1].4 document=", veda.Util.toJson(document));
          //print("[WORKFLOW][DF1].4 transform=", veda.Util.toJson(transform));
          //print("[WORKFLOW][DF1].4 _work_order=", veda.Util.toJson(_work_order));

          var process_output_vars = veda.Util.transformation(ticket, decision_form, transform, executor, f_onWorkOrder, forProcess);

          //print("[WORKFLOW][DF1].5 transform_result=", veda.Util.toJson(process_output_vars));
          var new_vars = Workflow.store_items_and_set_minimal_rights(ticket, process_output_vars);

          if (process_output_vars.length > 0)
          {
              veda.Util.set_field_to_document ('v-wf:outVars', new_vars, _work_order['@']);
              _work_order['v-wf:outVars'] = new_vars;

              veda.Util.set_field_to_document ('v-wf:isCompleted', veda.Util.newBool(true), document['@']);

              //print("[WORKFLOW][DF1].5 completedExecutorJournalMap");
              Workflow.mapToJournal(net_element['v-wf:completedExecutorJournalMap'], ticket, _process, work_item, _work_order, null, veda.Util.getJournalUri(_work_order['@']));
              //print("[WORKFLOW][DF1].6 completedExecutorJournalMap");
          }
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  /*
   *   обработка рабочего задания
   */
  Workflow.prepare_work_order = function (ticket, document)
  {
      try
      {
          var _work_order = document;

          var f_executor = document['v-wf:executor'];
          var executor = get_individual(ticket, veda.Util.getUri(f_executor));
          if (f_executor && !executor) return;

          var f_forWorkItem = veda.Util.getUri(document['v-wf:forWorkItem']);
          var work_item = get_individual(ticket, f_forWorkItem);
          if (!work_item) return;

          var forProcess = work_item['v-wf:forProcess'];
          var forProcess_uri = veda.Util.getUri(forProcess);
          var _process = get_individual(ticket, forProcess_uri);
          if (!_process) return;

          var isStopped = _process['v-wf:isStopped'];
          if (isStopped && isStopped[0].data === true)
              return;

          var trace_journal_uri = Workflow.create_new_trace_subjournal(f_forWorkItem, _work_order, "prepare_work_order:" + _work_order['@'], 'v-wf:WorkOrderStarted');
          if (trace_journal_uri)
              veda.Util.traceToJournal(ticket, trace_journal_uri, "обработка рабочего задания", veda.Util.toJson(document));

          var journal_uri;

          var f_inVars = work_item['v-wf:inVars'];
          if (!f_inVars)
              f_inVars = [];

          var f_process_inVars = _process['v-wf:inVars'];

          var forNetElement = work_item['v-wf:forNetElement'];
          var net_element = get_individual(ticket, veda.Util.getUri(forNetElement));
          if (!net_element) return;

          //    print ("[WORKFLOW] #1 net_element.uri=", net_element['@'], ", work_order=", veda.Util.toJson (_work_order));

          var f_local_outVars = document['v-wf:outVars'];
          var task_output_vars = [];

          var f_useSubNet = document['v-wf:useSubNet'];

          if (!f_local_outVars)
          {
              //      print ("[WORKFLOW] #2 net_element.uri=", net_element['@']);
              journal_uri = Workflow.create_new_subjournal(f_forWorkItem, _work_order['@'], net_element['rdfs:label'], 'v-wf:WorkOrderStarted');

              if (!executor)
              {
                  Workflow.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');
              }

              // берем только необработанные рабочие задания
              if (!executor)
              {
                  //print("[WORKFLOW][WO.2] executor not defined");

                  if (!net_element['v-wf:completedMapping'])
                  {
                      //print("[WORKFLOW][WO W6] v-wf:completedMapping not defined=", net_element['@']);
                      task_output_vars.push(
                      {
                          data: 'v-wf:complete',
                          type: "Uri"
                      });
                  }
                  else
                  {
                      // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                      task_output_vars = Workflow.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, null, true, trace_journal_uri, 'v-wf:completedMapping');
                      //print("[PWO].completedMapping1, task_output_vars=", veda.Util.toJson(task_output_vars));
                  }

                  if (task_output_vars.length == 0)
                  {
                      task_output_vars.push(
                      {
                          data: 'v-wf:complete',
                          type: "Uri"
                      });
                  }
                  else
                  {
                      //Workflow.mapToJournal(net_element['v-wf:completedJournalMap'], ticket, _process, work_item);
                  }

                  if (task_output_vars.length > 0)
                  {
                      document['v-wf:outVars'] = task_output_vars;
                      put_individual(ticket, document, _event_id);
                  }
              }
              else
              {
                  var is_appointment = veda.Util.hasValue(executor, "rdf:type", {data: "v-s:Appointment", type: "Uri"});
                  var is_position = veda.Util.hasValue(executor, "rdf:type", {data: "v-s:Position", type: "Uri"});
                  var is_codelet = veda.Util.hasValue(executor, "rdf:type", {data: "v-s:Codelet", type: "Uri"});

                  if (is_codelet)
                  {
                      Workflow.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');

                      //print("[WORKFLOW][WO1.2] executor=" + veda.Util.getUri(f_executor) + ", is codelet");

                      var expression = veda.Util.getFirstValue(executor['v-s:script']);
                      if (!expression) return;

                      //print("[WORKFLOW][WO1.3] expression=" + expression);

                      var task = new Workflow.Context(work_item, ticket);
                      var process = new Workflow.Context(_process, ticket);
                      var codelet_output_vars = eval(expression);
                      if (codelet_output_vars && codelet_output_vars.length > 0)
                      {
                          var localVariablesUri = Workflow.store_items_and_set_minimal_rights(ticket, codelet_output_vars);
                          _work_order['v-wf:outVars'] = localVariablesUri;
                          put_individual(ticket, _work_order, _event_id);
                      }
                      /*
                                     //print("[WORKFLOW][WO1.4] task: eval result=", veda.Util.toJson(result0));
                                      //print ("#2");
                                      //Workflow.mapToJournal (net_element['v-wf:completedJournalMap'], ticket, _process, work_item);

                                      if (!net_element['v-wf:completedMapping'])
                                      {
                                         //print("[WORKFLOW][WO W6] v-wf:completedMapping not defined=", net_element['@']);
                                          task_output_vars.push(
                                          {
                                              data: 'v-wf:complete',
                                              type: "Uri"
                                          });
                                      }
                                      else
                                      {
                                     veda.Util.getValues(netElement['rdfs:label'])     // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                                          task_output_vars = Workflow.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, result0, true, trace_journal_uri, 'v-wf:completedMapping');
                                          print("[PWO]completedMapping2, task_output_vars=", veda.Util.toJson(task_output_vars));
                                      }

                                      if (task_output_vars.length > 0)
                                      {
                                          document['v-wf:outVars'] = task_output_vars;
                                          put_individual(ticket, document, _event_id);
                                      }
                      */

                  } // end [is codelet]
                  else if ((is_appointment || is_position) && !f_useSubNet)
                  {
                      //print("[WORKFLOW][WO2] is USER, executor=" + veda.Util.getUri(f_executor));
                      //           //print("work_item.inVars=", veda.Util.toJson(f_inVars));
                      //           //print("process.inVars=", veda.Util.toJson(f_process_inVars));

                      var work_item_inVars = [];
                      for (var i = 0; i < f_inVars.length; i++)
                      {
                          var indv = get_individual(ticket, f_inVars[i].data);
                          work_item_inVars.push(indv);
                      }

                      var prev_task;
                      var i_work_item = work_item;

                      while (!prev_task)
                      {
                          var previousWorkItem_uri = veda.Util.getUri(i_work_item['v-wf:previousWorkItem']);
                          if (!previousWorkItem_uri)
                              break;

                          var previous_work_item = get_individual(ticket, previousWorkItem_uri);
                          if (!previous_work_item)
                              break;

                          var prev_forNetElement_uri = veda.Util.getUri(previous_work_item['v-wf:forNetElement']);
                          if (!prev_forNetElement_uri)
                              break;

                          var prev_forNetElement = get_individual(ticket, prev_forNetElement_uri);
                          if (!prev_forNetElement)
                              break;

                          if (prev_forNetElement['rdf:type'][0].data == 'v-wf:Task')
                          {
                              prev_task = previous_work_item['v-wf:forNetElement'];
                              break;
                          }
                          i_work_item = previous_work_item;
                      }

                      // ? или сделать curTask и prevTask только для трансформации ?
                      // ++ work_item_inVars: cur task id
                      var var_ctid = {
                          '@': '-',
                          'rdf:type': [
                          {
                              data: 'v-wf:Variable',
                              type: "Uri"
                          }],
                          'v-wf:variableName': [
                          {
                              data: "curTask",
                              type: "String"
                          }],
                          'v-wf:variableValue': forNetElement
                      };
                      work_item_inVars.push(var_ctid);

                      if (prev_task)
                      {
                          // ++ work_item_inVars: prev task id
                          var_ctid = {
                              '@': '-',
                              'rdf:type': [
                              {
                                  data: 'v-wf:Variable',
                                  type: "Uri"
                              }],
                              'v-wf:variableName': [
                              {
                                  data: "prevTask",
                                  type: "String"
                              }],
                              'v-wf:variableValue': prev_task
                          };
                          work_item_inVars.push(var_ctid);
                      }

                      //print("[WORKFLOW][WO2.0] transform_link=" + veda.Util.toJson(net_element['v-wf:startDecisionTransform']));
                      //print("[WORKFLOW][WO2.1] work_item_inVars=" + veda.Util.toJson(work_item_inVars));
                      //print ("@@@1 net_element['v-wf:startingExecutorJournalMap']=", veda.Util.toJson (net_element['v-wf:startingExecutorJournalMap']), ", @=", net_element['@']));
                      Workflow.mapToJournal(net_element['v-wf:startingExecutorJournalMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingExecutorJournalMap');

                      var transform_link = veda.Util.getUri(net_element['v-wf:startDecisionTransform']);
                      if (!transform_link) return;
                      var transform = get_individual(ticket, transform_link);
                      if (!transform) return;

                      var transform_result = veda.Util.transformation(ticket, work_item_inVars, transform, f_executor, veda.Util.newUri(document['@']), forProcess);

                      if (trace_journal_uri)
                          veda.Util.traceToJournal(ticket, trace_journal_uri, "v-wf:startDecisionTransform", "transform_result=" + veda.Util.toJson(transform_result));

                      var decisionFormList = [];

                      if (transform_result)
                      {
                          for (var i = 0; i < transform_result.length; i++)
                          {
                              if (transform_result[i]['v-s:created'] == undefined)
                                  transform_result[i]['v-s:created'] = veda.Util.newDate(new Date());
                              else
                                  transform_result[i]['v-s:edited'] = veda.Util.newDate(new Date());

                              if (transform_result[i]['v-s:creator'] == undefined)
                                  transform_result[i]['v-s:creator'] = veda.Util.newUri('cfg:VedaSystem');

                              put_individual(ticket, transform_result[i], _event_id);
                              decisionFormList.push(
                              {
                                  data: transform_result[i]['@'],
                                  type: "Uri"
                              });

                              // выдадим права отвечающему на эту форму
                              if (is_appointment)
                              {
                                  //print("[WORKFLOW][WO2.2] appointment=" + veda.Util.toJson(executor));
                                  var employee = executor['v-s:employee'];
                                  if (employee)
                                  {
                                      //print("[WORKFLOW][WO2.2] employee=" + veda.Util.toJson(employee));
                                      veda.Util.addRight(ticket, employee[0].data, transform_result[i]['@'], ["v-s:canRead", "v-s:canUpdate"]);
                                  }
                                  var position = executor['v-s:occupation'];
                                  if (position)
                                  {
                                      //print("[WORKFLOW][WO2.2] position=" + veda.Util.toJson(position));
                                      veda.Util.addRight(ticket, position[0].data, transform_result[i]['@'], ["v-s:canRead", "v-s:canUpdate"]);
                                  }
                              }
                              if (is_position)
                              {
                                  veda.Util.addRight(ticket, executor['@'], transform_result[i]['@'], ["v-s:canRead", "v-s:canUpdate"]);
                              }
                          }
                      }

                      var add_to_document = {
                          '@': document['@'],
                          'v-wf:decisionFormList': decisionFormList
                      };
                      add_to_individual(ticket, add_to_document, _event_id);
                      _work_order['v-wf:decisionFormList'] = decisionFormList;

                      Workflow.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');
                  }

                  if ( (veda.Util.hasValue(executor, "rdf:type", {data: "v-wf:Net", type: "Uri"}) || f_useSubNet) && !is_codelet )
                  {
                      Workflow.create_new_subprocess(ticket, f_useSubNet, f_executor, net_element, f_inVars, document, trace_journal_uri);

                      //print("[WORKFLOW][WO21-1]");
                  }
              }
          }

          var is_goto_to_next_task = false;

          // begin //////////////// скрипт сборки результатов (WorkOrder) ///////////////////////////////////////////
          var work_item_result = [];

          // найдем маппинг множественных результатов
          var wosResultsMapping = net_element['v-wf:wosResultsMapping'];

          var workOrderList = work_item['v-wf:workOrderList'];
          // проверяем есть ли результаты рабочих заданий
          if (workOrderList)
          {
              for (var i = 0; i < workOrderList.length; i++)
              {
                  //print("[WORKFLOW][WO3.0] workOrder=" + veda.Util.toJson(workOrderList[i]) + "");
                  var workOrder;
                  if (workOrderList[i].data != document['@'])
                      workOrder = get_individual(ticket, workOrderList[i].data);
                  else
                      workOrder = document;

                  //print("[WORKFLOW][WO3.1] workOrder=" + veda.Util.toJson(workOrder) + "");

                  var outVars = workOrder['v-wf:outVars'];
                  if (outVars)
                  {
                      var el = {};
                      el['workOrder'] = workOrder['@'];

                      var f_set = false;
                      for (var i1 = 0; i1 < outVars.length; i1++)
                      {
                          var _result = get_individual(ticket, outVars[i1].data);
                          //print("[WORKFLOW][WO3.2] _result=" + veda.Util.toJson(_result) + "");
                          if (_result)
                          {
                              if (wosResultsMapping)
                              {
                                  // wosResultsMapping указан
                              }
                              else
                              {
                                  // складываем все результаты в локальную переменную
                                  var key, val;
                                  var varName = _result["v-wf:variableName"];
                                  if (varName)
                                      key = varName[0].data;

                                  var varValue = _result["v-wf:variableValue"];
                                  if (varValue)
                                      val = varValue;

                                  if ( /*val !== undefined &&*/ key !== undefined)
                                  {
                                      el[key] = val;
                                      f_set = true;
                                  }
                                  //print("[WORKFLOW][WO3.3] el=" + veda.Util.toJson(el) + "");
                              }
                          }
                      }
                      if (f_set) work_item_result.push(el);

                  }

              }
          }
          if (work_item_result.length == workOrderList.length)
              is_goto_to_next_task = true;
          else
          {
              if (trace_journal_uri)
                  veda.Util.traceToJournal(ticket, trace_journal_uri, "[WO4.0] не все задания выполнены", "stop. work_item_result" + veda.Util.toJson(work_item_result) + ", workOrderList=", veda.Util.toJson(workOrderList));
          }

          // end //////////////// скрипт сборки результатов
          if (trace_journal_uri)
              veda.Util.traceToJournal(ticket, trace_journal_uri, "[WO4] work_item_result", veda.Util.toJson(work_item_result));

          var workItemList = [];

          if (is_goto_to_next_task)
          {
              journal_uri = veda.Util.getJournalUri(_work_order['@']);


              // переход к новой задаче  prepare[[wo][wo][wo]] ----> new [wi]

              if (work_item_result.length > 0)
              {
                  if (work_item_result[0]['complete'])
                  {
                      // если было пустое задание, то не журналируем
                  }
                  else
                  {
                      //print("[WORKFLOW][WO4.0.0] completedJournalMap");
                      Workflow.mapToJournal(net_element['v-wf:completedJournalMap'], ticket, _process, work_item, null, net_element['rdfs:label'], journal_uri);
                  }
              }

              //print("[WORKFLOW][WO4.1] is_goto_to_next_task == true");
              if (net_element['v-wf:completedMapping'])
              {
                  // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                  task_output_vars = Workflow.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, work_item_result, true, trace_journal_uri, 'v-wf:completedMapping');
              }

              //            if (task_output_vars.length > 0)
              //            {
              //                document['v-wf:outVars'] = task_output_vars;
              //                put_individual(ticket, document, _event_id);
              //            }

              // определим переход на следующие задачи в зависимости от результата
              // res должен быть использован при eval каждого из предикатов
              var hasFlows = net_element['v-wf:hasFlow'];
              if (hasFlows)
              {
                  //print("[WORKFLOW][WO4.4]");
                  var split = veda.Util.getUri(net_element['v-wf:split']);

                  for (var i = 0; i < hasFlows.length; i++)
                  {
                      var flow = get_individual(ticket, hasFlows[i].data);
                      if (!flow) continue;

                      //print("[WORKFLOW][WO6]:Flow: " + flow['@']);

                      var flowsInto = flow['v-wf:flowsInto'];
                      if (!flowsInto) continue;

                      var predicate = flow['v-wf:predicate'];
                      if (predicate)
                      {
                          //print("[WORKFLOW][WO8] predicate=" + veda.Util.toJson(predicate));
                          expression = veda.Util.getFirstValue(predicate);
                          //print("[WORKFLOW][WO8.1] work_item_result=" + veda.Util.toJson(work_item_result));
                          //print("[WORKFLOW][WO9] expression=" + veda.Util.toJson(expression));
                          if (expression)
                          {
                              try
                              {
                                  var task_result = new Workflow.WorkItemResult(work_item_result);
                                  var task = new Workflow.Context(work_item, ticket);
                                  var process = new Workflow.Context(_process, ticket);
                                  var res1 = eval(expression);

                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "in flow expression", veda.Util.toJson(expression) + ", res =" + veda.Util.toJson(res1));

                                  if (res1 === true)
                                  {
                                      // выполним переход по XOR условию
                                      var nextNetElement = get_individual(ticket, veda.Util.getUri(flowsInto));

                                      if (nextNetElement)
                                      {
                                          //print("[WORKFLOW][WO10] create next work item for =" + nextNetElement['@']);
                                          var work_item_uri = Workflow.create_work_item(ticket, forProcess_uri, nextNetElement['@'], work_item['@'], _event_id, trace_journal_uri);
                                          workItemList.push(
                                          {
                                              data: work_item_uri,
                                              type: "Uri"
                                          });
                                      }

                                      if (split == 'v-wf:XOR')
                                          break;
                                  }
                              }
                              catch (e)
                              {
                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "in flow expression", veda.Util.toJson(expression) + ", ", veda.Util.toJson(e.stack));

                                  print(e.stack);
                              }
                          }
                      }
                      else
                      {
                          if (!split || split == 'v-wf:None')
                          {
                              // условия нет, выполним переход
                              var nextNetElement = get_individual(ticket, veda.Util.getUri(flowsInto));

                              if (nextNetElement)
                              {
                                  //print("[WORKFLOW][WO11] create next work item for =" + nextNetElement['@']);
                                  var work_item_uri = Workflow.create_work_item(ticket, forProcess_uri, nextNetElement['@'], work_item['@'], _event_id, trace_journal_uri);
                                  workItemList.push(
                                  {
                                      data: work_item_uri,
                                      type: "Uri"
                                  });
                              }
                          }


                      }

                  }
                  // }
              }

              work_item['v-wf:isCompleted'] = [
              {
                  data: true,
                  type: "Boolean"
              }];

              if (workItemList.length > 0)
                  work_item['v-wf:workItemList'] = workItemList;

              if (task_output_vars.length > 0)
                  work_item['v-wf:outVars'] = task_output_vars;

              put_individual(ticket, work_item, _event_id);
              //print("[WORKFLOW][WOe] update work_item=", veda.Util.toJson(work_item));

              Workflow.remove_empty_branches_from_journal(journal_uri);
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /*
   *   обработка элемента сети
   *      1. слияние
   *      2. вычисление количества исполнителей, подготовка для них данных, запуск.
   *      3. обработка результатов, ветвление
   */
  Workflow.prepare_work_item = function (ticket, document)
  {
      var work_item = document;

      try
      {
          var forProcess = veda.Util.getUri(work_item['v-wf:forProcess']);
          var _process = get_individual(ticket, forProcess);
          if (!_process) return;

          var instanceOf = veda.Util.getUri(_process['v-wf:instanceOf']);
          var _net = get_individual(ticket, instanceOf);
          if (!_net) return;

          var forNetElement = document['v-wf:forNetElement'];
          var netElement = get_individual(ticket, veda.Util.getUri(forNetElement));
          if (!netElement) return;

          var trace_journal_uri;

          var isCompleted = document['v-wf:isCompleted'];
          if (isCompleted)
          {
              if (isCompleted[0].data === true)
              {
                trace_journal_uri = Workflow.get_trace_journal(document, _process);
                  if (trace_journal_uri)
                      veda.Util.traceToJournal(ticket, trace_journal_uri, "prepare_work_item:completed, exit", work_item['@']);

                  Workflow.remove_empty_branches_from_journal(veda.Util.getJournalUri(work_item['@']));

                  return;
              }
          }

          trace_journal_uri = Workflow.create_new_trace_subjournal(forProcess, work_item, netElement['@'] + "' - [" + veda.Util.getValues(netElement['rdfs:label']) + "] - " + work_item['@'], 'v-wf:WorkItemStarted');

          var f_join = netElement['v-wf:join'];
          if (f_join && veda.Util.getUri(f_join) == "v-wf:AND")
          {
              var in_flows = [];
              var task2flow = {};
              // найдем все flow входящие в эту задачу
              //  обойдем все элементы сети, если это flow и идет к текущей задаче, то берем
              var f_consistsOf = _net['v-wf:consistsOf'];
              if (f_consistsOf)
              {
                  for (var i = 0; i < f_consistsOf.length; i++)
                  {
                      var i_net_element = get_individual(ticket, f_consistsOf[i].data);
                      if (!i_net_element) continue;

                      if ( veda.Util.hasValue(i_net_element, "rdf:type", {data: "v-wf:Flow", type: "Uri"}) )
                      {
                          if (veda.Util.getUri(i_net_element["v-wf:flowsInto"]) == netElement['@'])
                          {
                              in_flows.push(i_net_element);
                              //print("[WORKFLOW][PW00.2] flow=", veda.Util.toJson (i_net_element));
                          }
                      }
                      else if ( veda.Util.hasValue(i_net_element, "rdf:type", {data: "v-wf:Task", type: "Uri"}) )
                      {
                          var f_hasFlow = i_net_element['v-wf:hasFlow'];
                          if (f_hasFlow)
                          {
                              for (var idx1 = 0; idx1 < f_hasFlow.length; idx1++)
                              {
                                  task2flow[f_hasFlow[idx1].data] = i_net_element['@'];
                              }
                          }
                      }
                  }
              }

              // нужно обойти все дерево и найти незавершенные WorkItem соответсвующие текущей net_element
              var fne = Workflow.find_in_work_item_tree(ticket, _process, 'v-wf:forNetElement', veda.Util.getUri(forNetElement));
              if (fne.length > in_flows.length)
              {
                  print('ERR! AND join: check v-wf:consistsOf in net[' + instanceOf + '] for net element [' + veda.Util.getUri(forNetElement) + ']');
              }

              if (fne.length != in_flows.length)
                  return;

              // проверим соответствие найденных WorkItem со схемой
              var and_join_count_complete = 0;
              var isExecuted;

              for (var idx = 0; idx < in_flows.length; idx++)
              {
                  var shema_out_task = task2flow[in_flows[idx]['@']];
                  for (var idx1 = 0; idx1 < fne.length; idx1++)
                  {
                      var found_out_task = veda.Util.getUri(fne[idx1].parent['v-wf:forNetElement']);
                      isExecuted = fne[idx1].work_item['v-s:isExecuted'];
                      //print ("[WORKFLOW] found_out_task=", veda.Util.toJson (fne[idx1].work_item));
                      if (isExecuted)
                      {
                          // встретился уже выполняемый work_item, по этой задаче, остальные отбрасываем
                          return;
                      }

                      if (shema_out_task == found_out_task)
                      {
                          and_join_count_complete++;
                          break;
                      }
                  }
              }

              //print ("[WORKFLOW] and_join_count_complete=", and_join_count_complete, ", in_flows.length=", in_flows.length);

              if (and_join_count_complete != in_flows.length)
                  return;

              //print ("[WORKFLOW] prepare_work_item uri=", document['@']);
              //print ("[WORKFLOW] and join is complete and_join_count_complete=", and_join_count_complete);
          }

          document['v-s:isExecuted'] = veda.Util.newBool(true);
          put_individual(ticket, document, _event_id);
          //print ("[WORKFLOW] UPDATE document=", veda.Util.toJson (document));

          var is_completed = false;
          var workItemList = [];

          var is_goto_to_next_task = false;
          var task_output_vars = [];

          var journal_uri;

          if ( veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:Task", type: "Uri"}) )
          {
              journal_uri = Workflow.create_new_subjournal(forProcess, work_item['@'], netElement['rdfs:label'], 'v-wf:WorkItemStarted');

              if (trace_journal_uri)
                  veda.Util.traceToJournal(ticket, trace_journal_uri, "Is task");

              //* выполнить стартовый маппинг переменных
              var work_item__inVars = [];
              if (netElement['v-wf:startingMapping'])
              {
                  work_item__inVars = Workflow.create_and_mapping_variables(ticket, netElement['v-wf:startingMapping'], _process, document, null, null, true, trace_journal_uri, 'v-wf:startingMapping');
                  if (work_item__inVars.length > 0)
                      document['v-wf:inVars'] = work_item__inVars;

                  //var ctx = new Workflow.Context(document, ticket);
                  //ctx.print_variables('v-wf:inVars');
              }

              //* сформировать список исполнителей
              var executor_list = [];

              var f_subNet = netElement['v-wf:subNet'];
              var f_executor = netElement['v-wf:executor'];
              if (f_executor)
              {
                  for (var i = 0; i < f_executor.length; i++)
                  {
                      var executor = get_individual(ticket, f_executor[i].data);

                      if (!executor)
                      {
                          if (trace_journal_uri)
                              veda.Util.traceToJournal(ticket, trace_journal_uri, "исполнитель не найден", " uri=[" + f_executor[i].data + "]");
                      }
                      else
                      {
                          if ( veda.Util.hasValue(executor, "rdf:type", {data: "v-wf:ExecutorDefinition", type: "Uri"}) )
                          {
                              // определение исполнителей посредством скрипта

                              var expression = veda.Util.getFirstValue(executor['v-wf:executorExpression']);
                              if (!expression) return;

                              var task = new Workflow.Context(document, ticket);
                              var process = new Workflow.Context(_process, ticket);

                              try
                              {
                                  var result = eval(expression);

                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "определение исполнителя [" + expression + "]", "executors=" + veda.Util.toJson(result));

                                  if (result !== undefined && result.length > 0)
                                  {
                                      for (var i3 = 0; i3 < result.length; i3++)
                                      {
                                          // проверим, существует ли данный executor, если да, то добавим в список

                                          var real_executor = get_individual(ticket, result[i3].data);

                                          if (real_executor)
                                              executor_list.push(result[i3]);
                                      }
                                  }
                              }
                              catch (e)
                              {
                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "исполнители не были определены [" + expression + "]", e.stack);
                              }

                          }
                          else
                          {
                              if (trace_journal_uri)
                                  veda.Util.traceToJournal(ticket, trace_journal_uri, "установлен исполнитель ", "executor=" + veda.Util.toJson(f_executor[i].data));

                              executor_list.push(f_executor[i]);
                          }
                      }
                  }
              }
              else
              {
                  if (f_subNet)
                      executor_list.push(f_subNet[0]);
              }

              //* если не найдено ни одного исполнителя, то добавим null,
              //*   как индикатор для создания проходного(пустого) задания
              if (executor_list.length == 0)
                  executor_list.push(null);
              else
              {
                  Workflow.mapToJournal(netElement['v-wf:startingJournalMap'], ticket, _process, document, null, netElement['rdfs:label'], journal_uri);
              }

              var work_order_list = [];
              var work_order_uri_list = [];

              //* сформировать задания для исполнителей
              for (var i = 0; i < executor_list.length; i++)
              {
                  var new_work_order_uri = veda.Util.genUri() + "-wo";

                  var new_work_order = {
                      '@': new_work_order_uri,
                      'rdf:type': [
                      {
                          data: 'v-wf:WorkOrder',
                          type: "Uri"
                      }],
                      'v-wf:forWorkItem': [
                      {
                          data: document['@'],
                          type: "Uri"
                      }]
                  };

                  if (f_subNet)
                      new_work_order['v-wf:useSubNet'] = f_subNet;

                  if (trace_journal_uri)
                      new_work_order['v-wf:isTrace'] = veda.Util.newBool(true);

                  if (executor_list[i] != null)
                      new_work_order['v-wf:executor'] = executor_list[i];

                  //print("[PWI02-1] new order =" + veda.Util.toJson(new_work_order));

                  work_order_list.push(new_work_order);
                  work_order_uri_list.push(
                  {
                      data: new_work_order_uri,
                      type: "Uri"
                  });

              }

              if (work_order_uri_list.length > 0)
                  document['v-wf:workOrderList'] = work_order_uri_list;

              if (work_item__inVars > 0 || work_order_uri_list.length > 0)
                  put_individual(ticket, document, _event_id);

              for (var i = 0; i < work_order_list.length; i++)
              {
                  put_individual(ticket, work_order_list[i], _event_id);
                  //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", work_order_list[i]['@'], ["v-s:canRead"]);
              }

          } // end [Task]
          else if ( veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:InputCondition", type: "Uri"}) || veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:Condition", type: "Uri"}) )
          {
              if (netElement['@'] == 's-wf:InterlayerNet_ic') {
                  var set_in_document = {
                      '@': _process['v-wf:executor'][0].data
                  };
                  set_in_document['v-wf:hasStatusWorkflow'] = veda.Util.newUri('v-wf:IsSent');
                  set_in_individual(ticket, set_in_document, _event_id);
              };
              is_goto_to_next_task = true;
          } // end [InputCondition]
          else if ( veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:OutputCondition", type: "Uri"}) )
          {
              if (trace_journal_uri)
                  veda.Util.traceToJournal(ticket, trace_journal_uri, "Is output condition ", "");

              //var process = new Workflow.Context(_process, ticket);
              //process.print_variables('v-wf:inVars');
              //process.print_variables('v-wf:outVars');

              if (netElement['@'] == 's-wf:InterlayerNet_oc') {
                  var set_in_document = {
                      '@': _process['v-wf:executor'][0].data
                  };
                  set_in_document['v-wf:hasStatusWorkflow'] = veda.Util.newUri('v-wf:Completed');
                  set_in_individual(ticket, set_in_document, _event_id);
              };

              var f_parent_work_order = _process['v-wf:parentWorkOrder'];
              if (f_parent_work_order)
              {
                  var parent_work_order = get_individual(ticket, veda.Util.getUri(f_parent_work_order));
                  if (parent_work_order)
                  {
                      if (!_net['v-wf:completedMapping'])
                      {
                          task_output_vars.push(
                          {
                              data: 'v-wf:complete',
                              type: "Uri"
                          });
                      }
                      else
                      {
                          // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                          task_output_vars = Workflow.create_and_mapping_variables(ticket, _net['v-wf:completedMapping'], _process, work_item, null, null, true, trace_journal_uri, 'v-wf:completedMapping');
                      }

                      if (task_output_vars.length > 0)
                      {
                          parent_work_order['v-wf:outVars'] = task_output_vars;
                          put_individual(ticket, parent_work_order, _event_id);
                      }
                  }
              }


              is_completed = true;
              document['v-wf:isCompleted'] = [
              {
                  data: is_completed,
                  type: "Boolean"
              }];

              var completeProcess = {
                  '@': forProcess,
                  'v-wf:isCompleted': [
                  {
                      data: is_completed,
                      type: "Boolean"
                  }]
              };

              veda.Codelet.complete_process(ticket, _process, _event_id);
              set_in_individual(ticket, completeProcess, _event_id);

          } // end [OutputCondition]

          if (is_goto_to_next_task == true)
          {
              //print(":Is inputCondition or Condition");
              var hasFlows = netElement['v-wf:hasFlow'];
              if (hasFlows)
              {
                  for (var i = 0; i < hasFlows.length; i++)
                  {
                      var flow = get_individual(ticket, hasFlows[i].data);
                      if (!flow) continue;

                      ////print(":Flow: " + flow['@']);

                      var flowsInto = flow['v-wf:flowsInto'];
                      if (!flowsInto) continue;


                      var resultEval = true;
                      try {
                          var predicate = flow['v-wf:predicate'];
        if (predicate) {
                            var expression = veda.Util.getFirstValue(predicate);
                            //var task_result = new Workflow.WorkItemResult(work_item_result);
                            var task = new Workflow.Context(work_item, ticket);
                            var process = new Workflow.Context(_process, ticket);
                            resultEval = eval(expression);
        }
                      } catch (e) {
                          print(e.stack);
                      }

                      if (!resultEval) continue;

                      var nextNetElement = get_individual(ticket, veda.Util.getUri(flowsInto));
                      if (!nextNetElement) continue;

                      var work_item_uri = Workflow.create_work_item(ticket, forProcess, nextNetElement['@'], document['@'], _event_id, trace_journal_uri);
                      workItemList.push(
                      {
                          data: work_item_uri,
                          type: "Uri"
                      });

                      document['v-wf:isCompleted'] = veda.Util.newBool(true);
                      document['v-s:isExecuted'] = veda.Util.newBool(false);
                      document['v-s:created'] = veda.Util.newDate(new Date());
                      is_completed = true;
                      ////print("[WO12] document=", veda.Util.toJson(document));
                  }
              }
          }

          if (workItemList.length > 0)
              document['v-wf:workItemList'] = workItemList;

          if (is_completed == true || workItemList.length > 0)
          {
              put_individual(ticket, document, _event_id);
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /*
   *  обработка процесса
   */
  Workflow.prepare_process = function (ticket, document)
  {
    var deleted = veda.Util.hasValue(document, 'v-s:deleted');
    var completed = veda.Util.hasValue(document, 'v-wf:isCompleted');
    if (completed || deleted) { return; }

    var _process = document;
    var trace_journal_uri = Workflow.get_trace_journal(document, _process);

    if (trace_journal_uri) {
      veda.Util.traceToJournal(ticket, trace_journal_uri, "prepare_process", document['@']);
    }

    var inVars = _process['v-wf:inVars'] || [];

    var instanceOf = veda.Util.getUri( document['v-wf:instanceOf'] );
    var net = get_individual(ticket, instanceOf);
    if (!net) { return; }

    // создадим переменные с областью видимости данного процесса (v-wf:varDefineScope = v-wf:Net)
    var variables = net['v-wf:localVariable'];
    if (variables)
    {
      for (var i = 0; i < variables.length; i++)
      {
        var def_variable = get_individual(ticket, variables[i].data);
        if (!def_variable) { continue; }

        var variable_scope = veda.Util.getUri(def_variable['v-wf:varDefineScope']);
        if (!variable_scope) { continue; }

        if (variable_scope === 'v-wf:Net')
        {
          var new_variable = Workflow.generate_variable(ticket, def_variable, null, document, null, null);
          if (new_variable)
          {
            put_individual(ticket, new_variable, _event_id);
            inVars.push(
            {
              data: new_variable['@'],
              type: "Uri"
            });
            //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_variable['@'], ["v-s:canRead"]);
          }
        }
      }
    }

    var workItemList = [];

    var f_consistsOf = net['v-wf:consistsOf'];
    if (f_consistsOf)
    {
      ////print("[PP05.0]");
      for (var i = 0; i < f_consistsOf.length; i++)
      {
        var element_uri = f_consistsOf[i].data;
        var element = get_individual(ticket, element_uri);
        if (!element) {
          print("NET ELEMENT UNDFINED:", element_uri);
          continue;
        }

        ////print("[PP05.1] net_consistsOf=", veda.Util.toJson(net_consistsOf));

        if ( veda.Util.hasValue(element, "rdf:type", {data: "v-wf:InputCondition", type: "Uri"}) )
        {
          var work_item_uri = Workflow.create_work_item(ticket, document['@'], element_uri, null, _event_id, trace_journal_uri);

          ////print("[PP05.2]");

          workItemList.push({
            data: work_item_uri,
            type: "Uri"
          });

          break;
        }
      }
    }

    if (inVars.length > 0) {
      document['v-wf:inVars'] = inVars;
    }

    //var process = new Workflow.Context(_process, ticket);
    //process.print_variables('v-wf:inVars');

    if (workItemList.length > 0) {
      document['v-wf:workItemList'] = workItemList;
    }

    document['v-wf:isCompleted'] = veda.Util.newBool(false);

    if (inVars.length > 0 || workItemList.length > 0) {
      put_individual(ticket, document, _event_id);
    }

    ////print("[PP0E]");
  };

  /*
   *  Обработка стартовой формы и создание экземпляра процесса.
   *  Условие запуска процесса: в стартовой форме не должно быть поля v-wf:isProcess.
   *  создается экземпляр v-wf:Process с заполненными переменными из текущей формы
   *  и экземпляр v-wf:WorkItem относящийся к v-wf:InputCondition
   */
  Workflow.prepare_start_form = function (ticket, document)
  {
      // Если задача выдана из другой задачи, то заменить значение v-wf:processedDocument на значение v-wf:onDocument из исходной задачи
      var processedDocumentId;
      var processedDocumentValue;
      if ( document['v-wf:processedDocument'] ) {
        processedDocumentId = document['v-wf:processedDocument'][0].data;
        processedDocumentValue = document['v-wf:processedDocument'];
        var processedDocument = get_individual(ticket, processedDocumentId);
        if ( veda.Util.hasValue(processedDocument, "rdf:type", { data: "v-wf:DecisionForm", type: "Uri" } ) ) {
          processedDocumentId = processedDocument["v-wf:onDocument"] ? processedDocument["v-wf:onDocument"][0].data : processedDocument['@'];
          processedDocumentValue = processedDocument["v-wf:onDocument"] || [{ data: document['@'], type: "Uri" }];
          document['v-wf:processedDocument'] = processedDocumentValue;
          document["v-wf:hasParentTask"] = [{ data: processedDocument['@'], type: "Uri" }];
          processedDocument["v-wf:hasChildTask"] = (processedDocument["v-wf:hasChildTask"] || []).concat( veda.Util.newUri(document['@']) );
          put_individual(ticket, processedDocument, _event_id);
        }
      } else {
        processedDocumentId = document['@'];
        processedDocumentValue = [{ data: document['@'], type: "Uri" }];
      }

      var isTrace = document['v-wf:isTrace'];
      if (isTrace && veda.Util.getFirstValue(isTrace) == true)
          isTrace = true;
      else
          isTrace = false;

      var hasStatusWorkflowif = document['v-wf:hasStatusWorkflow'];
      if (hasStatusWorkflowif)
      {
          if (veda.Util.getUri(hasStatusWorkflowif) != 'v-wf:ToBeSent')
          {
              print("[WORKFLOW]:prepare_start_form, not ready to start.");
              return;
          }
      }
      else
          return;

      if (document['v-wf:isProcess'])
      {
          print("[WORKFLOW]:prepare_start_form, already started.");
          return;
      }

      // Include start form to processed document group
      if ( veda.Util.hasValue(document, "v-wf:processedDocument") ) {
        veda.Util.addToGroup(ticket, veda.Util.getUri(document["v-wf:processedDocument"]), document["@"], ["v-s:canRead"]);
      }

      var new_process_uri = veda.Util.genUri() + "-prs";

      var creator_f = document['v-s:creator'];

      var author_uri;
      if ( veda.Util.hasValue(document, "v-s:creator") ) {
        var creator_uri = document["v-s:creator"][0].data;
        var creator = get_individual(ticket, creator_uri);
        if ( veda.Util.hasValue(creator, "v-s:employee") ) {
          author_uri = creator["v-s:employee"][0].data;
        }
      }

      var forNet = document['v-wf:forNet'];
      var _net = get_individual(ticket, veda.Util.getUri(forNet));
      if (!_net) return;

      var new_vars = [];
      var transform_link = veda.Util.getUri(document['v-wf:useTransformation']);

      print('@js transform_link=', transform_link);

      if (transform_link)
      {
          var transform = get_individual(ticket, transform_link);
          if (!transform) return;

          // формируем входящие переменные для нового процесса
          var process_inVars = veda.Util.transformation(ticket, document, transform, null, null, veda.Util.newUri(new_process_uri));
          for (var i = 0; i < process_inVars.length; i++)
          {
              put_individual(ticket, process_inVars[i], _event_id);
              new_vars.push(
              {
                  data: process_inVars[i]['@'],
                  type: "Uri"
              });

              //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", process_inVars[i]['@'], ["v-s:canRead"]);
          }
      }

      var new_process = {
          '@': new_process_uri,
          'rdf:type': veda.Util.newUri('v-wf:Process'),
          'v-wf:instanceOf': forNet
      };
      new_process['rdfs:label'] = [
      {
          data: "экземпляр маршрута :" + veda.Util.getFirstValue(_net['rdfs:label']),
          type: "String"
      }];

      if (isTrace)
          new_process['v-wf:isTrace'] = veda.Util.newBool(true);

      if (new_vars.length > 0)
          new_process['v-wf:inVars'] = new_vars;

      new_process['v-wf:hasStartForm'] = veda.Util.newUri(document["@"]);

      var trace_journal_uri;

      if (isTrace)
      {
          trace_journal_uri = Workflow.create_new_journal(ticket, veda.Util.getTraceJournalUri(new_process_uri), veda.Util.getJournalUri(processedDocumentId), _net['rdfs:label'], true);

          if (trace_journal_uri)
          {
              veda.Util.traceToJournal(ticket, trace_journal_uri, "started new process", veda.Util.toJson(new_process));
              new_process['v-wf:traceJournal'] = veda.Util.newUri(trace_journal_uri);
          }
      }

      put_individual(ticket, new_process, _event_id);

      var jrn_processed_doc_uri = veda.Util.getJournalUri(processedDocumentId);

      if (!get_individual(ticket, jrn_processed_doc_uri))
      {
        var jrn_processed_doc = {
          '@': jrn_processed_doc_uri,
          'rdf:type': veda.Util.newUri('v-s:Journal'),
          'v-s:onDocument': processedDocumentValue,
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
        };
        put_individual(ticket, jrn_processed_doc, _event_id);
      }

      Workflow.create_new_journal(ticket, veda.Util.getJournalUri(new_process_uri), jrn_processed_doc_uri, _net['rdfs:label']);

      var jrId = veda.Util.genUri() + "-psr";
      var journalRecord = {
          '@': jrId,
          'rdf:type': veda.Util.newUri('v-s:ProcessStarted'),
          'v-s:processJournal': veda.Util.newUri(veda.Util.getJournalUri(new_process_uri)),
          'v-wf:onProcess': veda.Util.newUri(new_process_uri),
          'v-s:onDocument': processedDocumentValue,
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
         };

      //    var user = get_individual(ticket, author_uri);
      //    if (user['v-s:hasAppointment'])
      //    {
      if (creator_f)
          journalRecord['v-s:actor'] = creator_f;
      //    }

      put_individual(ticket, journalRecord, _event_id);

      var membership = {
          '@': veda.Util.genUri() + "-mbh",
          'rdf:type': veda.Util.newUri('v-s:Membership'),
          'v-s:resource': veda.Util.newUri(new_process_uri),
          'v-s:memberOf': processedDocumentValue,
          'rdfs:comment': veda.Util.newStr('Process is in document group')
      };
      put_individual(ticket, membership, _event_id);

      add_to_individual(ticket,
      {
          '@': processedDocumentId + 'j',
          'v-s:childRecord': veda.Util.newUri(jrId)
      }, _event_id);

      document['v-wf:hasStatusWorkflow'] = veda.Util.newUri('v-wf:IsSent');
      document['v-wf:hasStartForm'] = veda.Util.newUri(document["@"]);
      document['v-wf:isProcess'] = (document['v-wf:isProcess'] || []).concat( veda.Util.newUri(new_process_uri) );
      put_individual(ticket, document, _event_id);

      // возьмем автора формы и выдадим ему полные права на процесс
      if (author_uri)
          veda.Util.addRight(ticket, author_uri, new_process_uri, ["v-s:canRead", "v-s:canUpdate", "v-s:canDelete"]);

      veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_process_uri, ["v-s:canRead"]);
  };

  // Workflow engine utilities

  var Workflow$1 = veda.Workflow || {};

  veda.Workflow = Workflow$1;

  Workflow$1.create_work_item = function (ticket, process_uri, net_element_uri, parent_uri, _event_id, isTrace)
  {
      try
      {
          var new_uri = veda.Util.genUri() + "-wit";
          var new_work_item = {
              '@': new_uri,
              'rdf:type': [
              {
                  data: 'v-wf:WorkItem',
                  type: "Uri"
              }],
              'v-wf:forProcess': [
              {
                  data: process_uri,
                  type: "Uri"
              }],
              'v-wf:forNetElement': [
              {
                  data: net_element_uri,
                  type: "Uri"
              }],
            'v-s:created': [
            {
            data: new Date(),
            type: "Datetime"
              }],
            'v-s:creator': [
            {
            data: 'cfg:VedaSystem',
            type: "Uri"
              }]
          };

          if (isTrace)
              new_work_item['v-wf:isTrace'] = veda.Util.newBool(true);

          if (parent_uri !== null)
          {
              new_work_item['v-wf:previousWorkItem'] = [
              {
                  data: parent_uri,
                  type: "Uri"
              }];
          }

          //print("[WORKFLOW]:create work item:" + new_uri);

          put_individual(ticket, new_work_item, _event_id);

          //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_uri, ["v-s:canRead"]);

          return new_uri;
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  Workflow$1.WorkItemResult = function (_work_item_result)
  {
      this.work_item_result = _work_item_result;

      /////////////////////////// functions prepare work_item_result
      this.getValue = function(var_name)
      {
          for (var i in this.work_item_result)
          {
              return this.work_item_result[i][var_name];
          }
      };

      this.compare = function(var_name, value)
      {
          if (!value || value.length < 1)
              return false;

          //print ("@@@compareTaskResult this.work_item_result=", veda.Util.toJson (this.work_item_result));
          //print ("@@@compareTaskResult value=", veda.Util.toJson (value));
          //print ("@@@compareTaskResult var_name=", veda.Util.toJson (var_name));
          if (!this.work_item_result || this.work_item_result.length == 0)
              return false;

          //  print ("@@@compareTaskResult 1");
          var true_count = 0;
          for (var i in this.work_item_result)
          {
              //  print ("@@@compareTaskResult 2");
              var wirv = this.work_item_result[i][var_name];
              if (wirv && wirv.length == value.length)
              {
                  //  print ("@@@compareTaskResult 3");
                  for (var j in wirv)
                  {
                      //  print ("@@@compareTaskResult 4");
                      for (var k in value)
                      {
                          if (wirv[j].data == value[k].data && wirv[j].type == value[k].type)
                              true_count++;

                      }
                      if (true_count == value.length)
                          return true;
                  }
              }
          }

          return false;
      };

      this.is_exists_result = function()
      {
          if (!this.work_item_result || this.work_item_result.length < 1)
              return false;

          for (var i = 0; i < this.work_item_result.length; i++)
          {
              if (this.work_item_result[i].result)
                  return true;
          }

          return false;
      };

      this.is_all_executors_taken_decision = function(var_name, value)
      {
          //print('BLABLABLA > '+veda.Util.toJson(this));
          if (!value || value.length < 1)
              return false;

          var count_agreed = 0;
          for (var i = 0; i < this.work_item_result.length; i++)
          {
              var wirv = this.work_item_result[i][var_name];

              //print("@@@is_all_executors_taken_decision: wiri=" + veda.Util.toJson(wirv), ", value=", veda.Util.toJson(value));

              if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type)
                  count_agreed++;
          }

          if (count_agreed == this.work_item_result.length)
          {
              //print("@@@is_some_executor_taken_decision: TRUE");
              return true;
          }
          else
              return false;

      };

      this.is_some_executor_taken_decision = function(var_name, value)
      {
          if (!value || value.length < 1)
              return false;

          for (var i = 0; i < this.work_item_result.length; i++)
          {
              var wirv = this.work_item_result[i][var_name];

              //print("@@@is_some_executor_taken_decision: wiri=" + veda.Util.toJson(wirv), ", value=", veda.Util.toJson(value));

              if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type)
              {
                  //print("@@@is_some_executor_taken_decision: TRUE");
                  return true;
              }
          }

          return false;
      };


  };

  Workflow$1.is_some_content_value = function (src, b)
  {
      for (var i = 0; i < src.length; i++)
      {
          for (var j = 0; j < b.length; j++)
          {
              if (src[i].type == b[j].type && src[i].data == b[j].data)
              {
                  //          print("@@@is_some_content_value: TRUE");
                  return true;
              }
          }
      }

      //          print("@@@is_some_content_value: FALSE");
      return false;
  };


  Workflow$1.Context = function (_src_data, _ticket)
  {
      this.src_data = _src_data;
      this.ticket = _ticket;

    this.getDecisionForms = function()
    {
          return this.src_data['v-wf:decisionFormList'];
    };

      this.getExecutor = function()
      {
          return this.src_data['v-wf:executor'];
      };

      this.getLabel = function()
      {
          return this.src_data['rdfs:label'];
      };

      this.get_results = function()
      {
          return this.src_data;
      };

      this.if_all_executors_taken_decision = function(true_decision, false_decision)
      {
          try
          {
              var count_agreed = 0;
              for (var i = 0; i < this.src_data.length; i++)
              {
                  //     print ("data[i].result=", data[i].result);
                  if (this.src_data[i].result == true_decision)
                  {
                      count_agreed++;
                  }
              }

              if (count_agreed == this.src_data.length)
              {
                  return [
                  {
                      'data': true_decision,
                      'type': "Uri"
                  }];
              }
              else
              {
                  return [
                  {
                      'data': false_decision,
                      'type': "Uri"
                  }];
              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

      };

      this.getInputVariable = function(var_name)
      {
          return this.getVariableValueIO(var_name, 'v-wf:inVars');
      };

      this.getLocalVariable = function(var_name)
      {
          return this.getVariableValueIO(var_name, 'v-wf:localVars');
      };

      this.getOutVariable = function(var_name)
      {
          return this.getVariableValueIO(var_name, 'v-wf:outVars');
      };

      this.getVariableValueIO = function(var_name, io)
      {
          try
          {
              //          print ("CONTEXT::getVariableValueIO src_data=" + veda.Util.toJson (this.src_data));
              var variables = this.src_data[io];

              if (variables)
              {
                  for (var i = 0; i < variables.length; i++)
                  {
                      var variable = get_individual(this.ticket, variables[i].data);
                      if (!variable) continue;
                      //print ("CONTEXT::getVariableValueIO var=" + veda.Util.toJson (variable));

                      var variable_name = veda.Util.getFirstValue(variable['v-wf:variableName']);

                      //print("[WORKFLOW]:getVariableIO #0: work_item=" + this.src_data['@'] + ", var_name=" + variable_name + ", val=" + veda.Util.toJson(variable['v-wf:variableValue']));

                      if (variable_name == var_name)
                      {
                          var val = variable['v-wf:variableValue'];

                          //print("[WORKFLOW]:getVariableValue #1: work_item=" + this.src_data['@'] + ", var_name=" + var_name + ", val=" + veda.Util.toJson(val)); // + ", variable=" + veda.Util.toJson (variable));
                          return val;
                      }
                  }

              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

          //print("[WORKFLOW]:getVariableValue: work_item=" + this.src_data['@'] + ", var_name=" + var_name + ", val=undefined");
      };

      this.print_variables = function(io)
      {
          try
          {
              var variables = this.src_data[io];

              if (variables)
              {
                  for (var i = 0; i < variables.length; i++)
                  {
                      var variable = get_individual(this.ticket, variables[i].data);
                      if (!variable) continue;

                      var variable_name = veda.Util.getFirstValue(variable['v-wf:variableName']);

                      //print("[WORKFLOW]:print_variable: work_item=" + this.src_data['@'] + ", var_name=" + variable_name + ", val=" + veda.Util.toJson(variable['v-wf:variableValue']));
                  }

              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

      };

      this.get_result_value = function(field1, type1)
      {
          try
          {
              if (this.src_data && this.src_data.length > 0)
              {
                  var rr = this.src_data[0][field1];
                  if (rr)
                      return [
                      {
                          'data': rr,
                          'type': type1
                      }];
                  else
                      return null;
              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

      };
  };

  Workflow$1.get_new_variable = function (variable_name, value) {
    try {
      var new_uri = veda.Util.genUri() + "-var";
      var new_variable = {
        '@': new_uri,
        'rdf:type': [{
          data: 'v-wf:Variable',
          type: "Uri"
        }],
        'v-wf:variableName': [{
          data: variable_name,
          type: "String"
        }],
        'v-s:created': [{
          data: new Date(),
          type: "Datetime"
        }]
      };
      if (value) { new_variable['v-wf:variableValue'] = value; }
      return new_variable;

    } catch (e) {
      print(e.stack);
      throw e;
    }
  };

  Workflow$1.store_items_and_set_minimal_rights = function (ticket, data)
  {
      try
      {
          var ids = [];
          for (var i = 0; i < data.length; i++)
          {
              if (data[i]['v-s:created'] == undefined)
                  data[i]['v-s:created'] = veda.Util.newDate(new Date());
              else
                  data[i]['v-s:edited'] = veda.Util.newDate(new Date());

              if (data[i]['v-s:creator'] == undefined)
                  data[i]['v-s:creator'] = veda.Util.newUri('cfg:VedaSystem');

              put_individual(ticket, data[i], _event_id);

              ids.push(
              {
                  data: data[i]['@'],
                  type: "Uri"
              });

              veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", data[i]['@'], ["v-s:canRead"]);
          }
          return ids;
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  Workflow$1.generate_variable = function (ticket, def_variable, value, _process, _task, _task_result)
  {
      try
      {
          var variable_name = veda.Util.getFirstValue(def_variable['v-wf:varDefineName']);

          //print("[WORKFLOW][generate_variable]: variable_define_name=" + variable_name);
          var new_variable = Workflow$1.get_new_variable(variable_name, value);

          var variable_scope = veda.Util.getUri(def_variable['v-wf:varDefineScope']);
          if (variable_scope)
          {
              var scope;
              if (variable_scope == 'v-wf:Net')
                  scope = _process['@'];

              if (scope)
              {
                  new_variable['v-wf:variableScope'] = [
                  {
                      data: scope,
                      type: "Uri"
                  }];

                  var local_vars = _process['v-wf:localVars'];
                  var find_local_var;
                  if (local_vars)
                  {
                      //print("[WORKFLOW][generate_variable]: ищем переменную [", variable_name, "] среди локальных процесса:" + _process['@'] + ", local_vars=", veda.Util.toJson (local_vars));

                      // найдем среди локальных переменных процесса, такую переменную
                      // если нашли, то новая переменная должна перезаписать переменную процесса
                      for (var i = 0; i < local_vars.length; i++)
                      {
                          //print ("@@ local_var_uri=", veda.Util.toJson (local_vars[i]));
                          var local_var = get_individual(ticket, local_vars[i].data);
                          if (!local_var) continue;

                          //print ("@@ local_var=", veda.Util.toJson (local_var));

                          var var_name = veda.Util.getFirstValue(local_var['v-wf:variableName']);
                          if (!var_name) continue;

                          if (var_name == variable_name)
                          {
                              find_local_var = local_var;
                              break;
                          }
                      }

                      if (find_local_var)
                      {
                          // нашли, обновим значение в локальной переменной
                          find_local_var['v-wf:variableValue'] = value;
                          //            print ("find_local_var=", veda.Util.toJson (find_local_var));
                          put_individual(ticket, find_local_var, _event_id);

                          //                        new_variable['@'] = find_local_var['@'];
                      }
                  }
                  else
                      local_vars = [];

                  if (!find_local_var)
                  {
                      //print("[WORKFLOW][generate_variable]: переменная [", variable_name, "] не, найдена, привязать новую к процессу:" + _process['@']);

                      // если не нашли то сделать копию и привязать ее переменную к процессу
                      var new_variable_for_local = Workflow$1.get_new_variable(variable_name, value);
                      put_individual(ticket, new_variable_for_local, _event_id);

                      var add_to_document = {
                          '@': _process['@'],
                          'v-wf:localVars': [
                          {
                              data: new_variable_for_local['@'],
                              type: "Uri"
                          }]
                      };
                      add_to_individual(ticket, add_to_document, _event_id);

                      local_vars.push(veda.Util.newUri(new_variable_for_local['@'])[0]);
                      _process['v-wf:localVars'] = local_vars;

                      //print("[WORKFLOW][generate_variable]: _process= ", veda.Util.toJson (_process['v-wf:localVars']));
                  }

              }
          }

          //print("[WORKFLOW][generate_variable]: new variable: " + veda.Util.toJson(new_variable));

          return new_variable;
      }
      catch (e)
      {
          print(e.stack);
          throw e;
      }

  };

  Workflow$1.create_and_mapping_variables = function (ticket, mapping, _process, _task, _order, _task_result, f_store, trace_journal_uri, trace_comment)
  {
      try
      {
          var _trace_info = [];

          var new_vars = [];
          if (!mapping) return [];

          var process;
          var task;
          var order;
          var task_result;

          if (_process)
              process = new Workflow$1.Context(_process, ticket);

          if (_task)
              task = new Workflow$1.Context(_task, ticket);

          if (_order)
              order = new Workflow$1.Context(_order, ticket);

          if (_task_result)
              task_result = new Workflow$1.WorkItemResult(_task_result);

          // print("[WORKFLOW][create_and_mapping_variables]: process=" + veda.Util.toJson (process));
          // print("[WORKFLOW][create_and_mapping_variables]: task=" + veda.Util.toJson (task));
          // print("[WORKFLOW][create_and_mapping_variables]: order=" + veda.Util.toJson (order));
          // print("[WORKFLOW][create_and_mapping_variables]: task_result=" + veda.Util.toJson (task_result));

          for (var i = 0; i < mapping.length; i++)
          {
              var map = get_individual(ticket, mapping[i].data);

              if (map)
              {
                  //print("[WORKFLOW][create_and_mapping_variables]: map_uri=" + map['@']);
                  var expression = veda.Util.getFirstValue(map['v-wf:mappingExpression']);
                  if (!expression) continue;

                  //print("[WORKFLOW][create_and_mapping_variables]: expression=" + expression);
                  try
                  {
                      var res1 = eval(expression);
                      //print("[WORKFLOW][create_and_mapping_variables]: res1=" + veda.Util.toJson(res1));
                      if (!res1) continue;

                      var mapToVariable_uri = veda.Util.getUri(map['v-wf:mapToVariable']);
                      if (!mapToVariable_uri) continue;

                      var def_variable = get_individual(ticket, mapToVariable_uri);
                      if (!def_variable) continue;

                      var new_variable = Workflow$1.generate_variable(ticket, def_variable, res1, _process, _task, _task_result);
                      if (new_variable)
                      {
                          if (f_store == true)
                          {
                              put_individual(ticket, new_variable, _event_id);

                              if (trace_journal_uri)
                                  _trace_info.push(new_variable);

                              new_vars.push(
                              {
                                  data: new_variable['@'],
                                  type: "Uri"
                              });
                              //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_variable['@'], ["v-s:canRead"]);

                          }
                          else
                          {
                              new_vars.push(new_variable);
                          }
                      }
                  }
                  catch (e)
                  {
                      if (trace_journal_uri)
                          veda.Util.traceToJournal(ticket, trace_journal_uri, "create_and_mapping_variables", "err: expression: " + expression + "\n" + e.stack);
                  }
              }
              else
              {
                  if (trace_journal_uri)
                      veda.Util.traceToJournal(ticket, trace_journal_uri, "create_and_mapping_variables", "map not found :" + mapping[i].data);
              }
          }

          if (trace_journal_uri)
              veda.Util.traceToJournal(ticket, trace_journal_uri, "create_and_mapping_variables", trace_comment + " = '" + veda.Util.getUris(mapping) + "' \n\nout = \n" + veda.Util.toJson(_trace_info));

          return new_vars;
      }
      catch (e)
      {
          print(e.stack);
          return [];
      }

  };

  //////////////////////////////////////////////////////////////////////////

  Workflow$1.find_in_work_item_tree = function (ticket, _process, compare_field, compare_value)
  {
      try
      {
          var res = [];

          var f_workItemList = _process['v-wf:workItemList'];

          if (f_workItemList)
              Workflow$1.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, _process);

          return res;
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  Workflow$1.rsffiwit = function (ticket, work_item_list, compare_field, compare_value, res, _parent)
  {
      try
      {
          for (var idx = 0; idx < work_item_list.length; idx++)
          {
              var i_work_item = get_individual(ticket, work_item_list[idx].data);
              if (i_work_item)
              {
                  var ov = i_work_item[compare_field];
                  var isCompleted = i_work_item['v-wf:isCompleted'];

                  if (ov && veda.Util.getUri(ov) == compare_value && !isCompleted)
                      res.push(
                      {
                          parent: _parent,
                          work_item: i_work_item
                      });

                  var f_workItemList = i_work_item['v-wf:workItemList'];

                  if (f_workItemList)
                      Workflow$1.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, i_work_item);
              }

          }
      }
      catch (e)
      {
          print(e.stack);
      }


  };

  ///////////////////////////////////////////// JOURNAL //////////////////////////////////////////////////
  Workflow$1.create_new_journal = function(ticket, new_journal_uri, parent_journal_uri, label, is_trace)
  {
    try
    {
        var exists_journal = get_individual(ticket, new_journal_uri);

        if (!exists_journal)
        {
            var new_journal = {
                '@': new_journal_uri,
                'rdf:type': [
                {
                    data: 'v-s:Journal',
                    type: "Uri"
                }],
                'v-s:created': [
                {
                    data: new Date(),
                    type: "Datetime"
                }]
            };

            if (parent_journal_uri)
            {
                Workflow$1.create_new_journal(ticket, parent_journal_uri, null, "", is_trace);
                new_journal['v-s:parentJournal'] = veda.Util.newUri(parent_journal_uri);
            }

            if (label)
                new_journal['rdfs:label'] = label;

            if (is_trace)
                new_journal['v-wf:isTrace'] = veda.Util.newBool(true);

            put_individual(ticket, new_journal, _event_id);
            //print ("create_new_journal, new_journal=", veda.Util.toJson (new_journal), ", ticket=", ticket);
        }
        else
        {
            //print ("create_new_journal, journal already exists, exists_journal=", veda.Util.toJson (exists_journal), ", ticket=", ticket);
        }

        return new_journal_uri;
    }
    catch (e)
    {
        print(e.stack);
    }

  };

  Workflow$1.mapToJournal = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment)
  {
      try
      {
          if (journal_uri && map_container)
          {
              var process_uri = _process['@'];

              //* выполнить маппинг для журнала
              var journalVars = [];

              if (_task && msg)
                  _task['rdfs:label'] = msg;

              journalVars = Workflow$1.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);
              if (journalVars)
              {
                  var new_journal_record = veda.Util.newJournalRecord(journal_uri);
                  for (var idx = 0; idx < journalVars.length; idx++)
                  {
                      var jvar = journalVars[idx];
                      var name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
                      var value = jvar['v-wf:variableValue'];
                      new_journal_record[name] = value;
                  }
                  veda.Util.logToJournal(ticket, journal_uri, new_journal_record);

                  //print("@@@ logToJournal[" + journal_uri + "], new_journal_record=" + veda.Util.toJson(new_journal_record));

              }
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  /*
   * функция mapToMessage, генерирует индивид/сообщение с помощью шаблонизатора mustache (http://mustache.github.io/)
   *
   *    ! для работы требуется заполненная переменная $template, которая указывает на шаблон (индивид типа v-s:Notification)
   *
   *    из шаблона используются поля:
   *      v-s:notificationLanguage - указание какой язык выбран для генерации текста
   *      v-s:notificationSubject  - шаблон для заголовка
   *      v-s:notificationBody   - шаблон для тела
   */

  Workflow$1.getAppName = function () {
    var appInfo = get_individual(ticket, "v-s:vedaInfo");
    var appName = appInfo ? veda.Util.getFirstValue(appInfo["rdfs:label"]) : "";
    return appName;
  };

  Workflow$1.mapToMessage = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment) {
    try {
      if (journal_uri && map_container) {
        var process_uri = _process['@'];

        //* выполнить маппинг для сообщения
        var messageVars = [];
        messageVars = Workflow$1.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);


        if (messageVars) {

          var new_message_uri = veda.Util.genUri() + "-msg";
          var new_message = {
            '@': new_message_uri,
            'v-s:created': [{
              data: new Date(),
              type: "Datetime"
            }]
          };

          var template;

          for (var idx = 0; idx < messageVars.length; idx++) {
            var jvar = messageVars[idx];
            var name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
            var value = jvar['v-wf:variableValue'];

            if (name == '$template') {
              template = get_individual(ticket, veda.Util.getUri(value));
            }

            if (name.indexOf(':') > 0) {
              new_message[name] = value;
            }
          }

          if (template) {
            var lang = template['v-s:notificationLanguage'];
            var subject = veda.Util.getFirstValue(template['v-s:notificationSubject']);
            var body = veda.Util.getFirstValue(template['v-s:notificationBody']);

            if (lang) {
              var lang_indv = get_individual(ticket, lang);

              if (lang_indv && lang_indv['rdf:value']) {
                lang = veda.Util.getFirstValue(lang_indv['rdf:value']).toLowerCase ();
              } else {
                lang = 'RU';
              }
            } else {
              lang = 'RU';
            }
            var view = {
              "app_name": Workflow$1.getAppName
            };

            for (var idx = 0; idx < messageVars.length; idx++) {
              var jvar = messageVars[idx];
              var name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
              if (name == '$template' || name.indexOf(':') > 0) {
                continue;
              }
              var values = jvar['v-wf:variableValue'];
              var araa = [];

              for (var val_idx in values) {
                var value = values[val_idx];
                if (value.type == "Uri") {
                  var inner_indv = get_individual(ticket, value.data);
                  if (inner_indv == undefined) {
                    araa.push('ERR! individual [' + value.data + '] not found, var.name=' + name);
                    continue;
                  }
                  if (inner_indv['rdfs:label'] == undefined) {
                    araa.push('ERR! individual [' + value.data + '] not contains rdfs:label, var.name=' + name);
                    continue;
                  }
                  //print("@@@43 inner_indv=", veda.Util.toJson (inner_indv), ", lang=", lang);
                  value = veda.Util.getFirstValueUseLang(inner_indv['rdfs:label'], lang);

                  if (!value) {
                    value = veda.Util.getFirstValue(inner_indv['rdfs:label']);
                  }
                  araa.push(value);
                } else {
                  var aa = "";
                  if (value.lang == lang || value.lang == "" || value.lang == undefined || value.lang == "NONE") {
                    aa = value.data;
                    araa.push(aa);
                  }
                }
              }
              view[name] = araa;
            }
            //print("@@@50 view=", veda.Util.toJson(view));
            var output_subject = Mustache.render(subject, view).replace (/&#x2F;/g, '/');
            var output_body = Mustache.render(body, view).replace (/&#x2F;/g, '/');
            new_message['v-s:subject'] = veda.Util.newStr (output_subject, lang);
            new_message['v-s:messageBody'] = veda.Util.newStr (output_body, lang);
            new_message['v-wf:onWorkOrder'] = veda.Util.newUri (_order['@']);
            new_message['v-s:hasMessageType'] = template['v-s:hasMessageType'];
            put_individual(ticket, new_message, _event_id);
          }
          //print("@@@ mapToMessage=" + veda.Util.toJson(new_message));
        }
      }
    } catch (e) {
      print(e.stack);
    }
  };


  Workflow$1.create_new_subjournal = function (parent_uri, el_uri, label, jtype)
  {
      return Workflow$1._create_new_subjournal(false, parent_uri, el_uri, label, jtype)
  };

  Workflow$1.create_new_trace_subjournal = function (parent_uri, net_element_impl, label, jtype)
  {
      var new_sub_journal_uri;
      var isTrace;

      isTrace = net_element_impl['v-wf:isTrace'];

      if (!isTrace || isTrace && veda.Util.getFirstValue(isTrace) == false)
          return undefined;

      var el_uri = net_element_impl['@'];

      new_sub_journal_uri = Workflow$1._create_new_subjournal(true, parent_uri, el_uri, label, jtype);

      var set_journal_to_element;
      set_journal_to_element = {
          '@': el_uri,
          'v-wf:traceJournal': veda.Util.newUri(new_sub_journal_uri),
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
      };
      add_to_individual(ticket, set_journal_to_element, _event_id);

      return new_sub_journal_uri;
  };

  Workflow$1._create_new_subjournal = function (is_trace, parent_uri, el_uri, label, jtype)
  {
      var new_sub_journal_uri;
      var parent_journal_uri;

      if (is_trace == true)
      {
          new_sub_journal_uri = veda.Util.getTraceJournalUri(el_uri);
          parent_journal_uri = veda.Util.getTraceJournalUri(parent_uri);
      }
      else
      {
          new_sub_journal_uri = veda.Util.getJournalUri(el_uri);
          parent_journal_uri = veda.Util.getJournalUri(parent_uri);
      }

      var cj = get_individual(ticket, new_sub_journal_uri);
      if (cj)
      {
          //print("!!!!!!!!!! journal [" + new_sub_journal_uri + "] already exists");
          return new_sub_journal_uri;
      }
      else
          Workflow$1.create_new_journal(ticket, new_sub_journal_uri, parent_journal_uri, label, is_trace);

      var journal_record = veda.Util.newJournalRecord(parent_journal_uri);
      journal_record['rdf:type'] = [
      {
          data: jtype,
          type: "Uri"
      }];
      if (label)
      {
          if (Array.isArray(label))
              journal_record['rdfs:label'] = label;
          else
              journal_record['rdfs:label'] = [
              {
                  data: label,
                  type: "String"
              }];
      }
      journal_record['v-s:subJournal'] = [
      {
          data: new_sub_journal_uri,
          type: "Uri"
      }];
      veda.Util.logToJournal(ticket, parent_journal_uri, journal_record, true);

      put_individual(ticket, journal_record, _event_id);

      return new_sub_journal_uri;
  };

  Workflow$1.get_trace_journal = function (document, process)
  {
      var isTrace = document['v-wf:isTrace'];
      if (isTrace && veda.Util.getFirstValue(isTrace) == true)
      {
          return veda.Util.getTraceJournalUri(process['@']);
      }
      else
      {
          return undefined;
      }
  };

  /////////////////////////////////////////////////////////////////////////////////////////

  Workflow$1.create_new_subprocess = function (ticket, f_useSubNet, f_executor, parent_net, f_inVars, document, parent_trace_journal_uri)
  {
      try
      {
          var parent_process_uri = document['@'];

          var use_net;

          if (f_useSubNet)
              use_net = f_useSubNet;
          else
              use_net = f_executor;

          if (parent_trace_journal_uri)
              veda.Util.traceToJournal(ticket, parent_trace_journal_uri, "[WO2.4] executor= " + veda.Util.getUri(f_executor) + " used net", veda.Util.getUri(use_net));

          //var ctx = new Workflow.Context(work_item, ticket);
          //ctx.print_variables ('v-wf:inVars');
          var _started_net = get_individual(ticket, veda.Util.getUri(use_net));
          if (_started_net)
          {
              var new_process_uri = veda.Util.genUri() + "-prs";

              var new_process = {
                  '@': new_process_uri,
                  'rdf:type': [
                  {
                      data: 'v-wf:Process',
                      type: "Uri"
                  }],
                  'v-wf:instanceOf': use_net,
                  'v-wf:parentWorkOrder': [
                  {
                      data: parent_process_uri,
                      type: "Uri"
                  }],
          'v-s:created': [
          {
                data: new Date(),
                type: "Datetime"
                  }]
              };

              var msg = "экземпляр маршрута :" + veda.Util.getFirstValue(_started_net['rdfs:label']) + ", запущен из " + veda.Util.getFirstValue(parent_net['rdfs:label']);

              if (f_useSubNet)
                  msg += ", для " + veda.Util.getUri(f_executor);

              new_process['rdfs:label'] = [
              {
                  data: msg,
                  type: "String"
              }];

              // возьмем входные переменные WorkItem  и добавим их процессу
              if (f_inVars)
                  new_process['v-wf:inVars'] = f_inVars;

              if (f_useSubNet)
                  new_process['v-wf:executor'] = f_executor;

              if (parent_trace_journal_uri)
              {
                  veda.Util.traceToJournal(ticket, parent_trace_journal_uri, "new_process=", veda.Util.getUri(use_net), veda.Util.toJson(new_process));
                  new_process['v-wf:isTrace'] = veda.Util.newBool(true);

                  var trace_journal_uri = veda.Util.getTraceJournalUri(new_process_uri);
                  if (trace_journal_uri)
                  {
                      Workflow$1.create_new_journal(ticket, trace_journal_uri, null, _started_net['rdfs:label']);
                      new_process['v-wf:traceJournal'] = veda.Util.newUri(trace_journal_uri);
                  }
              }
              put_individual(ticket, new_process, _event_id);

              Workflow$1.create_new_subjournal(parent_process_uri, new_process_uri, 'запущен подпроцесс', 'v-wf:SubProcessStarted');

              document['v-wf:isProcess'] = [
              {
                  data: new_process_uri,
                  type: "Uri"
              }];

              put_individual(ticket, document, _event_id);
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };


  Workflow$1.get_properties_chain = function (var1, query, result_if_fail_search)
  {
      var res = [];

      if (query.length < 1)
          return res;

      var doc;
          //print('@@@get_properties_chain#1 var1=', veda.Util.toJson(var1), ", query=", veda.Util.toJson (query));
      try
      {
      doc = get_individual(ticket, veda.Util.getUri(var1));

      if (doc)
          Workflow$1.traversal(doc, query, 0, res);

          //print('@@@get_properties_chain #2 res=', veda.Util.toJson(res));

    if (result_if_fail_search && (res == undefined || res.length == 0))
      res = result_if_fail_search;

          //print('@@@get_properties_chain #3 res=', veda.Util.toJson(res));
      }
      catch (e)
      {
          print(e.stack);
      }

      return res;
  };

  Workflow$1.traversal = function (indv, query, pos_in_path, result)
  {
      var condition = query[pos_in_path];

      //print('@@@ traversal#0 condition=', veda.Util.toJson(condition), ", indv=", veda.Util.toJson(indv));

      var op_get;
      var op_go;
      var op_eq;
      for (var key in condition)
      {
          var op = key;

          if (op == '$get')
              op_get = condition[key];

          if (op == '$go')
              op_go = condition[key];

          if (op == '$eq')
              op_eq = condition[key];
      }
      if (op_go)
      {
          var ffs = indv[op_go];

          for (var i in ffs)
          {
              //print('@@@ traversal#2 ffs[i]=', ffs[i].data);
              var doc = get_individual(ticket, ffs[i].data);
              //print('@@@ traversal#4 doc=', veda.Util.toJson(doc));
              Workflow$1.traversal(doc, query, pos_in_path + 1, result);
          }
      }

      if (op_get)
      {
          //print ("@1 op_get=", op_get);
          var is_get = true;
          if (op_eq)
          {
              is_get = false;

              var kk = Object.keys(op_eq);
              if (kk)
              {
                  var field = kk[0];

                  var A = indv[field];
                  if (A)
                  {
                      //print("###1 A=", veda.Util.toJson(A));
                      var B = op_eq[field];
                      //print("###2 B=", veda.Util.toJson(B));

                      for (var i in A)
                      {
                          if (A[i].type == B[0].type && A[i].data == B[0].data)
                          {
                              is_get = true;
                              //print("###3 A == B");
                              break;
                          }

                      }

                  }
              }
          }
          else
          {
              is_get = true;
          }

          if (is_get && indv != undefined)
          {
              //print ("@2 op_get=", op_get);
              var ffs = indv[op_get];
              //print ("@3 op_get=", ffs);

              for (var i in ffs)
              {
                  //print('@@@ traversal#3 push ', ffs[i].data);
                  result.push(ffs[i]);
              }
          }
      }

  };

  Workflow$1.remove_empty_branches_from_journal = function (journal_uri)
  {
      var jrn = get_individual(ticket, journal_uri);
      if (jrn && !jrn["v-s:childRecord"])
      {
          var parent_jrn_uri = veda.Util.getUri(jrn["v-s:parentJournal"]);
          if (parent_jrn_uri)
          {
              var parent_jrn = get_individual(ticket, parent_jrn_uri);

              var child_records = parent_jrn['v-s:childRecord'];
        if (child_records)
        {
          for (var i = 0; i < child_records.length; i++)
          {
            var chr_uri = child_records[i].data;
            var chr = get_individual(ticket, chr_uri);
            if (chr && veda.Util.getUri(chr["v-s:subJournal"]) == journal_uri)
            {
              var remove_from_journal = {
                          '@': parent_jrn_uri,
                          'v-s:childRecord': [
                          {
                              data: chr_uri,
                              type: "Uri"
                          }]
              };
              remove_from_individual(ticket, remove_from_journal, _event_id);

              //print("@@@@@@@@ parent_jrn=", veda.Util.toJson(parent_jrn), ", remove_from_journal=", veda.Util.toJson(remove_from_journal));
              break;
            }

          }
        }
          }
      }
  };

  Workflow$1.getSystemUrl = function (var_to) {
      var userTo = get_individual(ticket, var_to[0].data);
      var isExternal = false;
      if (userTo["v-s:origin"] && userTo["v-s:origin"][0].data ==="ExternalUser") {
          isExternal = true;
      }    var systemIndivid = isExternal ? veda.Util.newUri ('cfg:SystemInfoExternal') : veda.Util.newUri ('v-s:vedaInfo');
      return veda.Util.getFirstValue (Workflow$1.get_properties_chain (systemIndivid, [{$get:'v-s:appUrl'}]));
  };

  Workflow$1.getInboxUrl = function (var_to) {
      var userTo = get_individual(ticket, var_to[0].data);
      var isExternal = false;
      if (userTo["v-s:origin"] && userTo["v-s:origin"][0].data ==="ExternalUser") {
          isExternal = true;
      }    var systemIndivid = isExternal ? veda.Util.newUri ('cfg:SystemInfoExternal') : veda.Util.newUri ('v-s:vedaInfo');
      return veda.Util.getFirstValue (Workflow$1.get_properties_chain (systemIndivid, [{$get:'v-wf:appInboxUrl'}]));
  };

  Workflow$1.isSubUnitOf = function (current, target, depth) {
      if (current.length == 0) return false;
      print("@@@@@isSubUnitOf run");
      depth = depth || 0;
      var dep = get_individual(ticket, current[0].data);
      if (!veda.Util.hasValue(dep, "v-s:parentUnit") || depth > 16) {
        print("@@@@@isSubUnitOf parentUnit empty");
        return false;
      } else if (veda.Util.hasValue(dep, "v-s:parentUnit", {data: target, type: "Uri"})) {
        print("@@@@@isSubUnitOf parentUnit match");
        return true;
      } else {
        return Workflow$1.isSubUnitOf(dep["v-s:parentUnit"], target, depth + 1);
      }
  };

  /**
   * Numeration - auto increment exclusive value.
   *
   * 1. Basic concepts:
   *
   * Scope - range of individuals, among that range numeration value must be unique.
   * Commit - add numeration value to scope.
   * Revoke - remove numeration value from scope.
   * Rule - (see `v-s:NumerationRule`) rule for auto numeration specified by properties:
   *  + v-s:numerationScope - script, return name of scope for specified individual.
   *  + v-s:numerationNextValue - script, returns next uncommitted value from rule scope.
   * Returns fist value if scope is empty.
   *
   * 2. How it works
   *
   * 2.1 Add `rdfs:subClassOf v-s:Enumerated ;` to your class description to
   * trigger numeration event on server side.
   * Define v-s:hasNumeration for a class. Individuals of this class will be numerated with defined numeration.
   *
   * 2.2 Chosen numeration must define v-s:enumeratedProperty & v-s:hasNumerationRule.
   * You can use already existing rule for v-ui:hasNumerationRule or create your own.
   * See examples: `v-s:SimpleNumeration`, `v-s:YearNumeration`.
   *
   * 2.3 Individuals of a mentioned class are automatically numerated with defined rule.
   * Numbers are stored in v-s:enumeratedProperty.
   */

  var Numerator = {};

  veda.Numerator = Numerator;

  Numerator.numerate = function (ticket, individual, super_classes, prev_state, _event_id) {
    try {
      var deleted = Util$1.hasValue( individual, "v-s:deleted", { data: true, type: "Boolean"} );
      var prevDeleted = prev_state && Util$1.hasValue( prev_state, "v-s:deleted", { data: true, type: "Boolean"} );

      individual['rdf:type'] && individual['rdf:type'].length && individual['rdf:type'].forEach(function (typeValue) {
        var type = get_individual(ticket, typeValue.data);
        if (!type || !type['v-s:hasNumeration']) { return; }

        var numeration = get_individual(ticket, type['v-s:hasNumeration'][0].data);
        var enumeratedProperty = numeration['v-s:enumeratedProperty'][0].data;
        var number = parseInt( individual[enumeratedProperty] && individual[enumeratedProperty].length && individual[enumeratedProperty][0].data || 0 );
        var prevNumber = parseInt( prev_state && prev_state[enumeratedProperty] && prev_state[enumeratedProperty][0].data || 0 );

        // Already processed
        if (number && prevNumber && number === prevNumber && deleted === prevDeleted) {
          // Nothing changed return
          //print("@1 nothing changed exit");
          return;
        } else {
          var rule = get_individual(ticket, numeration['v-s:hasNumerationRule'][0].data);
          var scopeId = getScope(ticket, individual, rule);
          var scope = get_individual(ticket, scopeId) || createScope(ticket, scopeId);
          //print("@2 | number", number, "| deleted", deleted, "| prev_state", !!prev_state, "| prevNumber", prevNumber, "| scopeId", scopeId);

          if (!number && !prevNumber) {
            // update doc, commit number
            number = getNewValue(ticket, individual, rule, scope);
            commitValue(ticket, scope, number, _event_id);
            individual[enumeratedProperty] = Util$1.newStr( number.toString() );
            put_individual(ticket, individual, _event_id);
            //print("@3 update doc, commit number");

          } else if (!number && prevNumber) {
            individual[enumeratedProperty] = Util$1.newStr( prevNumber.toString() ); // Restore number
            put_individual(ticket, individual, _event_id);
          } else if (number && !prev_state) {
            // commit number
            commitValue(ticket, scope, number, _event_id);
            //print("@4 commit number");

          } else if (number && deleted) {
            // revoke number
            revokeValue(ticket, scope, number, _event_id);
            //print("@5 revoke number");

          } else if (number && prevNumber && number !== prevNumber) {
            // commit number, revoke prevNumber
            commitValue(ticket, scope, number, _event_id);
            var prevScopeId = getScope(ticket, prev_state, rule);
            var prevScope = get_individual(ticket, prevScopeId);
            revokeValue(ticket, prevScope, prevNumber, _event_id);
            //print("@6 commit number, revoke prevNumber");

          } else {
            //print("@7 no condition fullfilled");
          }
        }
      });
    } catch (e) {
      print(e.stack);
    }
  };

  function getNewValue(ticket, individual, rule, scope) {
    try {
      //print("getNewValue: ticket", ticket, "| individual", JSON.stringify(individual), "| rule", JSON.stringify(rule), "| scope", JSON.stringify(scope));
      return eval(rule['v-s:numerationGetNextValue'][0].data)(ticket, scope);
    } catch (e) {
      print("getNewValue error", e.stack);
    }
  }

  function getScope(ticket, individual, rule) {
    try {
      //print("getScope: ticket", ticket, "| individual", JSON.stringify(individual), "| rule", JSON.stringify(rule));
      return eval(rule['v-s:numerationScope'][0].data)(ticket, individual);
    } catch (e) {
      print(e.stack);
    }
  }

  function createScope(ticket, scopeId) {
    //print("createScope: ticket", ticket, "| scopeId", JSON.stringify(scopeId));
    try {
      var scope = {
        '@': scopeId,
        'rdfs:label': [{ data: scopeId, type: "String" }],
        'rdf:type': [{ data: 'v-s:NumerationScopeClass', type: "Uri" }]
      };
      put_individual(ticket, scope, _event_id);
      return scope;
    } catch (e) {
      print(e.stack);
    }
  }

  function commitValue(ticket, scope, value, _event_id) {
    //print("commitValue: ticket", ticket, "| scope", JSON.stringify(scope), "| value", JSON.stringify(value));
    try {
      var nextInterval = null;
      var prevInterval = null;
      if (scope['v-s:numerationCommitedInterval']) {
        // Scope is not empty
        for ( var i in scope['v-s:numerationCommitedInterval']) {
          var intervalUri = scope['v-s:numerationCommitedInterval'][i].data;
          var interval = get_individual(ticket, intervalUri);
          try {
            if ( (interval['v-s:numerationCommitedIntervalBegin'][0].data <= value) && (value <= interval['v-s:numerationCommitedIntervalEnd'][0].data) ) {
              // value is already commited
              return false;
            } else if (interval['v-s:numerationCommitedIntervalBegin'][0].data == (value + 1)) {
              nextInterval = interval;
            } else if (interval['v-s:numerationCommitedIntervalEnd'][0].data == (value - 1)) {
              prevInterval = interval;
            }
          } catch (err) {
            print ("ERR! intervalUri=", intervalUri);
            print(err.stack);
          }
        }
        if (prevInterval != null && nextInterval != null) {
          // merge prev && value && next
          // prev = prev+next
          prevInterval['rdfs:label'][0].data = prevInterval['v-s:numerationCommitedIntervalBegin'][0].data + ' - ' + nextInterval['v-s:numerationCommitedIntervalEnd'][0].data;
          prevInterval['v-s:numerationCommitedIntervalEnd'][0].data = nextInterval['v-s:numerationCommitedIntervalEnd'][0].data;
          put_individual(ticket, prevInterval, _event_id);

          // remove next
          add_to_individual(ticket, {
            '@': nextInterval['@'],
            'v-s:deleted': [{ data: true, type: "Boolean" }]
          }, false);
          var intervals = [];
          for ( var i in scope['v-s:numerationCommitedInterval']) {
            var intervalUri = scope['v-s:numerationCommitedInterval'][i];
            if (intervalUri.data != nextInterval['@']) {
              intervals.push(intervalUri);
            }
          }
          scope['v-s:numerationCommitedInterval'] = intervals;
          put_individual(ticket, scope, _event_id);

        } else if (prevInterval != null) {
          // merge prev && value
          prevInterval['rdfs:label'][0].data = prevInterval['v-s:numerationCommitedIntervalBegin'][0].data + ' - ' + value;
          prevInterval['v-s:numerationCommitedIntervalEnd'][0].data = value;
          put_individual(ticket, prevInterval, _event_id);

        } else if (nextInterval != null) {
          // merge value && next
          nextInterval['rdfs:label'][0].data = value + ' - ' + nextInterval['v-s:numerationCommitedIntervalEnd'][0].data;
          nextInterval['v-s:numerationCommitedIntervalBegin'][0].data = value;
          put_individual(ticket, nextInterval, _event_id);

        } else {
          // new interval
          var intervalId = Util$1.genUri() + "-intv";
          var interval = {
            '@': intervalId,
            'rdfs:label': [{ data: value + ' - ' + value, type: "String" }],
            'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
            'v-s:numerationCommitedIntervalBegin': [{ data: value, type: "Integer" }],
            'v-s:numerationCommitedIntervalEnd': [{ data: value, type: "Integer" }]
          };
          put_individual(ticket, interval, _event_id);

          scope['v-s:numerationCommitedInterval'].push( {data: interval['@'], type: "Uri"} );
          put_individual(ticket, scope, _event_id);
        }
      } else {
        // Scope is empty - create new interval
        var intervalId = Util$1.genUri() + "-intv";
        var interval = {
          '@': intervalId,
          'rdfs:label': [{ data: value + ' - ' + value, type: "String" }],
          'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
          'v-s:numerationCommitedIntervalBegin': [{ data: value, type: "Integer" }],
          'v-s:numerationCommitedIntervalEnd': [{ data: value, type: "Integer" }]
        };
        put_individual(ticket, interval, _event_id);

        scope['v-s:numerationCommitedInterval'] = [{ data: interval['@'], type: "Uri" }];
        put_individual(ticket, scope, _event_id);
      }
      return true;
    } catch (e) {
      print(e.stack);
    }
  }

  function revokeValue(ticket, scope, value, _event_id) {
    //print("revokeValue: ticket", ticket, "value", value);
    try {
      var intervals = [];
      for ( var i in scope['v-s:numerationCommitedInterval']) {
        var intervalUri = scope['v-s:numerationCommitedInterval'][i];
        var interval = get_individual(ticket, intervalUri.data);

        if (interval['v-s:numerationCommitedIntervalBegin'][0].data == value) {
          // value is an interval begin
          if (interval['v-s:numerationCommitedIntervalBegin'][0].data < interval['v-s:numerationCommitedIntervalEnd'][0].data) {
            // cut interval
            put_individual(
              ticket,
              {
                '@': interval['@'],
                'rdfs:label': [{ data: (value + 1) + ' - ' + interval['v-s:numerationCommitedIntervalEnd'][0].data, type: "String" }],
                'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
                'v-s:numerationCommitedIntervalBegin': [{ data: value + 1, type: "Integer" }],
                'v-s:numerationCommitedIntervalEnd': [{ data: interval['v-s:numerationCommitedIntervalEnd'][0].data, type: "Integer" }]
              }, _event_id);
            intervals.push(intervalUri);
          } else {
            // remove empty interval
            add_to_individual(ticket, {
              '@': interval['@'],
              'v-s:deleted': [{ data: true, type: "Boolean" }]
            }, false);
          }
        } else if (interval['v-s:numerationCommitedIntervalEnd'][0].data == value) {
          // value is an interval end
          if (interval['v-s:numerationCommitedIntervalBegin'][0].data < interval['v-s:numerationCommitedIntervalEnd'][0].data) {
            // cut interval
            put_individual(
              ticket,
              {
                '@': interval['@'],
                'rdfs:label': [{ data: interval['v-s:numerationCommitedIntervalBegin'][0].data + ' - ' + (value - 1), type: "String" }],
                'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
                'v-s:numerationCommitedIntervalBegin': [{ data: interval['v-s:numerationCommitedIntervalBegin'][0].data, type: "Integer" }],
                'v-s:numerationCommitedIntervalEnd': [{ data: value - 1, type: "Integer" }]
              },
              _event_id
            );
            intervals.push(intervalUri);
          } else {
            // remove empty interval
            add_to_individual(ticket, {
              '@': interval['@'],
              'v-s:deleted': [{ data: true, type: "Boolean" }]
            }, false);
          }
        } else if ( (interval['v-s:numerationCommitedIntervalBegin'][0].data < value) && (value < interval['v-s:numerationCommitedIntervalEnd'][0].data) ) {
          // value strongly inside interval

          // cut current interval to value
          put_individual(
            ticket,
            {
              '@': interval['@'],
              'rdfs:label': [{ data: interval['v-s:numerationCommitedIntervalBegin'][0].data + ' - ' + (value - 1), type: "String" }],
              'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
              'v-s:numerationCommitedIntervalBegin': [{ data: interval['v-s:numerationCommitedIntervalBegin'][0].data, type: "Integer" }],
              'v-s:numerationCommitedIntervalEnd': [{ data: value - 1, type: "Integer" }]
            },
            _event_id
          );
          intervals.push(intervalUri);

          // add new interval from value
          var newIntervalUri = { data: Util$1.genUri() + "-intv", type: "Uri" };

          put_individual(
            ticket,
            {
              '@': newIntervalUri.data,
              'rdfs:label': [{ data: (value + 1) + ' - ' + interval['v-s:numerationCommitedIntervalEnd'][0].data, type: "String" }],
              'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
              'v-s:numerationCommitedIntervalBegin': [{ data: value + 1, type: "Integer" }],
              'v-s:numerationCommitedIntervalEnd': [{ data: interval['v-s:numerationCommitedIntervalEnd'][0].data, type: "Integer" }]
            },
            _event_id
          );
          intervals.push(newIntervalUri);
        } else {
          // value outside of interval
          intervals.push(intervalUri);
        }
      }

      scope['v-s:numerationCommitedInterval'] = intervals;
      put_individual(ticket, scope, _event_id);

    } catch (e) {
      print(e.stack);
    }
  }

  /**
   * General function for getNextValue method for numerators
   *
   * @param ticket
   * @param scope - numerator scope
   * @param FIRST_VALUE - first value in scope
   * @returns
   */
  Numerator.getNextValueSimple = function (ticket, scope, FIRST_VALUE) {
    if (typeof scope === 'string') {
      try {
        scope = get_individual(ticket, scope);
      } catch (e) {
        return ''+FIRST_VALUE;
      }
    }
    if (typeof scope === 'undefined' || !scope['v-s:numerationCommitedInterval'] || scope['v-s:numerationCommitedInterval'].length === 0) {
      return ''+FIRST_VALUE;
    }
    var max = 0;
    scope['v-s:numerationCommitedInterval'].forEach(function(interval) {
      var intervalUri = interval.data;
      try {
        interval = get_individual(ticket, intervalUri);
        if (interval['v-s:numerationCommitedIntervalEnd'][0].data > max) {
          max = interval['v-s:numerationCommitedIntervalEnd'][0].data;
        }
      } catch (err) {
        print ("ERR! intervalUri = ", intervalUri);
        //print ("ERR! interval=", intervalUri);
        print(err.stack);
      }

    });
    return ''+(max + 1);
  };

  // Veda server utility functions

  var Util$2 = veda.Util || {};

  veda.Util = Util$2;

  Util$2.getJournalUri = function (object_uri)
  {
      return object_uri + "j";
  };

  Util$2.getTraceJournalUri = function (object_uri)
  {
      return object_uri + "t";
  };

  Util$2.newJournalRecord = function (journal_uri)
  {
      var new_journal_record_uri = Util$2.genUri() + "-jr";

      var new_journal_record = {
          '@': new_journal_record_uri,
          'rdf:type': [
          {
              data: 'v-s:JournalRecord',
              type: "Uri"
          }],
          'v-s:parentJournal': [
          {
              data: journal_uri,
              type: "Uri"
          }],
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
      };
      return new_journal_record;
  };

  Util$2.logToJournal = function (ticket, journal_uri, journal_record, jr_type)
  {
      //if (!jr_type)
      //  print("@@@ logToJournal, new_journal_record=" + Util.toJson(journal_record));

      put_individual(ticket, journal_record, _event_id);

      var add_to_journal = {
          '@': journal_uri,
          'v-s:childRecord': [
          {
              data: journal_record['@'],
              type: "Uri"
          }]
      };

      //if (!jr_type)
      //  print("@@@ logToJournal, add_to_journal = " + Util.toJson(add_to_journal));

      //var before = get_individual(ticket, journal_uri);
      //print('BEFORE : '+Util.toJson(before))

      add_to_individual(ticket, add_to_journal, _event_id);

      //var after = get_individual(ticket, journal_uri);
      //print('AFTER : '+Util.toJson(after))
  };

  Util$2.traceToJournal = function (ticket, journal_uri, label, _data)
  {
      //print("@@@ traceToJournal, journal_uri=" + journal_uri + " #1");
      var journal_record = Util$2.newJournalRecord(journal_uri);

      journal_record['rdf:type'] = [
      {
          data: 'v-wf:TraceRecord',
          type: "Uri"
      }];
      journal_record['rdfs:label'] = [
      {
          data: label,
          type: "String"
      }];
      journal_record['rdfs:comment'] = [
      {
          data: _data,
          type: "String"
      }];

      Util$2.logToJournal(ticket, journal_uri, journal_record, true);

      //print("@@@ traceToJournal, journal_uri=" + journal_uri + ", " + Util.toJson(journal_record));
  };


  // DEPRECATED
  Util$2.isTecnicalChange = function (newdoc, olddoc)
  {
      if (newdoc['v-s:actualVersion'] && newdoc['v-s:actualVersion'][0].data != newdoc['@'])
      {
          olddoc = get_individual(ticket, newdoc['v-s:actualVersion'][0].data);
      }
      if (!olddoc)
      {
          // print (newdoc['@']+' x ');
          return false;
      }

      for (var key in newdoc)
      {
          if (key === '@') continue;

          if ((newdoc[key] && !olddoc[key]) // добвили
              ||
              (newdoc[key] && !olddoc[key]) // удалили
              ||
              (newdoc[key].length !== olddoc[key].length) // изменили количество
          )
          {
              if (!Util$2.isTechnicalAttribute(key, olddoc[key]))
              {
                  // в нетехническом атрибуте
                  //print (newdoc['@']+' x '+olddoc[key]+' >1> '+newdoc[key]+' : '+key);
                  return false;
              }
          }
          else
          {
              for (var item in newdoc[key])
              {
                  if (newdoc[key][item].data.valueOf() != olddoc[key][item].data.valueOf() && !Util$2.isTechnicalAttribute(key, olddoc[key][item].data))
                  { // поменялось одно из значений в нетехническом атрибуте
                      //print ('2 old:', Util.toJson(olddoc));
                      //print ('2 new:', Util.toJson(newdoc));
                      //print (newdoc['@']+' x '+olddoc[key][item].data+' >2> '+newdoc[key][item].data+' : '+key);
                      return false;
                  }
              }
          }
      }

      return true;
  };


  // DEPRECATED
  Util$2.isTechnicalAttribute = function (attName, oldvalue)
  {
      if (!oldvalue && attName === 'v-s:actualVersion') return true;
      if (!oldvalue && attName === 'v-s:previousVersion') return true;
      if (!oldvalue && attName === 'v-s:nextVersion') return true;
      if (attName === 'v-wf:hasStatusWorkflow') return true;
      return false;
  };

  Util$2.loadVariablesUseField = function (ticket, field)
  {
      var res = {};
      for (var idx in field)
      {
          var uri = field[idx].data;
          if (uri)
          {
              var indv = get_individual(ticket, uri);

              if ( Util$2.hasValue(indv, "rdf:type", {data: "v-s:Variable", type: "Uri"}) )
              {
                  var varName = Util$2.getFirstValue(indv['v-s:variableName']);
                  var varValue = Util$2.getValues(indv['v-s:variableValue']);
                  res[varName] = varValue;
              }
          }
      }
      return res;
  };

  Util$2.isAlphaNumeric = function (src)
  {
      if (!src)
          return false;
      var alphanum = /[a-zA-Z0-9]/;
      if (alphanum.test(src))
          return true;
      else
          return false;
  };

  Util$2.replace_word = function (src, from, to)
  {

      var new_str = src;
      //if (trace)
      //  print ('src=', src, ', from=', from, ', to=', to);

      var is_prepare = false;

      var pos_f = from.indexOf('*');
      var pos_t = to.indexOf('*');

      if (pos_f > 0 && pos_f > 0)
      {
          from = from.substring(0, pos_f);
          to = to.substring(0, pos_t);

          var pos_w_b = src.indexOf(from);
          var word;
          if (pos_w_b >= 0)
          {
              pos_w_b += from.length;
              var pos_w_e = pos_w_b;
              var ch = src.charAt(pos_w_e);
              while (Util$2.isAlphaNumeric(ch))
              {
                  pos_w_e++;
                  ch = src.charAt(pos_w_e);
              }
              if (pos_w_e > pos_w_b)
              {
                  word = src.substring(pos_w_b, pos_w_e);
                  //print ('is *1, from=', from, ", to=", to);
                  //print ('is *2, word=', word);
                  from = from + word;
                  to = to + word;
                  //print ('is *3, from=', from, ", to=", to);

                  is_prepare = true;
              }
          }
      }
      else
      {
          if (src.length == from.length)
              is_prepare = true;

          if (is_prepare == false)
          {
              var pos = src.indexOf(from);
              if (pos && pos >= 0)
              {
                  {
                      print('$replace_word #1 pos=', pos);
                  }

                  var last_ch = src[pos + from.length];

                  print('$replace_word #2 last_ch=[' + last_ch + ']');

                  if (last_ch && Util$2.isAlphaNumeric(last_ch) == false)
                  {
                      {
                          print('$replace_word !isAlphaNumeric last_ch=', last_ch);
                      }
                      is_prepare = true;
                  }
              }
          }
      }

      if (is_prepare)
      {
          new_str = src.replace(new RegExp(from, 'g'), to);
      }


      return new_str;
  };

  /**
   * Create document snapshot
   * @param ticket
   * @param document Document
   * @param prev_state Previous document state
   * @param user_uri Initiator
   * @param _event_id
   */
  Util$2.create_version = function (ticket, document, prev_state, user_uri, _event_id) {
    // Only if we save actual version of document (or it is first save of versioned document)
    if (
      !document['v-s:actualVersion']
      ||
      (
        document['v-s:actualVersion'][0].data === document['@']
        &&
        (
          (
            !document['v-s:previousVersion'] && (!prev_state || !prev_state['v-s:previousVersion'])
          )
          ||
          (
            prev_state
            && document['v-s:previousVersion']
            && prev_state['v-s:previousVersion']
            && document['v-s:previousVersion'][0].data === prev_state['v-s:previousVersion'][0].data
          )
        )
      )
    ) {
      var user = get_individual(ticket, user_uri);
      var appointment_uri = Util$2.getUri(user["v-s:defaultAppointment"]) || Util$2.getUri(user["v-s:hasAppointment"]);
      var actor_uri = appointment_uri || user_uri;

      if (!prev_state) prev_state = document;
      var actualId = document['@'];
      var versionId = Util$2.genUri() + "-vr";

      // Create new version
      var version = get_individual(ticket, document['@']);
      version['@'] = versionId;
      if (prev_state['v-s:previousVersion']) {
        version['v-s:previousVersion'] = prev_state['v-s:previousVersion'];
      } else {
        version['v-s:previousVersion'] = [];
      }
      version['v-s:actualVersion'] = [{
        data: document['@'],
        type: "Uri"
      }];
      version['v-s:nextVersion'] = [{
        data: actualId,
        type: "Uri"
      }];
      version['rdf:type'] = version['rdf:type'].concat(
        [{
          data: "v-s:Version",
          type: "Uri"
        }]
      );
      version['v-s:created'] = [{data: new Date(), type: "Datetime"}];
      version['v-s:edited'] = [];
      version['v-s:creator'] = Util$2.newUri(actor_uri);
      version['v-s:lastEditor'] = [];

      put_individual(ticket, version, _event_id);

      // Add rights to version
      var membership_uri = 'd:membership_' + versionId.split(':').join('_') + '_' + actualId.split(':').join('_');
      var membership = {
        '@' : membership_uri,
        'rdf:type'     : Util$2.newUri('v-s:Membership'),
        'v-s:memberOf' : Util$2.newUri(actualId),
        'v-s:resource' : Util$2.newUri(versionId),
        'rdfs:comment' : Util$2.newStr('создано: server script Util.create_version ()'),
        'v-s:canRead'  : Util$2.newBool(true)
      };
      put_individual (ticket, membership, _event_id);

      // Update previous version
      if (document['v-s:previousVersion']) {
        var previous = get_individual(ticket, Util$2.getUri(document['v-s:previousVersion']));
        previous['v-s:nextVersion'] = [{
          data: versionId,
          type: "Uri"
        }];
        put_individual(ticket, previous, _event_id);
      }

      // Update actual version
      document['v-s:previousVersion'] = [{
        data: versionId,
        type: "Uri"
      }];
      document['v-s:actualVersion'] = [{
        data: document['@'],
        type: "Uri"
      }];
      document['v-s:nextVersion'] = [];
      document['v-s:edited'] = [{data: new Date(), type: "Datetime"}];
      document['v-s:lastEditor'] = Util$2.newUri(actor_uri);
      put_individual(ticket, document, _event_id);
    }
  };

  Util$2.recursiveCall = function (elem, path, ticket, _event_id) {
    if (path[elem['@']]) {
      print('WARNING! Recursive path '+Util$2.toJson(path)+' > '+elem['a']);
      return;
    }

    path[elem['@']] = Object.keys(path).length;
    if (elem['v-wf:decisionFormList']) {
      elem['v-wf:decisionFormList'].forEach(function(dfae) {
        var df = get_individual(ticket, dfae.data);
        if (!df['v-wf:isCompleted'] || df['v-wf:isCompleted'][0].data == false) {
          df['v-s:deleted'] = Util$2.newBool(true);
          df['v-wf:isStopped'] = Util$2.newBool(true);
          put_individual(ticket, df, _event_id);
        }
      });
    }

    if (elem['v-wf:workItemList']) {
      elem['v-wf:workItemList'].forEach(function(wi) {
        Util$2.recursiveCall(get_individual(ticket, wi.data), path, ticket, _event_id);
      });
    }

    if (elem['v-wf:workOrderList']) {
      elem['v-wf:workOrderList'].forEach(function(wo) {
        Util$2.recursiveCall(get_individual(ticket, wo.data), path, ticket, _event_id);
      });
    }

    if (elem['v-wf:isProcess']) {
      elem['v-wf:isProcess'].forEach(function(p) {
        var df = get_individual(ticket, p.data);
        if (!df['v-wf:isCompleted'] || df['v-wf:isCompleted'][0].data == false) {
          df['v-wf:isStopped'] = Util$2.newBool(true);
          put_individual(ticket, df, _event_id);
        }
        Util$2.recursiveCall(df, path, ticket, _event_id);
      });
    }
  };

  Util$2.set_err_on_indv = function (msg, indv, src)
  {
      var bugreport = {
        '@' : Util$2.genUri () + '-err',
        'rdf:type'     : Util$2.newUri('v-s:BugReport'),
        'v-s:created'  : Util$2.newDate (new Date()),
        'rdfs:comment' : Util$2.newStr(src),
        'v-s:errorMessage' : Util$2.newStr (msg),
        'v-s:resource': Util$2.newUri (indv['@'])
      };
      put_individual(ticket, bugreport, _event_id);

      var add_to_indv = {
          '@': indv['@'],
          'v-s:hasError': Util$2.newUri (bugreport['@'])
          };
      add_to_individual(ticket, add_to_indv, _event_id);

      print("ERR! " + src + ':' +  msg);
  };

  Util$2.set_field_to_document = function (field_name, value, doc_id)
  {
      var set_in_document = {
      '@': doc_id
      };

      set_in_document[field_name] = value;
      set_in_individual(ticket, set_in_document, _event_id);
  };

  /**
   * Трансформировать указанные индивидуалы по заданным правилам
   *
   * @param ticket сессионный билет
   * @param individuals один или несколько IndividualModel или их идентификаторов
   * @param transform применяемая трансформация
   * @param executor контекст исполнителя
   * @param work_order контекст рабочего задания
   * @returns {Array}
   */
  Util$2.transformation = function (ticket, individuals, transform, executor, work_order, process)
  {
    try
    {
      var out_data0 = {};

      if (Array.isArray(individuals) !== true)
      {
        individuals = [individuals];
      }

      var rules = transform['v-wf:transformRule'];

      if (!rules || !rules.length)
        return;

      //print ("@B start transform");
      var tmp_rules = [];
      //print ("rules_in=", Util.toJson (rules));
      //print ("individuals=", Util.toJson (individuals));
      for (var i in rules)
      {
        var rul = get_individual(ticket, rules[i].data);
        if (!rul)
        {
          print("not read rule [", Util$2.toJson(rul), "]");
          continue;
        }
        else
          tmp_rules.push(rul);
      }
      rules = tmp_rules;

      var out_data0_el = {};

      /* PUT functions [BEGIN] */
      var putFieldOfIndividFromElement = (function()
      {
        return function(name, field)
        {
          var rr = get_individual(ticket, Util$2.getUri(element));
          if (!rr)
            return;

          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(rr[field]);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putFieldOfObject = (function()
      {
        return function(name, field)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
              out_data0_el_arr = [];

          out_data0_el_arr.push(individual[field]);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putUri = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Uri"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setUri = function(name, value)
      {
        out_data0_el[name] = [
        {
          data: value,
          type: "Uri"
        }];
      };

      var putString = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "String"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setString = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "String"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setDatetime = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Datetime"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putDatetime = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Datetime"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putBoolean = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Boolean"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setBoolean = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Boolean"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();


      var putInteger = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Integer"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setInteger = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Integer"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putExecutor = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(executor) === true)
          {
            for (var key3 in executor)
            {
              out_data0_el_arr.push(executor[key3]);
            }
          }
          else
            out_data0_el_arr.push(executor);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putWorkOrder = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(work_order) === true)
          {
            for (var key3 in work_order)
            {
              out_data0_el_arr.push(work_order[key3]);
            }
          }
          else
            out_data0_el_arr.push(work_order);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putThisProcess = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(process) === true)
          {
            for (var key3 in process)
            {
              out_data0_el_arr.push(process[key3]);
            }
          }
          else
            out_data0_el_arr.push(process);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var removeThisProcess = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(process) === true)
          {
            for (var key3 in process)
            {
              out_data0_el_arr = out_data0_el_arr.filter(function (value) {return value.data !== process[key3];});
            }
          }
          else
          {
            out_data0_el_arr = out_data0_el_arr.filter(function (value) {return value.data !== process;});
          }

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      /* PUT functions [END] */

      for (var key in individuals)
      {
        //print("#1 key=", key);
        var individual = individuals[key];

        //print("#1.1 key=", key);
        var objectContentStrValue = (function()
        {
          return function(name, value)
          {
            if (individual[name])
            {
              var result = false;
              for (var i in individual[name])
              {
                if (value === individual[name][i].data)
                {
                  result = true;
                }
              }
              return result;
            }
          };
        })();

        var iteratedObject = Object.keys(individual);

        for (var key2 = 0; key2 < iteratedObject.length; key2++)
        {
          var element = individual[iteratedObject[key2]];

          var putValue = (function()
          {
            return function(name)
            {
              var out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr)
                out_data0_el_arr = [];

              if (iteratedObject[key2] == '@')
              {
                out_data0_el_arr.push(
                {
                  data: element,
                  type: "Uri"
                });
              }
              else
              {
                if (Array.isArray(element) === true)
                {
                  for (var key3 in element)
                  {
                    out_data0_el_arr.push(element[key3]);
                  }
                }
                else
                  out_data0_el_arr.push(element);
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          var putValueFrom = (function()
          {
            return function(name, path, transform)
            {
              var out_data0_el_arr = out_data0_el[name];
              if (!out_data0_el_arr)
                out_data0_el_arr = [];

              var element_uri;

              if (Array.isArray(element) === true)
                element_uri = Util$2.getUri (element);
              else
                element_uri = element.data ? element.data : element;

              var curelem;

              curelem = get_individual(ticket, element_uri);

              for (var i = 0; i < path.length - 1; i++)
              {
                if (!curelem || !curelem[path[i]]) return;
                var uri = Array.isArray(curelem[path[i]]) && curelem[path[i]][0].data ? curelem[path[i]][0].data : curelem[path[i]];
                curelem = get_individual(ticket, uri);
              }
              if (!curelem || !curelem[path[path.length - 1]]) return;

              out_data0_el_arr = out_data0_el_arr.concat(curelem[path[path.length - 1]]);

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          var putFrontValue = (function()
          {
            return function(name)
            {
              var out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr)
                out_data0_el_arr = [];
              if (iteratedObject[key2] == '@')
              {
                out_data0_el_arr.unshift(
                {
                  data: element,
                  type: "Uri"
                });
              }
              else
              {
                if (Array.isArray(element) === true)
                {
                  for (var key3 in element)
                  {
                    out_data0_el_arr.unshift(element[key3]);
                  }
                }
                else
                  out_data0_el_arr.unshift(element);
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          var putElement = (function()
          {
            return function()
            {
              var name = iteratedObject[key2];
              if (name == '@')
                return;

              var out_data0_el_arr = [];
              out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr)
                out_data0_el_arr = [];

              if (Array.isArray(element) === true)
              {
                for (var key3 in element)
                {
                  out_data0_el_arr.push(element[key3]);
                }
              }
              else
                out_data0_el_arr.push(element);

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          /* Segregate functions [BEGIN] */
          var contentName = (function()
          {
            return function(name)
            {
              return iteratedObject[key2] == name;
            };
          })();

          var elementContentStrValue = (function()
          {
            return function(name, value)
            {
              if (iteratedObject[key2] !== name)
                return false;
              var str = element[0].data;
              if (str == value)
                return true;
              else
                return false;
            };
          })();
          /* Segregate functions [END] */

          var getElement = (function()
          {
            return function()
            {
              return element;
            };
          })();


          // выполняем все rules
          for (var key3 in rules)
          {
            var rule = rules[key3];
            // 1. v-wf:segregateObject
            var segregateObject = rule['v-wf:segregateObject'];

            // 2. v-wf:segregateElement
            var segregateElement = rule['v-wf:segregateElement'];
            var grouping = rule['v-wf:grouping'];

            var res = undefined;

            if (segregateObject)
            {
              res = eval(segregateObject[0].data);
              if (res == false)
                continue;
            }

            if (segregateElement)
            {
              res = eval(segregateElement[0].data);
              if (res == false)
                continue;
            }

            // 3. v-wf:aggregate
            var group_key;
            if (!grouping)
            {
              out_data0_el = {};
              out_data0_el['@'] = Util$2.genUri() + "-tr";
            }
            else
            {
              var useExistsUid = false;
              for (var i in grouping)
              {
                var gk = grouping[i].data;
                if (gk == '@')
                  useExistsUid = true;
                else
                  group_key = gk;
              }

              out_data0_el = out_data0[group_key];
              if (!out_data0_el)
              {
                out_data0_el = {};
                if (useExistsUid)
                  out_data0_el['@'] = individual['@'];
                else
                  out_data0_el['@'] = Util$2.genUri() + "-tr";
              }
            }

            var agregate = rule['v-wf:aggregate'];
            for (var i2 = 0; i2 < agregate.length; i2++)
            {
              eval(agregate[i2].data);
            }

            if (!grouping)
            {
              out_data0[out_data0_el['@']] = out_data0_el;
            }
            else
            {
              out_data0[group_key] = out_data0_el;
            }
          }
        }
      }

      var out_data = [];
      for (var key in out_data0)
      {
        out_data.push(out_data0[key]);
      }

      return out_data;
    }
    catch (e)
    {
      console.log(e.stack);
    }
  };

  veda.ticket = get_env_str_var("$ticket");

  AppModel.call(veda);

  veda.init("cfg:VedaSystem");

  console.log("user:", veda.user.id, "| ticket:", veda.ticket);

  return veda;

}());
