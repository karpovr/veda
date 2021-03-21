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
    return veda.Backend.put_individual(veda.ticket, record)
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
    return veda.Backend.add_to_individual(veda.ticket, add)
  })
  .catch(err => {
    console.error(`Failed to add record ${JSON.stringify(record)} to journal ${journal_uri}`);
    throw err;
  })
};
