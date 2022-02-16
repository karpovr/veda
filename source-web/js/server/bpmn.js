// BPMN utils

import veda from '../common/veda.js';

import ServerUtil from '../server/util.js';

const BPMN = {};

export default BPMN;

BPMN.addToJournal = function (journal_uri, record) {
  const journal = get_individual(veda.ticket, journal_uri);
  if (!journal) {
    console.error(`Journal not found: ${journal_uri}`);
    throw new Error(`Journal not found: ${journal_uri}`);
  }
  put_individual(veda.ticket, record);
  const add = {
    '@': journal_uri,
    'v-s:childRecord': ServerUtil.newUri(record['@']),
  };
  add_to_individual(veda.ticket, add);
};

BPMN.addToGroup = function (group, resource, restriction) {
  const membership_id = 'd:' + ServerUtil.Sha256.hash('membership' + group + resource + restriction);
  let membership = get_individual(veda.ticket, membership_id);
  if (!membership) {
    membership = {
      '@': membership_id,
      'rdf:type': ServerUtil.newUri('v-s:Membership'),
      'v-s:memberOf': ServerUtil.newUri(group),
      'v-s:resource': ServerUtil.newUri(resource),
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
      membership[res] = ServerUtil.newBool(true);
    });
    put_individual(veda.ticket, membership);
  }
};

BPMN.addRight = function (subject, object, right) {
  const permission_statement_id = 'd:' + ServerUtil.Sha256.hash('permission statement' + subject + object + right);
  let permission_statement = get_individual(veda.ticket, permission_statement_id);
  if (!permission_statement) {
    permission_statement = {
      '@': permission_statement_id,
      'rdf:type': ServerUtil.newUri('v-s:PermissionStatement'),
      'v-s:permissionSubject': ServerUtil.newUri(subject),
      'v-s:permissionObject': ServerUtil.newUri(object),
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
      permission_statement[res] = ServerUtil.newBool(true);
    });
    put_individual(veda.ticket, permission_statement);
  }
};
