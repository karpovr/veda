// Veda common utility functions

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import Backend from '../common/backend.js';

const Util = veda.Util || {};

export default veda.Util = Util;

Util.mergeMutualChanges = function (high, low, base) {
  let key; const merged = {};
  for (key in base) {
    if (Object.hasOwnProperty.call(base, key)) {
      merged[key] = base[key];
    }
  }
  const highBaseDiff = Util.diff(high, base);
  const lowBaseDiff = Util.diff(low, base);
  const highLowDiff = Util.diff(high, low);
  const lowHighDiff = Util.diff(low, high);
  for (key in lowBaseDiff.missing) {
    if (Object.hasOwnProperty.call(lowBaseDiff.missing, key)) {
      delete merged[key];
    }
  }
  for (key in highBaseDiff.missing) {
    if (Object.hasOwnProperty.call(highBaseDiff.missing, key)) {
      delete merged[key];
    }
  }
  for (key in lowBaseDiff.added) {
    if (Object.hasOwnProperty.call(lowBaseDiff.added, key)) {
      merged[key] = lowBaseDiff.added[key];
    }
  }
  for (key in highBaseDiff.added) {
    if (Object.hasOwnProperty.call(highBaseDiff.added, key)) {
      merged[key] = highBaseDiff.added[key];
    }
  }
  for (key in lowBaseDiff.differ) {
    if (Object.hasOwnProperty.call(lowBaseDiff.differ, key)) {
      merged[key] = lowBaseDiff.differ[key];
    }
  }
  for (key in highBaseDiff.diff) {
    if (Object.hasOwnProperty.call(highBaseDiff.diff, key)) {
      merged[key] = highBaseDiff.differ[key];
    }
  }
  return {
    merged: merged,
    conflicts: {
      high: highLowDiff.differ,
      low: lowHighDiff.differ,
    },
  };
};

Util.diff = function (changed, base) {
  const delta = {
    added: {},
    missing: {},
    differ: {},
  };
  let key; let values; let value; let length; let i; let hasValue;
  for (key in base) {
    if ( !(key in changed) ) {
      delta.missing[key] = base[key];
    } else {
      if (key === '@') {
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
  return key === 'data' && this.type === 'Datetime' ? new Date(value) : key === 'data' && this.type === 'Decimal' ? parseFloat(value) : value;
};

Util.hasValue = function(individual, property, value) {
  const any = !!(individual && individual[property] && individual[property].length);
  if (!value) return any;
  return !!(any && individual[property].filter( function(i) {
    return (i.type === value.type && i.data.valueOf() === value.data.valueOf());
  }).length);
};

Util.toJson = function (value) {
  return JSON.stringify(value, null, 2);
};

Util.simpleHash = function (str) {
  let hash = 0; let char;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    char = str.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash;
  }
  return hash;
};

Util.processQuery = function (vql, sql, sort, limit, queryDelta, processDelta, pause, fn) {
  const fetchResult = function (cursor) {
    const from = cursor || 0;
    Backend.query({
      ticket: veda.ticket,
      query: vql,
      sql: sql,
      sort: sort || '\'v-s:created\' desc',
      from: from,
      top: queryDelta,
      limit: limit,
    }).then(function (query_result) {
      const cursor = query_result.cursor;
      const estimated = query_result.estimated;
      if ( limit > estimated ) {
        limit = estimated;
      }
      append.apply(result, query_result.result);
      if ( cursor/limit - fetchingProgress >= 0.05 ) {
        fetchingProgress = cursor/limit;
        console.log('Fetching progress:', Math.floor(fetchingProgress * 100) + '%', '(' + cursor, 'of', limit + ')');
      }
      if ( cursor === estimated || cursor >= limit ) {
        console.log((new Date()).toString(), 'Fetching done:', limit);
        console.timeEnd('Fetching total');
        result.splice(limit - cursor || limit); // cut result to limit
        Util.processResult(result, processDelta, pause, fn);
      } else {
        fetchResult(query_result.cursor);
      }
    });
  };

  if (typeof vql === 'object') {
    sort = vql.sort;
    limit = vql.limit;
    queryDelta = vql.queryDelta;
    processDelta = vql.processDelta;
    pause = vql.pause;
    fn = vql.fn;
    sql = vql.sql;
    vql = vql.vql;
  }
  console.log((new Date()).toISOString(), 'Process query results |||', 'query:', vql || sql, ' | ', 'limit:', limit, ' | ', 'query delta:', queryDelta, ' | ', 'process delta:', processDelta, ' | ', 'pause:', pause);
  const result = []; const append = [].push; let fetchingProgress = 0;
  console.time('Fetching total');
  fetchResult();
  return;
};

Util.processResult = function (result, delta, pause, fn) {
  const processPortion = function () {
    const portion = result.splice(0, delta);
    portion.reduce(function (prom, item) {
      return prom.then(function () {
        return fn(item);
      }).catch(function (error) {
        console.log('Error processing item:', item);
        console.log(error, error.stack);
      });
    }, Promise.resolve()).then(function () {
      if ( (total - result.length) / total - processingProgress >= 0.05 ) {
        processingProgress = (total - result.length) / total;
        console.log('Processing progress:', Math.floor(processingProgress * 100) + '%', '(' + (total - result.length), 'of', total + ')');
      }
      if ( result.length ) {
        setTimeout ? setTimeout(processPortion, pause) : processPortion();
      } else {
        console.log('Processing done:', total);
        console.timeEnd('Processing total');
      }
    });
  };

  const total = result.length;
  let processingProgress = 0;
  console.log((new Date()).toISOString(), 'Process results |||', 'total:', total, ' | ', 'delta:', delta, ' | ', 'pause:', pause);
  console.time('Processing total');
  processPortion();
};

Util.genUri = function () {
  const uid = Util.guid(); const re = /^\d/;
  return (re.test(uid) ? 'd:a' + uid : 'd:' + uid);
};
Util.guid = function () {
  let d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); // use high-precision timer if available
  }
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, function (c) {
    const r = (d + Math.random() * 36) % 36 | 0;
    d = Math.floor(d / 36);
    return r.toString(36);
  });
};

Util.isInteger = function (n) {
  return n % 1 === 0;
};

/**
 * Prefix with 0 if number has single digit
 * @param {number} n
 * @return {string}
 */
function zeroPref(n) {
  return n > 9 ? String(n) : '0' + n;
}

Util.formatValue = function (value) {
  let formatted;
  switch (true) {
  case value instanceof Date:
    formatted = formatDate(value);
    break;
  case value instanceof Number || typeof value === 'number':
    formatted = formatNumber(value);
    break;
  case value instanceof String || typeof value === 'string':
    formatted = formatString(value);
    break;
  default:
    formatted = typeof value !== 'undefined' ? value.toString() : value;
  }
  return formatted;
};

/**
 * Format string
 * @param {Object} value
 * @return {string}
 */
function formatString (value) {
  const condition = !value.language || value.language === 'NONE' || ( veda.user && veda.user.preferences && veda.user.preferences.language && value.language in veda.user.preferences.language );
  return condition ? value : undefined;
}

/**
 * Format date
 * @param {Date} date
 * @return {string}
 */
function formatDate (date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const hours = date.getHours();
  const mins = date.getMinutes();
  const secs = date.getSeconds();

  const UTChours = date.getUTCHours();
  const UTCmins = date.getUTCMinutes();
  const UTCsecs = date.getUTCSeconds();
  const UTCmillis = date.getUTCMilliseconds();
  if ( (UTChours + UTCmins + UTCsecs + UTCmillis) === 0 ) {
    return [zeroPref(day), zeroPref(month), year].join('.');
  }
  const fdate = [zeroPref(day), zeroPref(month), year].join('.');
  const ftime = [zeroPref(hours), zeroPref(mins), zeroPref(secs)].join(':');
  return (fdate === '01.01.1970' ? '' : fdate) + (ftime === '00:00:00' ? '' : ' ' + ( secs === 0 ? ftime.substr(0, 5) : ftime) );
};

/**
 * Format date
 * @param {number} n
 * @return {string}
 */
function formatNumber (n) {
  return (n+'').replace(/.(?=(?:[0-9]{3})+\b)/g, '$& ');
};

Util.forSubIndividual = function (net, property, id, func) {
  if (net[property] === undefined) {
    return;
  }
  net[property].forEach(function(el) {
    if (el.id == id) {
      func(el);
    }
  });
};

Util.removeSubIndividual = function (net, property, id) {
  if (net[property] === undefined) {
    return;
  }
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
  const toString = Object.prototype.toString;
  const arrayTypeStr = '[object Array]';

  const result = [];
  const nodes = (mutable && array) || array.slice();
  let node;

  if (!array.length) {
    return result;
  }

  node = nodes.pop();

  do {
    if (toString.call(node) === arrayTypeStr) {
      nodes.push(...node);
    } else {
      result.push(node);
    }
  } while (nodes.length && (node = nodes.pop()) !== undefined);

  result.reverse(); // we reverse result to restore the original order
  return result;
};

Util.unique = function (arr) {
  const n = {}; const r = [];
  for (let i = 0; i < arr.length; i++) {
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
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    !(value % 1);
};
Number.isFloat = Number.isFloat || function(value) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    (value % 1);
};

Util.queryFromIndividualPT = function (individual, sort) {
  const orderBy = function (sort) {
    if (typeof sort === 'string' || sort instanceof String) {
      return sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri, dir) {
        const range = veda.ontology.properties[property_uri].get('rdfs:range')[0];
        const by = property_uri.replace(re, '_');
        let clause;
        switch (range.id) {
        case 'xsd:dateTime':
          clause = by + '.date ' + dir;
          break;
        case 'xsd:boolean':
        case 'xsd:integer':
          clause = by + '.int ' + dir;
          break;
        case 'xsd:decimal':
          clause = by + '.dec ' + dir;
          break;
        case 'xsd:string':
        default:
          clause = by + '.str ' + dir;
          break;
        }
        return clause;
      });
    }
  };

  const buildQuery = function (individual) {
    const tables = [];
    let i = -1;
    const where = Object.keys(individual.properties)
      .map(function (property_uri) {
        if (property_uri.indexOf('.') >= 0 || property_uri.indexOf('*') >= 0) {
          throw new Error('VQL style property nesting: ' + property_uri);
        }
        if (property_uri === '@') {
          return;
        }
        i++;
        const table = 'veda_pt.`' + property_uri + '` as p' + i;
        tables[i] = table;
        const values = individual.get(property_uri).sort(function (a, b) {
          return a < b ? - 1 : a === b ? 0 : 1;
        });
        let oneProp;
        switch (true) {
        case Number.isInteger(values[0]):
          oneProp = 'p' + i + '.int[1] >= ' + values[0] + ' AND p' + i + '.int[1] <= ' + values[values.length-1];
          break;
        case Number.isFloat(values[0]):
          oneProp = 'p' + i + '.dec[1] >= ' + values[0] + ' AND p' + i + '.dec[1] <= ' + values[values.length-1];
          break;
        case values[0] instanceof Date:
          let start = new Date(values[0]);
          let end = new Date(values[values.length-1]);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          start = Math.floor(start.valueOf() / 1000);
          end = Math.floor(end.valueOf() / 1000);
          oneProp = 'p' + i + '.date[1] >= toDateTime(' + start + ') AND p' + i + '.date[1] <= toDateTime(' + end + ')';
          break;
        case typeof values[0] === 'boolean':
          oneProp = values
            .map(function (value) {
              return 'p' + i + '.int[1] = ' + (value ? 1 : 0);
            }).join(' OR ');
          break;
        case values[0] instanceof String:
          oneProp = values
            .filter(Boolean)
            .map( function (value) {
              const q = value;
              const lines = q.trim().split('\n');
              const lineQueries = lines.map(function (line) {
                const words = line
                  .trim()
                  .replace(/[-*\s]+/g, ' ')
                  .split(' ');
                return words.length && 'arrayStringConcat(' + 'p' + i + '.str, \' \') LIKE \'%' + words.join('% %').replace(/\'/g, '\\\'').replace(/\"/g, '\'') + '%\'';
              });
              return lineQueries.filter(Boolean).join(' OR ');
            })
            .filter(Boolean)
            .join(' OR ');
          break;
        case values[0] instanceof IndividualModel:
          oneProp = values
            .filter(Boolean)
            .map( function (value) {
              if ( value.isNew() ) {
                return;
              } else {
                return 'has(' + 'p' + i + '.str, \'' + value.id + '\')';
              }
            })
            .filter(Boolean)
            .join(' OR ');
          break;
        }
        if (!oneProp) {
          return;
        }
        return oneProp.indexOf(' OR ') > 0 ? '( ' + oneProp + ' )' : oneProp;
      })
      .filter(Boolean)
      .join(' AND ');

    const from = tables.reduce(function (acc, table, i) {
      return acc ? acc + ' JOIN ' + table + ' ON p' + (i - 1) + '.id = p' + i + '.id' : table;
    }, '');

    return 'SELECT DISTINCT id FROM ' + from + (where ? ' WHERE ' + where : '');
  };

  const re = /[^a-zA-Z0-9]/g;
  try {
    let query = buildQuery;
    const order = orderBy(sort);
    query = query && order ? query + ' ORDER BY ' + order : query;
    return query;
  } catch (error) {
    console.log(error);
  }
};

Util.queryFromIndividualTT_SUB = function (individual, sort, withDeleted) {
  const groupBy = function (sort) {
    const by = 'id';
    let props;
    if (typeof sort === 'string' || sort instanceof String) {
      props = sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri) {
        const range = veda.ontology.properties[property_uri].get('rdfs:range')[0];
        let by = property_uri.replace(re, '_');
        switch (range.id) {
        case 'xsd:dateTime':
          by = by + '_date';
          break;
        case 'xsd:boolean':
        case 'xsd:integer':
          by = by + '_int';
          break;
        case 'xsd:decimal':
          by = by + '_dec';
          break;
        case 'xsd:string':
        default:
          by = by + '_str';
          break;
        }
        return by;
      });
    }
    return props ? by + ', ' + props : by;
  };

  const orderBy = function (sort) {
    if (typeof sort === 'string' || sort instanceof String) {
      return sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri, dir) {
        const range = veda.ontology.properties[property_uri].get('rdfs:range')[0];
        const by = property_uri.replace(re, '_');
        let clause;
        switch (range.id) {
        case 'xsd:dateTime':
          clause = by + '_date ' + dir;
          break;
        case 'xsd:boolean':
        case 'xsd:integer':
          clause = by + '_int ' + dir;
          break;
        case 'xsd:decimal':
          clause = by + '_dec ' + dir;
          break;
        case 'xsd:string':
        default:
          clause = by + '_str ' + dir;
          break;
        }
        return clause;
      });
    }
  };

  const buildQuery = function (individual) {
    if (individual.id in visited) {
      return;
    } else {
      visited[individual.id] = true;
    }
    let where = Object.keys(individual.properties)
      .map(function (property_uri, i) {
        if (property_uri.indexOf('.') >= 0 || property_uri.indexOf('*') >= 0) {
          throw new Error('VQL style property nesting: ' + property_uri);
        }
        if (property_uri === '@' || property_uri === 'rdf:type') {
          return;
        }
        const values = individual.get(property_uri).sort(function (a, b) {
          return a < b ? - 1 : a === b ? 0 : 1;
        });
        const prop = property_uri.replace(re, '_');
        let oneProp;
        switch (true) {
        case Number.isInteger(values[0]):
          oneProp = prop + '_int[1] >= ' + values[0] + ' AND ' + prop + '_int[1] <= ' + values[values.length-1];
          break;
        case Number.isFloat(values[0]):
          oneProp = prop + '_dec[1] >= ' + values[0] + ' AND ' + prop + '_dec[1] <= ' + values[values.length-1];
          break;
          // Date
        case values[0] instanceof Date:
          let start = new Date(values[0]);
          let end = new Date(values[values.length-1]);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          start = Math.floor(start.valueOf() / 1000);
          end = Math.floor(end.valueOf() / 1000);
          oneProp = prop + '_date[1] >= toDateTime(' + start + ') AND ' + prop + '_date[1] <= toDateTime(' + end + ')';
          break;
        case typeof values[0] === 'boolean':
          oneProp = values
            .map(function (value) {
              return prop + '_int[1] = ' + (value ? 1 : 0);
            }).join(' OR ');
          break;
        case values[0] instanceof String:
          oneProp = values
            .filter(Boolean)
            .map( function (value) {
              const q = value;
              const lines = q.trim().split('\n');
              const lineQueries = lines.map(function (line) {
                const words = line
                  .trim()
                  .replace(/[-*\s]+/g, ' ')
                  .split(' ');
                // 'text' is a special single-value column without suffix with all text content of an individual
                if ( /\.text$/.test(prop) ) {
                  return words.length && prop + ' LIKE \'%' + words.join('% %').replace(/\'/g, '\\\'').replace(/\"/g, '\'') + '%\'';
                } else {
                  return words.length && 'arrayStringConcat(' + prop + '_str, \' \') LIKE \'%' + words.join('% %').replace(/\'/g, '\\\'').replace(/\"/g, '\'') + '%\'';
                }
              });
              return lineQueries.filter(Boolean).join(' OR ');
            })
            .filter(Boolean)
            .join(' OR ');
          break;
        case values[0] instanceof IndividualModel:
          oneProp = values
            .filter(Boolean)
            .map( function (value) {
              if ( value.isNew() ) {
                const sub = buildQuery(value);
                return sub ? prop + '_str IN ( ' + sub + ' )' : undefined;
              } else {
                return 'has(' + prop + '_str, \'' + value + '\')';
              }
            })
            .filter(Boolean)
            .join(' OR ');
          break;
        }
        if (!oneProp) {
          return;
        }
        return oneProp.indexOf(' OR ') > 0 ? '( ' + oneProp + ' )' : oneProp;
      })
      .filter(Boolean)
      .join(' AND ');

    if (!withDeleted) {
      where += where ? ' AND ' : '';
      where += 'NOT v_s_deleted_int = [1]';
    }

    if (Object.keys(visited).length > 1 && !where) {
      return;
    }

    return individual.get('rdf:type')
      .map(function (type) {
        const from = 'veda_tt.`' + type.id + '`';
        const query = 'SELECT id FROM ' + from + (where ? ' WHERE ' + where : '');
        return query;
      })
      .filter(Boolean)
      .join(' UNION ALL ');
  };

  try {
    let query = buildQuery(individual);
    const group = groupBy(sort);
    query = query && group ? query + ' GROUP BY ' + group : query;
    const order = orderBy(sort);
    query = query ? query + ' HAVING sum(sign) > 0' : query;
    query = query && order ? query + ' ORDER BY ' + order : query;
    return query;
  } catch (error) {
    console.log(error);
  }
};

Util.queryFromIndividualTT_JOIN = function (individual, sort, withDeleted) {
  let table_counter = 0;
  const re = /[^a-zA-Z0-9]/g;
  try {
    return individual['rdf:type'].map(function (_type, type_index) {
      let from = '';
      let where = '';
      const visited = visited || {};
      buildQuery(individual, undefined, type_index);
      let query = from ? 'SELECT id FROM ' + from : '';
      query = query && where ? query + ' WHERE ' + where : query;
      const group = groupBy(sort);
      query = query && group ? query + ' GROUP BY ' + group : query;
      const order = orderBy(sort);
      query = query ? query + ' HAVING sum(sign) > 0' : query;
      query = query && order ? query + ' ORDER BY ' + order : query;
      return query;

      /**
       * Form `group by` clause
       * @param {string} sort
       * @return {string}
       */
      function groupBy(sort) {
        const by = 'id';
        let props;
        if (typeof sort === 'string' || sort instanceof String) {
          props = sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri) {
            const range = veda.ontology.properties[property_uri].get('rdfs:range')[0];
            let by = property_uri.replace(re, '_');
            switch (range.id) {
            case 'xsd:dateTime':
              by = by + '_date';
              break;
            case 'xsd:boolean':
            case 'xsd:integer':
              by = by + '_int';
              break;
            case 'xsd:decimal':
              by = by + '_dec';
              break;
            case 'xsd:string':
            default:
              by = by + '_str';
              break;
            }
            return by;
          });
        }
        return props ? by + ', ' + props : by;
      }

      /**
       * Form `order by` clause
       * @param {string} sort
       * @return {string}
       */
      function orderBy(sort) {
        if (typeof sort === 'string' || sort instanceof String) {
          return sort.replace(/'(.+?)'\s+(\w+)/gi, function (match, property_uri, dir) {
            const range = veda.ontology.properties[property_uri].get('rdfs:range')[0];
            const by = property_uri.replace(re, '_');
            let clause;
            switch (range.id) {
            case 'xsd:dateTime':
              clause = by + '_date ' + dir;
              break;
            case 'xsd:boolean':
            case 'xsd:integer':
              clause = by + '_int ' + dir;
              break;
            case 'xsd:decimal':
              clause = by + '_dec ' + dir;
              break;
            case 'xsd:string':
            default:
              clause = by + '_str ' + dir;
              break;
            }
            return clause;
          });
        }
      }

      /**
       * Recursive from & where population
       * @param {IndividualModel} individual
       * @param {string} parent_prop
       * @param {number} type_index
       */
      function buildQuery(individual, parent_prop, type_index) {
        if (!individual.hasValue('rdf:type')) { return; }
        table_counter++;
        type_index = type_index || 0;
        const type = individual.get('rdf:type')[type_index].id;
        const alias = 't' + table_counter;
        visited[individual.id] = alias;
        const table_aliased = 'veda_tt.`' + type + '` AS ' + alias;
        if (!parent_prop) {
          from += table_aliased;
        } else {
          from += ' JOIN ' + table_aliased + ' ON ' + parent_prop + ' = [' + alias + '.id]';
        }

        if (!withDeleted) {
          where += where ? ' AND ' : '';
          where += 'NOT ' + alias + '.v_s_deleted_int = [1]';
        }

        const where_aliased = Object.keys(individual.properties)
          .map(function (property_uri, i) {
            if (property_uri.indexOf('.') >= 0 || property_uri.indexOf('*') >= 0) {
              throw new Error('VQL style property nesting: ' + property_uri);
            }
            if (property_uri === '@' || property_uri === 'rdf:type') {
              return;
            }
            const values = individual.get(property_uri).sort(function (a, b) {
              return a < b ? - 1 : a === b ? 0 : 1;
            });
            const prop = alias + '.' + property_uri.replace(re, '_');
            let oneProp;
            switch (true) {
            case Number.isInteger(values[0]):
              oneProp = prop + '_int[1] >= ' + values[0] + ' AND ' + prop + '_int[1] <= ' + values[values.length-1];
              break;
            case Number.isFloat(values[0]):
              oneProp = prop + '_dec[1] >= ' + values[0] + ' AND ' + prop + '_dec[1] <= ' + values[values.length-1];
              break;
            case values[0] instanceof Date:
              let start = new Date(values[0]);
              let end = new Date(values[values.length-1]);
              start.setHours(0, 0, 0, 0);
              end.setHours(23, 59, 59, 999);
              start = Math.floor(start.valueOf() / 1000);
              end = Math.floor(end.valueOf() / 1000);
              oneProp = prop + '_date[1] >= toDateTime(' + start + ') AND ' + prop + '_date[1] <= toDateTime(' + end + ')';
              break;
            case typeof values[0] === 'boolean':
              oneProp = values
                .map(function (value) {
                  return prop + '_int[1] = ' + (value ? 1 : 0);
                }).join(' OR ');
              break;
            case values[0] instanceof String:
              oneProp = values
                .filter(Boolean)
                .map( function (value) {
                  const q = value;
                  const lines = q.trim().split('\n');
                  const lineQueries = lines.map(function (line) {
                    const words = line
                      .trim()
                      .replace(/[-*\s]+/g, ' ')
                      .split(' ');
                    // 'text' is a special single-value column without suffix with all text content of an individual
                    if ( /\.text$/.test(prop) ) {
                      return words.length && prop + ' LIKE \'%' + words.join('% %').replace(/\'/g, '\\\'').replace(/\"/g, '\'') + '%\'';
                    } else {
                      return words.length && 'arrayStringConcat(' + prop + '_str, \' \') LIKE \'%' + words.join('% %').replace(/\'/g, '\\\'').replace(/\"/g, '\'') + '%\'';
                    }
                  });
                  return lineQueries.filter(Boolean).join(' OR ');
                })
                .filter(Boolean)
                .join(' OR ');
              break;
            case values[0] instanceof IndividualModel:
              oneProp = values
                .filter(Boolean)
                .map( function (value) {
                  if ( value.isNew() && !(value.id in visited)) {
                    return buildQuery(value, prop + '_str');
                  } else if ( value.isNew() && value.id in visited ) {
                    return 'has(' + prop + '_str, ' + visited[value.id] + '.id' + ')';
                  } else {
                    return 'has(' + prop + '_str, \'' + value + '\')';
                  }
                })
                .filter(Boolean)
                .join(' OR ');
              break;
            }
            if (!oneProp) {
              return;
            }
            return oneProp.indexOf(' OR ') > 0 ? '( ' + oneProp + ' )' : oneProp;
          })
          .filter(Boolean)
          .join(' AND ');

        if (!where_aliased) {
          return;
        }

        if (!where) {
          where = where_aliased;
        } else {
          where += ' AND ' + where_aliased;
        }
      }
    }).join(' UNION ALL ');
  } catch (error) {
    console.log(error);
  }
};

Util.queryFromIndividual = function (individual) {
  const flat = flattenIndividual(individual.properties);
  if ( individual.hasValue('*') && individual.get('*')[0].indexOf('==') > 0 ) {
    return individual.get('*')[0];
  }
  const allProps = Object.getOwnPropertyNames(flat)
    .map(function (property_uri) {
      if (property_uri === '@' || property_uri === 'v-s:isDraft') {
        return;
      }
      const values = flat[property_uri].sort(function (a, b) {
        return a.data < b.data ? - 1 : a.data === b.data ? 0 : 1;
      });
      let oneProp;
      switch (values[0].type) {
      case 'Integer':
      case 'Decimal':
        oneProp = '\'' + property_uri + '\'==[' + values[0].data + ',' + values[values.length-1].data + ']';
        break;
        // Date
      case 'Datetime':
        const start = new Date(values[0].data);
        const end = new Date(values[values.length-1].data);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        oneProp = '\'' + property_uri + '\'==[' + start.toISOString() + ',' + end.toISOString() + ']';
        break;
      case 'Boolean':
        oneProp = values
          .map( function (value) {
            return '\'' + property_uri + '\'==\'' + value.data + '\'';
          })
          .join(' || ');
        break;
      case 'String':
        oneProp = values
          .filter(function(item) {
            return !!item && !!item.valueOf();
          })
          .map( function (value) {
            const q = value.data;
            if ( !q.match(/[\+\-\*]/) ) {
              const lines = q.trim().split('\n');
              const lineQueries = lines.map(function (line) {
                const words = line
                  .trim()
                  .replace(/[-*\s]+/g, ' ')
                  .split(' ');
                line = words.map(function (word) {
                  return '+' + word + '*';
                }).join(' ');
                return '\'' + property_uri + '\'==\'' + line + '\'';
              });
              return lineQueries.join(' || ');
            } else {
              return '\'' + property_uri + '\'==\'' + q + '\'';
            }
          })
          .join(' || ');
        break;
      case 'Uri':
        oneProp = values
          .filter(function(item) {
            return !!item && !!item.valueOf();
          })
          .map( function (value) {
            if (property_uri === 'rdf:type') {
              return '\'' + property_uri + '\'==\'' + value.data + '\'';
            } else {
              return '\'' + property_uri + '\'==\'' + value.data + '\'';
            }
          })
          .join(' || ');
        break;
      }
      return oneProp ? '( ' + oneProp + ' )' : undefined;
    })
    .filter(function(item) {
      return typeof item !== undefined;
    })
    .join(' && ');
  const query = allProps ? '( ' + allProps + ' )' : undefined;
  return query;
};

/**
 * Flatten individual
 * @param {Object} object
 * @param {string} prefix
 * @param {Object} union
 * @param {Array} visited
 * @return {Object} union
 */
function flattenIndividual(object, prefix, union, visited) {
  const uri = object['@'];
  union = typeof union !== 'undefined' ? union : {};
  prefix = typeof prefix !== 'undefined' ? prefix : '';
  visited = typeof visited !== 'undefined' ? visited : [];
  if (visited.indexOf(uri) > -1) {
    return;
  } else {
    visited.push(uri);
  }
  for (const property_uri in object) {
    if (property_uri === '@') {
      continue;
    }
    const values = object[property_uri];
    const prefixed = prefix ? prefix + '.' + property_uri : property_uri;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (value.type === 'Uri') {
        const individ = new IndividualModel(value.data);
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
  const cache = {};
  cache[individual['@']] = individual;
  const re_date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/i;
  const get_cached = function (uri) {
    return cache[uri] ? cache[uri] : cache[uri] = get_individual(veda.ticket, uri);
  };
  const get_localized_chain = function (language, uri, ...properties) {
    const startPoint = get_cached(uri);
    if (!startPoint) {
      return '';
    }
    let intermediates = [startPoint];
    for (let i = 0, property; (property = properties[i]); i++) {
      const length = properties.length;
      if (i === length - 1) {
        const parts = [];
        intermediates.forEach(function(item) {
          if (item[property]) {
            const part = item[property].reduce(function (acc, value) {
              if ( !value.lang || value.lang === 'NONE' || value.lang.toLowerCase() === language.toLowerCase() ) {
                let data = value.data;
                if ( data instanceof Date || re_date.test(data) ) {
                  data = new Date(data);
                  data = new Date(data.getTime() - (data.getTimezoneOffset() * 60000)).toISOString().substr(0, 10);
                }
                return acc += data;
              } else {
                return acc;
              }
            }, '');
            parts.push(part);
          }
        });
        return parts.join(', ');
      }
      const temp = [];
      intermediates.forEach(function(item) {
        if (Util.hasValue(item, property)) {
          item[property].forEach(function(propertyItem) {
            temp.push(get_cached(propertyItem.data));
          });
        }
      });
      if (temp.length) {
        intermediates = temp;
      } else {
        return '';
      }
    }
    return '';
  };

  try {
    const availableLanguages = get_cached('v-ui:AvailableLanguage');
    const languages = availableLanguages['rdf:value'].map(function (languageValue) {
      const languageUri = languageValue.data;
      const language = get_cached(languageUri);
      return language['rdf:value'][0].data;
    });
    return individual['rdf:type'].reduce(function (acc, typeValue) {
      const typeUri = typeValue.data;
      const type = get_cached(typeUri);
      if ( !type || !Util.hasValue(type, 'v-s:labelPattern') ) {
        return acc;
      }
      const pattern = type['v-s:labelPattern'][0].data;
      languages.forEach(function (language) {
        const replaced = pattern.replace(/{(\s*([^{}]+)\s*)}/g, function (match, group) {
          let indexes = null;
          if (group.indexOf(' ') != -1) {
            const temp = group.split(' ');
            group = temp[0];
            indexes = temp[1].substring(1, temp[1].length-1).split(',');
          }
          const chain = group.split('.');
          if (chain[0] === '@') {
            chain[0] = individual['@'];
          }
          const localedChain = get_localized_chain.apply({}, [language].concat(chain));
          return indexes == null? localedChain : localedChain.substring(+indexes[0], +indexes[1]);
        });
        const result = {
          data: replaced,
          lang: language,
          type: 'String',
        };
        acc.push(result);
      });
      return acc;
    }, []);
  } catch (err) {
    console.log('Complex label error', err, err.stack);
    return [];
  }
};

Util.areEqual = function (x, y) {
  if ( x === y ) return true;
  if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
  if ( x.constructor !== y.constructor ) return false;
  for ( const p in x ) {
    if ( ! x.hasOwnProperty( p ) ) continue;
    if ( ! y.hasOwnProperty( p ) ) return false;
    if ( x[p] === y[p] ) continue;
    if ( typeof( x[p] ) !== 'object' ) return false;
    if ( ! Util.areEqual( x[p], y[p] ) ) return false;
  }
  for ( const p in y ) {
    if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
  }
  return true;
};
