// Utilities

import veda from '../common/veda.js';
import Sha256 from '../common/lib/sha256.js';
import Mustache from 'mustache';
import {addWorkingDays, isHoliday} from '../server/holidays_calendar.js';

const Util = {};

export default Util;

Util.Sha256 = Sha256;

Util.Mustache = Mustache;

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

Util.hasValue = function (individual, property, value) {
  const any = !!(individual && individual[property] && individual[property].length);
  if (!value) return any;
  return !!(any && individual[property].filter((i) => {
    return (i.type === value.type && i.data.valueOf() === value.data.valueOf());
  }).length);
};

Util.toJson = function (value) {
  return JSON.stringify(value, null, 2);
};

Util.addToGroup = function (ticket, group, resource, allow, deny, uri) {
  const new_membership_uri = uri || Util.genUri() + '-mbh';
  const new_membership = {
    '@': new_membership_uri,
    'rdf:type': Util.newUri('v-s:Membership'),
    'v-s:memberOf': Util.newUri(group),
    'v-s:resource': Util.newUri(resource),
  };

  (allow || []).forEach((right) => {
    new_membership[right] = Util.newBool(true);
  });

  (deny || []).forEach((right) => {
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

Util.addRight = function (ticket, subj_uri, obj_uri, allow, deny, uri) {
  if (subj_uri === undefined || obj_uri === undefined) {
    console.error('Util.addRight: INVALID ARGS', 'subj_uri =', subj_uri, 'obj_uri =', obj_uri);
    return;
  }

  uri = uri || Util.genUri() + '-r';

  const permission = {
    '@': uri,
    'rdf:type': Util.newUri('v-s:PermissionStatement'),
    'v-s:permissionObject': Util.newUri(obj_uri),
    'v-s:permissionSubject': Util.newUri(subj_uri),
  };

  (allow || []).forEach((right) => {
    permission[right] = Util.newBool(true);
  });

  (deny || []).forEach((right) => {
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
      if (Object.prototype.hasOwnProperty.call(obj, attr)) copy[attr] = Util.clone(obj[attr]);
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
        return value[property_uri].map((el) => el.data);
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
  return _bundle1['rdfs:label'][0] + _sep + _bundle2['rdfs:label'][0];
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
    data: _data.toISOString(),
    type: 'Datetime',
  }];
};

Util.addDay = addWorkingDays;

Util.isHoliday = isHoliday;

Util.getValues = function (property_value) {
  const res = [];
  if (property_value) {
    for (const i in property_value) {
      if (!Object.prototype.hasOwnProperty.call(property_value, i)) {
        continue;
      }
      res.push(property_value[i].data);
    }
  }
  return res;
};

Util.getUris = Util.getValues;

Util.getStrings = Util.getValues;

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

  return {
    '@': new_journal_record_uri,
    'rdf:type': Util.newUri('v-s:JournalRecord'),
    'v-s:parentJournal': Util.newUri(journal_uri),
    'v-s:created': Util.newDate(new Date()),
  };
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
};

Util.create_version = function (ticket, document, prev_state, user_uri, _event_id) {
  // Only if we save actual version of document (or it is first save of versioned document)
  if ( !document['v-s:actualVersion'] || document['v-s:actualVersion'][0].data === document['@'] ) {
    const user = get_individual(ticket, user_uri);
    const appointment_uri = Util.getUri(user['v-s:defaultAppointment']) || Util.getUri(user['v-s:hasAppointment']);
    const actor_uri = appointment_uri || user_uri;

    const versionId = Util.genUri() + '-vr';

    // Create new version
    const version = Util.clone(prev_state);
    version['@'] = versionId;
    version['v-s:actualVersion'] = [{
      data: document['@'],
      type: 'Uri',
    }];
    version['v-s:nextVersion'] = [{
      data: document['@'],
      type: 'Uri',
    }];
    if (Util.hasValue(document, 'v-s:previousVersion')) {
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
    Util.addToGroup(ticket, document['@'], version['@'], ['v-s:canRead']);

    // Update previous version
    if (document['v-s:previousVersion']) {
      const previous = get_individual(ticket, Util.getUri(document['v-s:previousVersion']));
      previous['v-s:nextVersion'] = Util.newUri(version['@']);
      put_individual(ticket, previous, _event_id);
    }

    // Update actual version
    document['v-s:actualVersion'] = Util.newUri(document['@']);
    document['v-s:previousVersion'] = Util.newUri(version['@']);
    document['v-s:edited'] = Util.newDate(new Date());
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
    elem['v-wf:decisionFormList'].forEach((dfae) => {
      const df = get_individual(ticket, dfae.data);
      if (!df['v-wf:isCompleted'] || !df['v-wf:isCompleted'][0].data) {
        df['v-s:deleted'] = Util.newBool(true);
        df['v-wf:isStopped'] = Util.newBool(true);
        put_individual(ticket, df, _event_id);
      }
    });
  }

  if (elem['v-wf:workItemList']) {
    elem['v-wf:workItemList'].forEach((wi) => {
      Util.recursiveCall(get_individual(ticket, wi.data), path, ticket, _event_id);
    });
  }

  if (elem['v-wf:workOrderList']) {
    elem['v-wf:workOrderList'].forEach((wo) => {
      Util.recursiveCall(get_individual(ticket, wo.data), path, ticket, _event_id);
    });
  }

  if (elem['v-wf:isProcess']) {
    elem['v-wf:isProcess'].forEach((p) => {
      const df = get_individual(ticket, p.data);
      if (!df['v-wf:isCompleted'] || !df['v-wf:isCompleted'][0].data) {
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

Util.getChief = function (appointmentUri, curAppointment) {
  if (curAppointment == undefined) curAppointment = appointmentUri;
  const appointment = get_individual(ticket, appointmentUri);
  if (appointment == undefined) return [];
  if (
    veda.Util.hasValue(appointment, 'v-s:hasChief') &&
    !veda.Util.hasValue(appointment, 'v-s:hasChief', {data: curAppointment, type: 'Uri'})
  ) {
    return appointment['v-s:hasChief'];
  } else {
    if (veda.Util.hasValue(appointment, 'v-s:parentUnit')) {
      const parentUnit = appointment['v-s:parentUnit'][0].data;
      return getChief(parentUnit, curAppointment);
    } else {
      return [];
    }
  }
};

Util.getFieldChief = function (appointmentUri, curAppointment) {
  if (curAppointment == undefined) curAppointment = appointmentUri;
  const appointment = get_individual(ticket, appointmentUri);
  if (appointment == undefined) return [];
  if (
    veda.Util.hasValue(appointment, 'v-s:hasFieldChief') &&
    !veda.Util.hasValue(appointment, 'v-s:hasFieldChief', {data: curAppointment, type: 'Uri'})
  ) {
    return appointment['v-s:hasFieldChief'];
  } else {
    if (veda.Util.hasValue(appointment, 'v-s:parentUnit')) {
      const parentUnit = appointment['v-s:parentUnit'][0].data;
      return getFieldChief(parentUnit, curAppointment);
    } else {
      return [];
    }
  }
};
