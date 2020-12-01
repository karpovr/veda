// Veda common utility functions

function newUri(uri)
{
  return [{
    data: uri,
    type: "Uri"
  }];
}

import veda from "../common/veda.js";

import IndividualModel from "../common/individual_model.js";

import OntologyModel from "../common/ontology_model.js";

import Backend from "../common/backend.js";

import Sha256 from "../common/lib/sha256.js";

var Util = veda.Util || {};

export default veda.Util = Util;

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
  }
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
};

function randomInRange(begin, end) {
  return Math.round(Math.random() * (end - begin) + begin);
};

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
};
function formatNumber (n) {
  return (n+"").replace(/.(?=(?:[0-9]{3})+\b)/g, '$& ');
};

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
}
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

        })
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
