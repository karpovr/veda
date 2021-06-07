// Veda server utility functions

'use strict';

import veda from '../common/veda.js';

import Sha256 from '../common/lib/sha256.js';

import riot from '../common/lib/riot.js';

import Mustache from 'mustache';

const Util = veda.Util || {};

export default veda.Util = Util;

Util.Sha256 = Sha256;

Util.Mustache = Mustache;

Util.addToGroup = function (ticket, group, resource, allow, deny) {
  const new_membership_uri = Util.genUri() + '-mbh';
  const new_membership = {
    '@': new_membership_uri,
    'rdf:type': Util.newUri('v-s:Membership'),
    'v-s:memberOf': Util.newUri(group),
    'v-s:resource': Util.newUri(resource),
  };

  (allow || []).forEach(function (right) {
    new_membership[right] = Util.newBool(true);
  });

  (deny || []).forEach(function (right) {
    new_membership[right] = Util.newBool(false);
  });

  const res = put_individual(ticket, new_membership);
  return [new_membership, res];
};

Util.removeFromGroup = function (ticket, group, resource) {
  const new_membership_uri = Util.genUri() + '-mbh';
  const new_membership = {
    '@': new_membership_uri,
    'rdf:type': Util.newUri('v-s:Membership'),
    'v-s:memberOf': Util.newUri(group),
    'v-s:resource': Util.newUri(resource),
    'v-s:deleted': Util.newBool(true),
  };

  const res = put_individual(ticket, new_membership);
  return [new_membership, res];
};

Util.addRight = function (ticket, subj_uri, obj_uri, allow, deny) {
  if (subj_uri === undefined || obj_uri === undefined) {
    const error = new Error('Util.addRight: INVALID ARGS');
    console.log('subj_uri =', subj_uri);
    console.log('obj_uri =', obj_uri);
    console.log('Error stack:', error.stack);
    return;
  }

  const uri = Util.genUri() + '-r';

  const permission = {
    '@': uri,
    'rdf:type': Util.newUri('v-s:PermissionStatement'),
    'v-s:permissionObject': Util.newUri(obj_uri),
    'v-s:permissionSubject': Util.newUri(subj_uri),
  };

  (allow || []).forEach(function (right) {
    permission[right] = Util.newBool(true);
  });

  (deny || []).forEach(function (right) {
    permission[right] = Util.newBool(false);
  });

  const res = put_individual(ticket, permission);
  return [permission, res];
};

Util.clone = function (obj) {
  let copy;

  // Handle the 3 simple types, and null or undefined
  if (null == obj || 'object' !== typeof obj) {
    return obj;
  } else if (obj instanceof Date) {
    // Handle Date
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  } else if (obj instanceof Array) {
    // Handle Array
    copy = [];
    for (let i = 0, len = obj.length; i < len; i++) {
      copy[i] = Util.clone(obj[i]);
    }
    return copy;
  } else if (obj instanceof Object) {
    // Handle Object
    copy = {};
    for (const attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = Util.clone(obj[attr]);
    }
    return copy;
  } else {
    throw new Error('Unable to copy obj! Its type isn\'t supported.');
  }
};

// Returns literal value or resource id for given property chain
Util.getPropertyChain = function (...args) {
  let value = args[0];
  const argsLength = args.length;
  if (typeof value === 'string') {
    value = get_individual(veda.ticket, value);
  }
  let i; let property_uri; let type;
  for (i = 1; i < argsLength; i++) {
    property_uri = args[i];
    if ( Util.hasValue(value, property_uri) ) {
      if (i === (argsLength - 1) ) {
        return value[property_uri].map(function (el) {
          return el.data;
        });
      } else {
        type = value[property_uri][0].type;
        value = value[property_uri][0].data;
        if (type === 'Uri') {
          value = get_individual(veda.ticket, value);
          continue;
        }
      }
    }
    return;
  }
  return value;
};


Util.newUri = function (uri) {
  return [{
    data: uri,
    type: 'Uri',
  }];
};

Util.newStr = function (_data, _lang) {
  const value = {
    data: _data,
    type: 'String',
  };
  if (_lang && _lang !== 'NONE') {
    value.lang = _lang;
  }
  return [value];
};

Util.newStrFromBundle = function (_bundle1, _bundle2, _sep) {
  if (!_sep) {
    _sep = ' ';
  }
  const str = _bundle1['rdfs:label'][0] + _sep + _bundle2['rdfs:label'][0];
  return str;
};

Util.newBool = function (_data) {
  return [{
    data: _data,
    type: 'Boolean',
  }];
};

Util.newInt = function (_data) {
  return [{
    data: _data,
    type: 'Integer',
  }];
};

Util.newDecimal = function (_data) {
  return [{
    data: _data,
    type: 'Decimal',
  }];
};

Util.newDate = function (_data) {
  return [{
    data: _data,
    type: 'Datetime',
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
  const res = [];
  if (property_value) {
    for (const i in property_value) {
      if (!property_value.hasOwnProperty(i)) {
        continue;
      }
      res.push(property_value[i].data);
    }
  }
  return res;
};

Util.getUris = function (property_value) {
  const res = [];
  if (property_value) {
    for (const i in property_value) {
      if (!property_value.hasOwnProperty(i)) {
        continue;
      }
      res.push(property_value[i].data);
    }
  }
  return res;
};

Util.getStrings = function (property_value) {
  const res = [];
  if (property_value) {
    for (const i in property_value) {
      if (!property_value.hasOwnProperty(i)) {
        continue;
      }
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
    if (property_value[0].type == 'Integer') {
      return parseInt(property_value[0].data, 10);
    } else if (property_value[0].type == 'Datetime') {
      return new Date(property_value[0].data);
    }
    return property_value[0].data;
  }
};

Util.getFirstValueUseLang = function (property_value, lang) {
  for (const i in property_value) {
    if (property_value[i].lang == lang) {
      return property_value[i].data;
    }
  }
  return null;
};

Util.getJournalUri = function (object_uri) {
  return object_uri + 'j';
};

Util.getTraceJournalUri = function (object_uri) {
  return object_uri + 't';
};

Util.newJournalRecord = function (journal_uri) {
  const new_journal_record_uri = Util.genUri() + '-jr';

  const new_journal_record = {
    '@': new_journal_record_uri,
    'rdf:type': [
      {
        data: 'v-s:JournalRecord',
        type: 'Uri',
      }],
    'v-s:parentJournal': [
      {
        data: journal_uri,
        type: 'Uri',
      }],
    'v-s:created': [
      {
        data: new Date(),
        type: 'Datetime',
      }],
  };
  return new_journal_record;
};

Util.logToJournal = function (ticket, journal_uri, journal_record) {
  put_individual(ticket, journal_record, _event_id);
  const add_to_journal = {
    '@': journal_uri,
    'v-s:childRecord': [
      {
        data: journal_record['@'],
        type: 'Uri',
      }],
  };
  add_to_individual(ticket, add_to_journal, _event_id);
};

Util.traceToJournal = function (ticket, journal_uri, label, _data) {
  // print("@@@ traceToJournal, journal_uri=" + journal_uri + " #1");
  const journal_record = Util.newJournalRecord(journal_uri);

  journal_record['rdf:type'] = [
    {
      data: 'v-wf:TraceRecord',
      type: 'Uri',
    }];
  journal_record['rdfs:label'] = [
    {
      data: label,
      type: 'String',
    }];
  journal_record['rdfs:comment'] = [
    {
      data: _data,
      type: 'String',
    }];

  Util.logToJournal(ticket, journal_uri, journal_record, true);

  // print("@@@ traceToJournal, journal_uri=" + journal_uri + ", " + Util.toJson(journal_record));
};


// DEPRECATED
Util.isTecnicalChange = function (newdoc, olddoc) {
  if (newdoc['v-s:actualVersion'] && newdoc['v-s:actualVersion'][0].data != newdoc['@']) {
    olddoc = get_individual(ticket, newdoc['v-s:actualVersion'][0].data);
  }
  if (!olddoc) {
    // print (newdoc['@']+' x ');
    return false;
  }

  for (const key in newdoc) {
    if (key === '@') continue;

    if (
      (newdoc[key] && !olddoc[key]) || // добвили
      (newdoc[key] && !olddoc[key]) || // удалили
      (newdoc[key].length !== olddoc[key].length) // изменили количество
    ) {
      if (!Util.isTechnicalAttribute(key, olddoc[key])) {
        // в нетехническом атрибуте
        // print (newdoc['@']+' x '+olddoc[key]+' >1> '+newdoc[key]+' : '+key);
        return false;
      }
    } else {
      for (const item in newdoc[key]) {
        if (newdoc[key][item].data.valueOf() != olddoc[key][item].data.valueOf() && !Util.isTechnicalAttribute(key, olddoc[key][item].data)) { // поменялось одно из значений в нетехническом атрибуте
          // print ('2 old:', Util.toJson(olddoc));
          // print ('2 new:', Util.toJson(newdoc));
          // print (newdoc['@']+' x '+olddoc[key][item].data+' >2> '+newdoc[key][item].data+' : '+key);
          return false;
        }
      }
    }
  }

  return true;
};


// DEPRECATED
Util.isTechnicalAttribute = function (attName, oldvalue) {
  if (!oldvalue && attName === 'v-s:actualVersion') return true;
  if (!oldvalue && attName === 'v-s:previousVersion') return true;
  if (!oldvalue && attName === 'v-s:nextVersion') return true;
  if (attName === 'v-wf:hasStatusWorkflow') return true;
  return false;
};

Util.loadVariablesUseField = function (ticket, field) {
  const res = {};
  for (const idx in field) {
    if (Object.hasOwnProperty.call(field, idx)) {
      const uri = field[idx].data;
      if (uri) {
        const indv = get_individual(ticket, uri);

        if ( Util.hasValue(indv, 'rdf:type', {data: 'v-s:Variable', type: 'Uri'}) ) {
          const varName = Util.getFirstValue(indv['v-s:variableName']);
          const varValue = Util.getValues(indv['v-s:variableValue']);
          res[varName] = varValue;
        }
      }
    }
  }
  return res;
};

Util.isAlphaNumeric = function (src) {
  if (!src) {
    return false;
  }
  const alphanum = /[a-zA-Z0-9]/;
  if (alphanum.test(src)) {
    return true;
  } else {
    return false;
  }
};

Util.replace_word = function (src, from, to) {
  const trace = true;

  let new_str = src;
  // if (trace)
  //  print ('src=', src, ', from=', from, ', to=', to);

  let is_prepare = false;

  const pos_f = from.indexOf('*');
  const pos_t = to.indexOf('*');

  if (pos_f > 0 && pos_f > 0) {
    from = from.substring(0, pos_f);
    to = to.substring(0, pos_t);

    let pos_w_b = src.indexOf(from);
    let word;
    if (pos_w_b >= 0) {
      pos_w_b += from.length;
      let pos_w_e = pos_w_b;
      let ch = src.charAt(pos_w_e);
      while (Util.isAlphaNumeric(ch)) {
        pos_w_e++;
        ch = src.charAt(pos_w_e);
      }
      if (pos_w_e > pos_w_b) {
        word = src.substring(pos_w_b, pos_w_e);
        // print ('is *1, from=', from, ", to=", to);
        // print ('is *2, word=', word);
        from = from + word;
        to = to + word;
        // print ('is *3, from=', from, ", to=", to);

        is_prepare = true;
      }
    }
  } else {
    if (src.length == from.length) {
      is_prepare = true;
    }

    if (is_prepare == false) {
      const pos = src.indexOf(from);
      if (pos && pos >= 0) {
        if (trace) {
          print('$replace_word #1 pos=', pos);
        }

        const last_ch = src[pos + from.length];

        if (trace) {
          print('$replace_word #2 last_ch=[' + last_ch + ']');
        }

        if (last_ch && Util.isAlphaNumeric(last_ch) == false) {
          if (trace) {
            print('$replace_word !isAlphaNumeric last_ch=', last_ch);
          }
          is_prepare = true;
        }
      }
    }
  }

  if (is_prepare) {
    new_str = src.replace(new RegExp(from, 'g'), to);
  }


  return new_str;
};

Util.create_version = function (ticket, document, prev_state, user_uri, _event_id) {
  // Only if we save actual version of document (or it is first save of versioned document)
  if ( !document['v-s:actualVersion'] || document['v-s:actualVersion'][0].data === document['@'] ) {
    const user = get_individual(ticket, user_uri);
    const appointment_uri = Util.getUri(user['v-s:defaultAppointment']) || Util.getUri(user['v-s:hasAppointment']);
    const actor_uri = appointment_uri || user_uri;

    const versionId = Util.genUri() + '-vr';

    // Create new version
    const version = veda.Util.clone(prev_state);
    version['@'] = versionId;
    version['v-s:actualVersion'] = [{
      data: document['@'],
      type: 'Uri',
    }];
    version['v-s:nextVersion'] = [{
      data: document['@'],
      type: 'Uri',
    }];
    if (veda.Util.hasValue(document, 'v-s:previousVersion')) {
      version['v-s:previousVersion'] = [{
        data: document['v-s:previousVersion'][0].data,
        type: 'Uri',
      }];
    }
    version['rdf:type'] = version['rdf:type'].concat(
      [{
        data: 'v-s:Version',
        type: 'Uri',
      }],
    );
    put_individual(ticket, version, _event_id);

    // Add version to document group
    veda.Util.addToGroup(ticket, document['@'], version['@'], ['v-s:canRead']);

    // Update previous version
    if (document['v-s:previousVersion']) {
      const previous = get_individual(ticket, Util.getUri(document['v-s:previousVersion']));
      previous['v-s:nextVersion'] = [{
        data: version['@'],
        type: 'Uri',
      }];
      put_individual(ticket, previous, _event_id);
    }

    // Update actual version
    document['v-s:actualVersion'] = [{
      data: document['@'],
      type: 'Uri',
    }];
    document['v-s:previousVersion'] = [{
      data: version['@'],
      type: 'Uri',
    }];
    document['v-s:edited'] = [{data: new Date(), type: 'Datetime'}];
    document['v-s:lastEditor'] = Util.newUri(actor_uri);
    put_individual(ticket, document, _event_id);
  }
};

Util.recursiveCall = function (elem, path, ticket, _event_id) {
  if (path[elem['@']]) {
    print('WARNING! Recursive path '+Util.toJson(path)+' > '+elem['a']);
    return;
  }

  path[elem['@']] = Object.keys(path).length;
  if (elem['v-wf:decisionFormList']) {
    elem['v-wf:decisionFormList'].forEach(function (dfae) {
      const df = get_individual(ticket, dfae.data);
      if (!df['v-wf:isCompleted'] || df['v-wf:isCompleted'][0].data == false) {
        df['v-s:deleted'] = Util.newBool(true);
        df['v-wf:isStopped'] = Util.newBool(true);
        put_individual(ticket, df, _event_id);
      }
    });
  }

  if (elem['v-wf:workItemList']) {
    elem['v-wf:workItemList'].forEach(function (wi) {
      Util.recursiveCall(get_individual(ticket, wi.data), path, ticket, _event_id);
    });
  }

  if (elem['v-wf:workOrderList']) {
    elem['v-wf:workOrderList'].forEach(function (wo) {
      Util.recursiveCall(get_individual(ticket, wo.data), path, ticket, _event_id);
    });
  }

  if (elem['v-wf:isProcess']) {
    elem['v-wf:isProcess'].forEach(function (p) {
      const df = get_individual(ticket, p.data);
      if (!df['v-wf:isCompleted'] || df['v-wf:isCompleted'][0].data == false) {
        df['v-wf:isStopped'] = Util.newBool(true);
        put_individual(ticket, df, _event_id);
      }
      Util.recursiveCall(df, path, ticket, _event_id);
    });
  }
};

Util.set_err_on_indv = function (msg, indv, src) {
  const bugreport = {
    '@': Util.genUri() + '-err',
    'rdf:type': Util.newUri('v-s:BugReport'),
    'v-s:created': Util.newDate(new Date()),
    'rdfs:comment': Util.newStr(src),
    'v-s:errorMessage': Util.newStr(msg),
    'v-s:resource': Util.newUri(indv['@']),
  };
  put_individual(ticket, bugreport, _event_id);

  const add_to_indv = {
    '@': indv['@'],
    'v-s:hasError': Util.newUri(bugreport['@']),
  };
  add_to_individual(ticket, add_to_indv, _event_id);

  print('ERR! ' + src + ':' + msg);
};

Util.set_field_to_document = function (field_name, value, doc_id) {
  const set_in_document = {
    '@': doc_id,
  };

  set_in_document[field_name] = value;
  set_in_individual(ticket, set_in_document, _event_id);
};

Util.transformation = function (ticket, individuals, transform, executor, work_order, process) {
  try {
    const out_data0 = {};

    let element;

    if (Array.isArray(individuals) !== true) {
      individuals = [individuals];
    }

    let rules = transform['v-wf:transformRule'];

    if (!rules || !rules.length) {
      return;
    }

    // print ("@B start transform");
    const tmp_rules = [];
    // print ("rules_in=", Util.toJson (rules));
    // print ("individuals=", Util.toJson (individuals));
    for (const i in rules) {
      if (Object.hasOwnProperty.call(rules, i)) {
        const rul = get_individual(ticket, rules[i].data);
        if (!rul) {
          print('not read rule [', Util.toJson(rul), ']');
          continue;
        } else {
          tmp_rules.push(rul);
        }
      }
    }
    rules = tmp_rules;

    let out_data0_el = {};

    /* PUT functions [BEGIN] */
    const putFieldOfIndividFromElement = (function () {
      return function (name, field) {
        const rr = get_individual(ticket, Util.getUri(element));
        if (!rr) {
          return;
        }

        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(rr[field]);

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putFieldOfObject = (function () {
      return function (name, field) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(individual[field]);

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putUri = (function () {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Uri',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setUri = function (name, value) {
      out_data0_el[name] = [
        {
          data: value,
          type: 'Uri',
        }];
    };

    const putString = (function () {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'String',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setString = (function () {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'String',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setDatetime = (function () {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Datetime',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putDatetime = (function () {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Datetime',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putBoolean = (function () {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Boolean',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setBoolean = (function () {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Boolean',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();


    const putInteger = (function () {
      return function (name, value) {
        let out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Integer',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setInteger = (function () {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Integer',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putExecutor = (function () {
      return function (name) {
        let out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        if (Array.isArray(executor) === true) {
          for (const key3 in executor) {
            if (Object.hasOwnProperty.call(executor, key3)) {
              out_data0_el_arr.push(executor[key3]);
            }
          }
        } else {
          out_data0_el_arr.push(executor);
        }

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putWorkOrder = (function () {
      return function (name) {
        let out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        if (Array.isArray(work_order) === true) {
          for (const key3 in work_order) {
            if (Object.hasOwnProperty.call(work_order, key3)) {
              out_data0_el_arr.push(work_order[key3]);
            }
          }
        } else {
          out_data0_el_arr.push(work_order);
        }

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putThisProcess = (function () {
      return function (name) {
        let out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        if (Array.isArray(process) === true) {
          for (const key3 in process) {
            if (Object.hasOwnProperty.call(process, key3)) {
              out_data0_el_arr.push(process[key3]);
            }
          }
        } else {
          out_data0_el_arr.push(process);
        }

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const removeThisProcess = (function () {
      return function (name) {
        let out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        if (Array.isArray(process) === true) {
          for (const key3 in process) {
            if (Object.hasOwnProperty.call(process, key3)) {
              out_data0_el_arr = out_data0_el_arr.filter(function (value) {
                return value.data !== process[key3];
              });
            }
          }
        } else {
          out_data0_el_arr = out_data0_el_arr.filter(function (value) {
            return value.data !== process;
          });
        }

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    /* PUT functions [END] */

    for (const key in individuals) {
      if (Object.hasOwnProperty.call(individuals, key)) {
        // print("#1 key=", key);
        const individual = individuals[key];

        // print("#1.1 key=", key);
        const objectContentStrValue = (function () {
          return function (name, value) {
            if (individual[name]) {
              let result = false;
              for (const i in individual[name]) {
                if (value === individual[name][i].data) {
                  result = true;
                }
              }
              return result;
            }
          };
        })();

        const iteratedObject = Object.keys(individual);

        for (let key2 = 0; key2 < iteratedObject.length; key2++) {
          element = individual[iteratedObject[key2]];

          const putValue = (function () {
            return function (name) {
              let out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }

              if (iteratedObject[key2] == '@') {
                out_data0_el_arr.push(
                  {
                    data: element,
                    type: 'Uri',
                  });
              } else {
                if (Array.isArray(element) === true) {
                  for (const key3 in element) {
                    if (Object.hasOwnProperty.call(element, key3)) {
                      out_data0_el_arr.push(element[key3]);
                    }
                  }
                } else {
                  out_data0_el_arr.push(element);
                }
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          const putValueFrom = (function () {
            return function (name, path, transform) {
              let out_data0_el_arr = out_data0_el[name];
              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }

              let element_uri;

              if (Array.isArray(element) === true) {
                element_uri = Util.getUri(element);
              } else {
                element_uri = element.data ? element.data : element;
              }

              let curelem;

              curelem = get_individual(ticket, element_uri);

              for (let i = 0; i < path.length - 1; i++) {
                if (!curelem || !curelem[path[i]]) return;
                const uri = Array.isArray(curelem[path[i]]) && curelem[path[i]][0].data ? curelem[path[i]][0].data : curelem[path[i]];
                curelem = get_individual(ticket, uri);
              }
              if (!curelem || !curelem[path[path.length - 1]]) return;

              out_data0_el_arr = out_data0_el_arr.concat(curelem[path[path.length - 1]]);

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          const putFrontValue = (function () {
            return function (name) {
              let out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }
              if (iteratedObject[key2] == '@') {
                out_data0_el_arr.unshift(
                  {
                    data: element,
                    type: 'Uri',
                  });
              } else {
                if (Array.isArray(element) === true) {
                  for (const key3 in element) {
                    if (Object.hasOwnProperty.call(element, key3)) {
                      out_data0_el_arr.unshift(element[key3]);
                    }
                  }
                } else {
                  out_data0_el_arr.unshift(element);
                }
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          const putElement = (function () {
            return function () {
              const name = iteratedObject[key2];
              if (name == '@') {
                return;
              }

              let out_data0_el_arr = [];
              out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }

              if (Array.isArray(element) === true) {
                for (const key3 in element) {
                  if (Object.hasOwnProperty.call(element, key3)) {
                    out_data0_el_arr.push(element[key3]);
                  }
                }
              } else {
                out_data0_el_arr.push(element);
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          /* Segregate functions [BEGIN] */
          const contentName = (function () {
            return function (name) {
              return iteratedObject[key2] == name;
            };
          })();

          const elementContentStrValue = (function () {
            return function (name, value) {
              if (iteratedObject[key2] !== name) {
                return false;
              }
              const str = element[0].data;
              if (str == value) {
                return true;
              } else {
                return false;
              }
            };
          })();
          /* Segregate functions [END] */

          const getElement = (function () {
            return function () {
              return element;
            };
          })();


          // выполняем все rules
          for (const key3 in rules) {
            if (Object.hasOwnProperty.call(rules, key3)) {
              const rule = rules[key3];
              // 1. v-wf:segregateObject
              const segregateObject = rule['v-wf:segregateObject'];

              // 2. v-wf:segregateElement
              const segregateElement = rule['v-wf:segregateElement'];
              const grouping = rule['v-wf:grouping'];

              let res = undefined;

              if (segregateObject) {
                res = eval(segregateObject[0].data);
                if (res == false) {
                  continue;
                }
              }

              if (segregateElement) {
                res = eval(segregateElement[0].data);
                if (res == false) {
                  continue;
                }
              }

              // 3. v-wf:aggregate
              let group_key;
              if (!grouping) {
                out_data0_el = {};
                out_data0_el['@'] = Util.genUri() + '-tr';
              } else {
                let useExistsUid = false;
                for (const i in grouping) {
                  if (Object.hasOwnProperty.call(grouping, i)) {
                    const gk = grouping[i].data;
                    if (gk == '@') {
                      useExistsUid = true;
                    } else {
                      group_key = gk;
                    }
                  }
                }

                out_data0_el = out_data0[group_key];
                if (!out_data0_el) {
                  out_data0_el = {};
                  if (useExistsUid) {
                    out_data0_el['@'] = individual['@'];
                  } else {
                    out_data0_el['@'] = Util.genUri() + '-tr';
                  }
                }
              }

              const agregate = rule['v-wf:aggregate'];
              for (let i2 = 0; i2 < agregate.length; i2++) {
                eval(agregate[i2].data);
              }

              if (!grouping) {
                out_data0[out_data0_el['@']] = out_data0_el;
              } else {
                out_data0[group_key] = out_data0_el;
              }
            }
          }
        }
      }
    }

    const out_data = [];
    for (const key in out_data0) {
      if (Object.hasOwnProperty.call(out_data0, key)) {
        out_data.push(out_data0[key]);
      }
    }

    return out_data;
  } catch (e) {
    console.log(e.stack);
  }
};
