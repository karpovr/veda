// Veda common utility functions

function newUri(uri)
{
  return [{
    data: uri,
    type: "Uri"
  }];
}

veda.Module(function (veda) { "use strict";

  veda.Util = veda.Util || {};

  veda.Util.hasValue = function(individual, property, value) {
    var any = !!(individual && individual[property] && individual[property].length);
    if (!value) return any;
    return !!(any && individual[property].filter( function(i) {
      return (i.type === value.type && i.data.valueOf() === value.data.valueOf());
    }).length);
  };

  veda.Util.toJson = function (value) {
    return JSON.stringify(value, null, 2);
  };

  veda.Util.generate_passes = function (length, count) {
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

  veda.Util.simpleHash = function (str) {
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

  veda.Util.processQuery = function (q, sort, limit, delta, pause, fn) {
    if (typeof q === "object") {
      sort  = q.sort;
      limit = q.limit;
      delta = q.delta;
      pause = q.pause;
      fn    = q.fn;
      q     = q.query;
    }
    console.log((new Date()).toISOString(), "Process query results |||", "query:", q, " | ", "limit:", limit, " | ", "delta:", delta, " | ", "pause:", pause);
    var result = [], append = [].push, fetchingProgress = 0;
    console.time("Fetching total");
    fetchResult();
    return;

    function fetchResult(cursor) {
      var from = cursor || 0;
      veda.Backend.query({
        ticket: veda.ticket,
        query: q,
        sort: sort || "'v-s:created' desc",
        from: from,
        top: delta,
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
          veda.Util.processResult(result, delta, pause, fn);
        } else {
          fetchResult(query_result.cursor);
        }
      });
    }
  };

  veda.Util.processResult = function (result, delta, pause, fn) {
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

  veda.Util.genUri = function () {
    var uid = veda.Util.guid(), re = /^\d/;
    return (re.test(uid) ? "d:a" + uid : "d:" + uid);
  };
  veda.Util.guid = function () {
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

  veda.Util.isInteger = function (n) { return n % 1 === 0; };

  function zeroPref(n) {
    return n > 9 ? n : "0" + n;
  }

  veda.Util.formatValue = function (value) {
    var formatted;
    switch (true) {
      case value instanceof Date:
        formatted = formatDate(value);
        break;
      case value instanceof Number || typeof value === "number":
        formatted = formatNumber(value);
        break;
      default:
        formatted = typeof value !== "undefined" ? value.toString() : value;
    }
    return formatted;
  };
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

  veda.Util.forSubIndividual = function (net, property, id, func) {
    if (net[property] === undefined) { return; }
    net[property].forEach(function(el) {
      if (el.id == id) {
        func(el);
      }
    });
  };

  veda.Util.removeSubIndividual = function (net, property, id) {
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
  veda.Util.flatten = function (array, mutable) {
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

  veda.Util.unique = function (arr) {
    var n = {}, r = [];
    for(var i = 0; i < arr.length; i++) {
      if (!n[arr[i]]) {
        n[arr[i]] = true;
        r.push(arr[i]);
      }
    }
    return r;
  };

  veda.Util.queryFromIndividualPT = function (individual) {
    var flat = flattenIndividual(individual.properties);
    if ( individual.hasValue("*") && individual.get("*")[0].indexOf("==") > 0 ) {
      return;
    }
    var tables = [];
    var allProps = Object.getOwnPropertyNames(flat)
      .map(function (property_uri, i) {

        var table = "veda_pt.`" + property_uri + "` as p" + i;
        tables[i] = table ;

        if (property_uri === "@") { return; }
        var values = flat[property_uri].sort(function (a, b) {
          return a.data < b.data ? - 1 : a.data === b.data ? 0 : 1;
        });
        var oneProp;
        switch (values[0].type) {
          case "Integer":
            oneProp = "p" + i + ".int[1] >= " + values[0].data + " AND p" + i + ".int[1] <= " + values[values.length-1].data;
            break;
          case "Decimal":
            oneProp = "p" + i + ".dec[1] >= " + values[0].data + " AND p" + i + ".dec[1] <= " + values[values.length-1].data;
            break;
          // Date
          case "Datetime":
            var start = new Date(values[0].data);
            var end = new Date(values[values.length-1].data);
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            start = Math.floor(start.valueOf() / 1000);
            end = Math.floor(end.valueOf() / 1000);
            oneProp = "p" + i + ".date[1] >= toDateTime(" + start + ") AND p" + i + ".date[1] <= toDateTime(" + end + ")";
            break;
          case "Boolean":
            oneProp = values
              .map(function (value) {
                return "p" + i + ".int[1] = " + (value ? 1 : 0);
              }).join(" OR ");
            break;
          case "String":
            oneProp = values
              .filter(function(item){return !!item && !!item.valueOf();})
              .map( function (value) {
                var q = value.data;
                var lines = q.trim().split("\n");
                var lineQueries = lines.map(function (line) {
                  var words = line.trim().replace(/[-*\s]+/g, " ").split(" ");
                  line = words.map(function (word) { return "%" + word + "%"; }).join(" ");
                  return "p" + i + ".str[1] LIKE '" + line + "'";
                });
                return lineQueries.join(" OR ");
              })
              .join(" OR ");
            break;
          case "Uri":
            oneProp = values
              .filter(function(item){return !!item && !!item.valueOf();})
              .map( function (value) {
                return "p" + i + ".str[1] = '" + value.data + "'";
              })
              .join(" OR ");
            break;
        }
        return oneProp ? "( " + oneProp + " )" : undefined;
      })
      .filter(function(item){return typeof item !== undefined;})
      .join(" AND ");
    var where = allProps ? "( " + allProps + " )" : undefined;
    var from = tables.reduce(function (acc, table, i) {
      return i > 0 ? acc + " JOIN " + table + " ON p" + (i - 1) + ".id = p" + i + ".id" : table;
    }, "")
    var query = "SELECT DISTINCT id FROM " + from + " WHERE " + where;
    return query;
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

  veda.Util.queryFromIndividualTT = function (individual, visited) {
    visited = visited || {};
    if (individual in visited) {
      return;
    } else {
      visited[individual] = true;
    }
    if ( individual.hasValue("*") && individual.get("*")[0].indexOf("==") > 0 ) {
      return individual.get("*")[0];
    }
    var re = /[^a-zA-Z0-9]/g;
    var allProps = Object.keys(individual.properties)
      .map(function (property_uri, i) {
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
            var start = values[0];
            var end = values[values.length-1];
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
                  var words = line.trim().replace(/[-*\s]+/g, " ").split(" ");
                  line = words.map(function (word) { return "%" + word + "%"; }).join(" ");
                  return prop + "_str[1] LIKE '" + line + "'";
                });
                return lineQueries.join(" OR ");
              })
              .join(" OR ");
            break;
          case values[0] instanceof veda.IndividualModel:
            oneProp = values
              .filter(Boolean)
              .map( function (value) {
                if ( value.isNew() ) {
                  var sub = veda.Util.queryFromIndividualTT(value, visited);
                  return sub ? prop + "_str[1] IN ( " + sub + " )" : undefined;
                } else {
                  return prop + "_str[1] = '" + value + "'";
                }
              })
              .filter(Boolean)
              .join(" OR ");
            break;
        }
        return oneProp ? "( " + oneProp + " )" : undefined;
      })
      .filter(Boolean)
      .join(" AND ");

    var where = allProps ? "( " + allProps + " )" : undefined;

    if (Object.keys(visited).length > 1 && !where) { return; }

    return individual.get("rdf:type").map(function (type) {
      var from = "veda_tt.`" + type.id + "`";
      var query = "SELECT DISTINCT id FROM " + from + (where ? " WHERE " + where : "");
      return query;
    })
    .filter(Boolean)
    .join(" UNION ALL ");
  };

  veda.Util.queryFromIndividualTTJ = function (individual, visited) {
    visited = visited || {};
    if (individual in visited) {
      return;
    } else {
      visited[individual] = true;
    }
    if ( individual.hasValue("*") && individual.get("*")[0].indexOf("==") > 0 ) {
      return individual.get("*")[0];
    }
    var re = /[^a-zA-Z0-9]/g;
    var allProps = Object.keys(individual.properties)
      .map(function (property_uri, i) {
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
            var start = values[0];
            var end = values[values.length-1];
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
                  var words = line.trim().replace(/[-*\s]+/g, " ").split(" ");
                  line = words.map(function (word) { return "%" + word + "%"; }).join(" ");
                  return prop + "_str[1] LIKE '" + line + "'";
                });
                return lineQueries.join(" OR ");
              })
              .join(" OR ");
            break;
          case values[0] instanceof veda.IndividualModel:
            oneProp = values
              .filter(Boolean)
              .map( function (value) {
                if ( value.isNew() ) {
                  var sub = veda.Util.queryFromIndividualTT(value, visited);
                  return sub ? prop + "_str[1] IN ( " + sub + " )" : undefined;
                } else {
                  return prop + "_str[1] = '" + value + "'";
                }
              })
              .filter(Boolean)
              .join(" OR ");
            break;
        }
        return oneProp ? "( " + oneProp + " )" : undefined;
      })
      .filter(Boolean)
      .join(" AND ");

    var where = allProps ? "( " + allProps + " )" : undefined;

    if (Object.keys(visited).length > 1 && !where) { return; }

    return individual.get("rdf:type").map(function (type) {
      var from = "veda_tt.`" + type.id + "`";
      var query = "SELECT DISTINCT id FROM " + from + (where ? " WHERE " + where : "");
      return query;
    })
    .filter(Boolean)
    .join(" UNION ALL ");
  };

  veda.Util.queryFromIndividual = function (individual) {
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
                    var words = line.trim().replace(/[-*\s]+/g, " ").split(" ");
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

    console.log(veda.Util.queryFromIndividualPT(individual));
    console.log(veda.Util.queryFromIndividualTT(individual));
    console.log(veda.Util.queryFromIndividualTTJ(individual));

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
          var individ = new veda.IndividualModel(value.data);
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

  veda.Util.complexLabel = function (individual) {

    individual = individual.properties || individual;
    var cache = {};
    cache[ individual["@"] ] = individual;
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
        if ( !type || !veda.Util.hasValue(type, "v-s:labelPattern") ) { return acc; }
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
                  if (data instanceof Date) {
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
          if (veda.Util.hasValue(item, property)) {
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

  veda.Util.clone = function (obj) {
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
        copy[i] = veda.Util.clone(obj[i]);
      }
      return copy;

    } else if (obj instanceof Object) {

      // Handle Object
      copy = {};
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = veda.Util.clone(obj[attr]);
      }
      return copy;

    } else {

      throw new Error("Unable to copy obj! Its type isn't supported.");

    }

  };

  veda.Util.addToGroup = function (ticket, group, resource, allow, deny) {

    var new_membership_uri = veda.Util.genUri() + "-mbh";
    var new_membership = {
      '@': new_membership_uri,
      'rdf:type': veda.Util.newUri('v-s:Membership'),
      'v-s:memberOf': veda.Util.newUri(group),
      'v-s:resource': veda.Util.newUri(resource)
    };

    (allow || []).forEach(function (right) {
      new_membership[right] = veda.Util.newBool(true);
    });

    (deny || []).forEach(function (right) {
      new_membership[right] = veda.Util.newBool(false);
    });

    var res = put_individual(ticket, new_membership);
    return [new_membership, res];
  };

  veda.Util.removeFromGroup = function (ticket, group, resource) {

    var new_membership_uri = veda.Util.genUri() + "-mbh";
    var new_membership = {
      '@': new_membership_uri,
      'rdf:type': veda.Util.newUri('v-s:Membership'),
      'v-s:memberOf': veda.Util.newUri(group),
      'v-s:resource': veda.Util.newUri(resource),
      'v-s:deleted': veda.Util.newBool(true)
    };

    var res = put_individual(ticket, new_membership);
    return [new_membership, res];
  };

  veda.Util.addRight = function (ticket, subj_uri, obj_uri, allow, deny) {

    if (subj_uri === undefined || obj_uri === undefined) {
      var error = new Error("veda.Util.addRight: INVALID ARGS");
      console.log("subj_uri =", subj_uri);
      console.log("obj_uri =", obj_uri);
      console.log("Error stack:", error.stack);
      return;
    }

    var uri = veda.Util.genUri() + "-r";

    var permission = {
      '@': uri,
      'rdf:type': veda.Util.newUri('v-s:PermissionStatement'),
      'v-s:permissionObject': veda.Util.newUri(obj_uri),
      'v-s:permissionSubject': veda.Util.newUri(subj_uri)
    };

    (allow || []).forEach(function (right) {
      permission[right] = veda.Util.newBool(true);
    });

    (deny || []).forEach(function (right) {
      permission[right] = veda.Util.newBool(false);
    });

    var res = put_individual(ticket, permission);
    return [permission, res];
  };

  veda.Util.newUri = function (uri) {
    return [{
      data: uri,
      type: "Uri"
    }];
  };

  veda.Util.newStr = function (_data, _lang) {
    var value = {
      data: _data,
      type: "String"
    };
    if (_lang && _lang !== 'NONE') {
      value.lang = _lang;
    }
    return [ value ];
  };

  veda.Util.newStrFromBundle = function (_bundle1, _bundle2, _sep) {
    if (!_sep)
      _sep = ' ' ;
    var str = _bundle1['rdfs:label'][0] + _sep + _bundle2['rdfs:label'][0] ;
    return str ;
  };

  veda.Util.newBool = function (_data) {
    return [{
      data: _data,
      type: "Boolean"
    }];
  };

  veda.Util.newInt = function (_data) {
    return [{
      data: _data,
      type: "Integer"
    }];
  };

  veda.Util.newDecimal = function (_data) {
    return [{
      data: _data,
      type: "Decimal"
    }];
  };

  veda.Util.newDate = function (_data) {
    return [{
      data: _data,
      type: "Datetime"
    }];
  };

  veda.Util.addDay = function (_data, _days) {
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

  veda.Util.getValues = function (property_value) {
    var res = [];
    if (property_value) {
      for (var i in property_value) {
        res.push(property_value[i].data);
      }
    }
    return res;
  };

  veda.Util.getUris = function (property_value) {
    var res = [];
    if (property_value) {
      for (var i in property_value) {
        res.push(property_value[i].data);
      }
    }
    return res;
  };

  veda.Util.getStrings = function (property_value) {
    var res = [];
    if (property_value) {
      for (var i in property_value) {
        res.push(property_value[i].data);
      }
    }
    return res;
  };

  veda.Util.getUri = function (property_value) {
    if (property_value && property_value.length > 0) {
      return property_value[0].data;
    }
  };

  veda.Util.getFirstValue = function (property_value) {
    if (property_value && property_value.length > 0) {
      if (property_value[0].type == "Integer") {
        return parseInt(property_value[0].data, 10);
      } else if (property_value[0].type == "Datetime") {
        return new Date(property_value[0].data);
      }
      return property_value[0].data;
    }
  };

  veda.Util.getFirstValueUseLang = function (property_value, lang) {
    for (var i in property_value) {
      if (property_value[i].lang == lang) {
        return property_value[i].data;
      }
    }
    return null;
  };

  veda.Util.mlstring = function (ruString, enString) {
    return [{type: "String", data: ruString, lang: "RU"}, {type: "String", data: enString, lang: "EN"}];
  };

  // Returns literal value or resource id for given property chain
  veda.Util.getPropertyChain = function () {
    var value = arguments[0];
    var argsLength = arguments.length;
    if (typeof value === "string") {
      value = get_individual(veda.ticket, value);
    }
    var i, property_uri, type;
    for (i = 1; i < argsLength; i++) {
      property_uri = arguments[i];
      if ( veda.Util.hasValue(value, property_uri) ) {
        type = value[property_uri][0].type;
        value = value[property_uri][0].data;
        if (i === (argsLength - 1) ) {
          return value;
        } else if (type === "Uri") {
          value = get_individual(veda.ticket, value);
          continue;
        }
      }
      return;
    }
    return value;
  };

  veda.Util.areEqual = function (x, y) {
    if ( x === y ) return true;
    if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
    if ( x.constructor !== y.constructor ) return false;
    for ( var p in x ) {
      if ( ! x.hasOwnProperty( p ) ) continue;
      if ( ! y.hasOwnProperty( p ) ) return false;
      if ( x[ p ] === y[ p ] ) continue;
      if ( typeof( x[ p ] ) !== "object" ) return false;
      if ( ! veda.Util.areEqual( x[ p ],  y[ p ] ) ) return false;
    }
    for ( p in y ) {
      if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
    }
    return true;
  };

});
