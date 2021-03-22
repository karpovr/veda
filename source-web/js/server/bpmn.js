/**
 * BPMN utils
 *
 */

import veda from '../common/veda.js';

const BPMN = {};

export default veda.BPMN = BPMN;

BPMN.addToJournal = function (journal_uri, record) {
  veda.Backend.get_individual(veda.ticket, journal_uri)
  .catch(err => {
    console.error(`Journal not found: ${journal_uri}`);
    throw err;
  })
  .then(() => {
    return veda.Backend.put_individual(veda.ticket, record);
  })
  .catch(err => {
    console.error(`Failed to create journal record ${JSON.stringify(record)}`);
    throw err;
  })
  .then(() => {
    const add = {
      '@': journal_uri,
      'v-s:childRecord': veda.Util.newUri(record['@']),
    }
    return veda.Backend.add_to_individual(veda.ticket, add);
  })
  .catch(err => {
    console.error(`Failed to add record ${JSON.stringify(record)} to journal ${journal_uri}`);
    throw err;
  })
};

BPMN.addToGroup = function (group, resource, restriction) {
  const membership_id = 'd:' + veda.Util.Sha256.hash('membership' + group + resource + restriction);
  return veda.Backend.get_individual(veda.ticket, membership_id)
    .catch(() => {
      let membership = {
        '@':  membership_id,
        'rdf:type': veda.Util.newUri('v-s:Membership'),
        'v-s:memberOf': veda.Util.newUri(group),
        'v-s:resource': veda.Util.newUri(resource),
      };
      restriction.toLowerCase().split('').forEach(char => {
        let res;
        switch (char) {
          case 'c': res = 'v-s:canCreate'; break;
          case 'r': res = 'v-s:canRead'; break;
          case 'u': res = 'v-s:canUpdate'; break;
          case 'd': res = 'v-s:canDelete'; break;
          default: return;
        }
        membership[res] = veda.Util.newBool(true);
      });
      return veda.Backend.put_individual(veda.ticket, membership);
    });
};

BPMN.addRight = function (subject, object, right) {
  const permission_statement_id = 'd:' + veda.Util.Sha256.hash('permission statement' + subject + object + right);
  return veda.Backend.get_individual(veda.ticket, permission_statement_id)
    .catch(() => {
      let permission_statement = {
        '@':  permission_statement_id,
        'rdf:type': veda.Util.newUri('v-s:PermissionStatement'),
        'v-s:permissionSubject': veda.Util.newUri(subject),
        'v-s:permissionObject': veda.Util.newUri(object),
      };
      right.toLowerCase().split('').forEach(char => {
        let res;
        switch (char) {
          case 'c': res = 'v-s:canCreate'; break;
          case 'r': res = 'v-s:canRead'; break;
          case 'u': res = 'v-s:canUpdate'; break;
          case 'd': res = 'v-s:canDelete'; break;
          default: return;
        }
        permission_statement[res] = veda.Util.newBool(true);
      });
      return veda.Backend.put_individual(veda.ticket, permission_statement);
    });
};
