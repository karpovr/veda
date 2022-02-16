// BPMN utils

import veda from '../common/veda.js';

import Util from '../server/util.js';

const BPMN = {};

export default veda.BPMN = BPMN;

BPMN.addToJournal = function (journal_uri, record) {
  const journal = get_individual(veda.ticket, journal_uri);
  if (!journal) {
    console.error(`Journal not found: ${journal_uri}`);
    throw new Error(`Journal not found: ${journal_uri}`);
  }
  put_individual(veda.ticket, record);
  const add = {
    '@': journal_uri,
    'v-s:childRecord': Util.newUri(record['@']),
  };
  add_to_individual(veda.ticket, add);
};

BPMN.addToGroup = function (group, resource, restriction) {
  const membership_id = 'd:' + Util.Sha256.hash('membership' + group + resource + restriction);
  let membership = get_individual(veda.ticket, membership_id);
  if (!membership) {
    membership = {
      '@': membership_id,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:memberOf': Util.newUri(group),
      'v-s:resource': Util.newUri(resource),
    };
    restriction.toLowerCase().split('').forEach((char) => {
      let res;
      switch (char) {
      case 'c': res = 'v-s:canCreate'; break;
      case 'r': res = 'v-s:canRead'; break;
      case 'u': res = 'v-s:canUpdate'; break;
      case 'd': res = 'v-s:canDelete'; break;
      default: return;
      }
      membership[res] = Util.newBool(true);
    });
    put_individual(veda.ticket, membership);
  }
};

BPMN.addRight = function (subject, object, right) {
  const permission_statement_id = 'd:' + Util.Sha256.hash('permission statement' + subject + object + right);
  let permission_statement = get_individual(veda.ticket, permission_statement_id);
  if (!permission_statement) {
    permission_statement = {
      '@': permission_statement_id,
      'rdf:type': Util.newUri('v-s:PermissionStatement'),
      'v-s:permissionSubject': Util.newUri(subject),
      'v-s:permissionObject': Util.newUri(object),
    };
    right.toLowerCase().split('').forEach((char) => {
      let res;
      switch (char) {
      case 'c': res = 'v-s:canCreate'; break;
      case 'r': res = 'v-s:canRead'; break;
      case 'u': res = 'v-s:canUpdate'; break;
      case 'd': res = 'v-s:canDelete'; break;
      default: return;
      }
      permission_statement[res] = Util.newBool(true);
    });
    put_individual(veda.ticket, permission_statement);
  }
};
