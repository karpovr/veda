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

import veda from "../common/veda.js";

import Util from "../common/util.js";

var Numerator = {};

export default veda.Numerator = Numerator;

Numerator.numerate = function (ticket, individual, super_classes, prev_state, _event_id) {
  try {
    var deleted = Util.hasValue( individual, "v-s:deleted", { data: true, type: "Boolean"} );
    var prevDeleted = prev_state && Util.hasValue( prev_state, "v-s:deleted", { data: true, type: "Boolean"} );

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
          individual[enumeratedProperty] = Util.newStr( number.toString() );
          put_individual(ticket, individual, _event_id);
          //print("@3 update doc, commit number");

        } else if (!number && prevNumber) {
          individual[enumeratedProperty] = Util.newStr( prevNumber.toString() ); // Restore number
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
}

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
        prevInterval['v-s:numerationCommitedIntervalEnd'][0].data = nextInterval['v-s:numerationCommitedIntervalEnd'][0].data
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
        var intervalId = Util.genUri() + "-intv";
        var interval = {
          '@': intervalId,
          'rdfs:label': [{ data: value + ' - ' + value, type: "String" }],
          'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
          'v-s:numerationCommitedIntervalBegin': [{ data: value, type: "Integer" }],
          'v-s:numerationCommitedIntervalEnd': [{ data: value, type: "Integer" }]
        }
        put_individual(ticket, interval, _event_id);

        scope['v-s:numerationCommitedInterval'].push( {data: interval['@'], type: "Uri"} );
        put_individual(ticket, scope, _event_id);
      }
    } else {
      // Scope is empty - create new interval
      var intervalId = Util.genUri() + "-intv";
      var interval = {
        '@': intervalId,
        'rdfs:label': [{ data: value + ' - ' + value, type: "String" }],
        'rdf:type': [{ data: 'v-s:NumerationCommitedIntervalClass', type: "Uri" }],
        'v-s:numerationCommitedIntervalBegin': [{ data: value, type: "Integer" }],
        'v-s:numerationCommitedIntervalEnd': [{ data: value, type: "Integer" }]
      }
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
        var newIntervalUri = { data: Util.genUri() + "-intv", type: "Uri" };

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
}
