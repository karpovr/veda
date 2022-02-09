import Backend from '../../js/browser/backend_browser.js';
import assert from 'assert';
import Constants from './constants.js';
import ServerUtil from '../../js/server/util.js';
import CommonUtil from '../../js/common/util.js';
const Util = {...ServerUtil, ...CommonUtil};

export default class Helpers {
  static async get_admin_ticket () {
    return await Backend.authenticate('karpovrt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
  }

  static async get_user1_ticket () {
    return await Backend.authenticate('bushenevvt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
  }

  static async get_user2_ticket () {
    return await Backend.authenticate('BychinAt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
  }

  static generate_test_document1 (ticket) {
    const new_test_doc1_uri = Util.genUri();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource1'),
      'v-s:test_integer_32': Util.newInt(922337203),
      'v-s:test_integer_64': Util.newInt(9223372036854775295),
      'v-s:test_negative_integer': Util.newInt(-144365435),
      'v-s:test_decimal': Util.newDecimal(12.12345678912345),
      'v-s:test_negative_decimal': Util.newDecimal(-54.89764),
      'v-s:test_decimal2': Util.newDecimal(0.7),
      'v-s:test_decimal3': Util.newDecimal(764.3),
      'v-s:test_decimal4': Util.newDecimal(90.8),
      'v-s:test_decimal5': Util.newDecimal(7.6),
      'v-s:test_decimal6': Util.newDecimal(0.07),
      'v-s:test_decimal6_1': Util.newDecimal(-0.07),
      'v-s:test_decimal7': Util.newDecimal(0.007),
      'v-s:test_decimal8': Util.newDecimal(1),
      'v-s:test_decimal9': Util.newDecimal(5.0),
      'v-s:test_decimal10': Util.newDecimal(146291.02),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_datetime0': Util.newDate(new Date('2014-01-02')),
      'v-s:test_datetime1': Util.newDate(new Date('2014-01-02T20:00')),
      'v-s:test_datetime2': Util.newDate(new Date('2014-01-02T20:10:24')),
      'v-s:test_datetime3': Util.newDate(new Date('2014-01-02T20:10:24.768')),
      'v-s:test_datetime4': Util.newDate(new Date('1960-01-02')),
      'v-s:canUpdate': Util.newBool(true),
      'v-s:permissionSubject': Util.newUri('individual_' + Util.guid()),
      'v-s:author': Util.newUri(ticket.user_uri),
    };
    return new_test_doc1;
  }

  static generate_test_document2 (ticket) {
    const new_test_doc2_uri = Util.genUri();
    const new_test_doc2 = {
      '@': new_test_doc2_uri,
      'rdf:type': Util.newUri('rdfs:Resource1'),
      'v-s:test_integer_32': [Util.newInt(922337203)[0], Util.newInt(456403)[0]],
      'v-s:test_negative_integer': Util.newInt(-144365435),
      'v-s:test_decimal': Util.newDecimal(12.12345678912345),
      'v-s:test_negative_decimal': Util.newDecimal(-54.89764),
      'v-s:test_decimal2': [Util.newDecimal(0.7)[0], Util.newDecimal(0.4)[0]],
      'v-s:test_decimal3': Util.newDecimal(764.3),
      'v-s:test_decimal4': Util.newDecimal(90.8),
      'v-s:test_decimal5': Util.newDecimal(7.6),
      'v-s:test_decimal6': Util.newDecimal(0.07),
      'v-s:test_decimal6_1': Util.newDecimal(-0.07),
      'v-s:test_decimal7': Util.newDecimal(0.007),
      'v-s:test_decimal8': Util.newDecimal(1),
      'v-s:test_decimal9': Util.newDecimal(5.0),
      'v-s:test_decimal10': Util.newDecimal(146291.02),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_datetime0': Util.newDate(new Date('2014-01-02')),
      'v-s:test_datetime1': Util.newDate(new Date('2014-01-02T20:00')),
      'v-s:test_datetime2': Util.newDate(new Date('2014-01-02T20:10:24')),
      'v-s:test_datetime3': Util.newDate(new Date('2014-01-02T20:10:24.768')),
      'v-s:test_datetime4': Util.newDate(new Date('1960-01-02')),
      'v-s:canUpdate': Util.newBool(true),
      'v-s:permissionSubject': [Util.newUri('individual_' + Util.guid())[0], Util.newUri('individual_' + Util.guid())[0]],
      'rdfs:label': [Util.newStr('Русский', 'RU')[0], Util.newStr('English', 'EN')[0]],
      'v-s:author': Util.newUri(ticket.user_uri),
    };

    return new_test_doc2;
  }

  static generate_test_document3 (ticket) {
    const new_test_doc3_uri = Util.genUri();
    const new_test_doc3 = {
      '@': new_test_doc3_uri,
      'rdf:type': Util.newUri('rdfs:Resource1'),
      'v-s:created': Util.newDate(new Date()),
      'rdfs:label': [Util.newStr('Русский', 'RU')[0], Util.newStr('English', 'EN')[0]],
      'v-s:author': Util.newUri(ticket.user_uri),
    };
    return new_test_doc3;
  }

  static generate_test_document4 (ticket) {
    const new_test_doc4_uri = Util.genUri();
    const new_test_doc4 = {
      '@': new_test_doc4_uri,
      'rdf:type': Util.newUri('rdfs:Resource1'),
      'v-s:created': Util.newDate(new Date()),
      'rdfs:label': [Util.newStr('Русский', 'RU')[0], Util.newStr('English', 'EN')[0]],
      'v-s:author': Util.newUri(ticket.user_uri),
    };
    return new_test_doc4;
  }

  static generate_test_membership1 (ticket, doc_group) {
    const new_test_membership1_uri = Util.genUri();
    const new_test_membership1 = {
      '@': new_test_membership1_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:isExclusive': Util.newBool(true),
      'v-s:resource': Util.newUri('td:ValeriyBushenev'),
      'v-s:memberOf': Util.newUri(doc_group),
      'rdfs:label': [Util.newStr('Русский', 'RU')[0], Util.newStr('English', 'EN')[0]],
      'v-s:author': Util.newUri(ticket.user_uri),
      'v-s:created': Util.newDate(new Date()),
    };
    return new_test_membership1;
  }

  static generate_test_membership2 (ticket, doc_group) {
    const new_test_membership2_uri = Util.genUri();
    const new_test_membership2 = {
      '@': new_test_membership2_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:ignoreExclusive': Util.newBool(true),
      'v-s:resource': Util.newUri('td:ValeriyBushenev'),
      'v-s:memberOf': Util.newUri(doc_group),
      'rdfs:label': [Util.newStr('Русский', 'RU')[0], Util.newStr('English', 'EN')[0]],
      'v-s:created': Util.newDate(new Date()),
      'v-s:author': Util.newUri(ticket.user_uri),
    };
    return new_test_membership2;
  }

  static async create_test_document1 (ticket, prefix) {
    const new_test_doc1 = Helpers.generate_test_document1(ticket);

    if (prefix) {
      new_test_doc1['@'] = prefix + new_test_doc1['@'];
    }

    const res = await Backend.put_individual(ticket.ticket, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    return new_test_doc1;
  }

  static async create_test_document2 (ticket, prefix) {
    const new_test_doc2 = Helpers.generate_test_document2(ticket);

    if (prefix) {
      new_test_doc2['@'] = prefix + new_test_doc2['@'];
    }

    const res = await Backend.put_individual(ticket.ticket, new_test_doc2);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    return new_test_doc2;
  }

  static async create_test_document3 (ticket) {
    const new_test_doc3 = Helpers.generate_test_document3(ticket);
    const res = await Backend.put_individual(ticket.ticket, new_test_doc3);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    return new_test_doc3;
  }

  static async create_test_document4 (ticket) {
    const new_test_doc4 = Helpers.generate_test_document4(ticket);
    const res = await Backend.put_individual(ticket.ticket, new_test_doc4);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    return new_test_doc4;
  }

  static async create_test_membership1 (ticket, doc_group) {
    const new_test_membership1 = Helpers.generate_test_membership1(ticket, doc_group);
    const res = await Backend.put_individual(ticket.ticket, new_test_membership1);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    return new_test_membership1;
  }

  static async create_test_membership2 (ticket, doc_group) {
    const new_test_membership2 = Helpers.generate_test_membership2(ticket, doc_group);
    const res = await Backend.put_individual(ticket.ticket, new_test_membership2);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    return new_test_membership2;
  }

  static async check_rights (ticket, uri, expected_rights) {
    const rights = await Backend.get_rights(ticket, uri);
    let result = true;
    for (let i = 0; i < expected_rights.length; i++) {
      const expected = expected_rights[i];
      if (expected === Constants.can_create) {
        result = result && ('v-s:canCreate' in rights);
      } else if (expected === Constants.can_read) {
        result = result && ('v-s:canRead' in rights);
      } else if (expected === Constants.can_update) {
        result = result && ('v-s:canUpdate' in rights);
      } else if (expected === Constants.can_delete) {
        result = result && ('v-s:canDelete' in rights);
      }
    }
    return result;
  }

  static compare (a, b) {
    if (typeof a === 'function') {
      return a.toString() === b.toString();
    } else if (typeof a != 'object' || typeof b != 'object') {
      return a === b;
    }
    if (a instanceof Date) {
      return a.toString() == b.toString();
    }
    const dl = Object.keys(a).length - Object.keys(b).length;
    if (dl > 1 || dl < -1) return false;
    let result = true;
    for (const key in a) {
      if (Object.hasOwnProperty(a, key)) {
        let bb = b[key];
        let aa = a[key];

        const tbb = typeof bb;
        const taa = typeof aa;

        if (key == 'v-s:updateCounter') {
          continue;
        }

        if (key == 'type') {
          if (tbb == 'number' && taa == 'string') {
            if (bb == 'Uri') {
              bb = 'Uri';
            } else if (bb == 'String') {
              bb = 'String';
            } else if (bb == 'Integer') {
              bb = 'Integer';
            } else if (bb == 'Datetime') {
              bb = 'Datetime';
            } else if (bb == 'Decimal') {
              bb = 'Decimal';
            } else if (bb == 'Boolean') {
              bb = 'Boolean';
            }
          } else if (taa == 'number' && tbb == 'string') {
            if (aa == 'Uri') {
              aa = 'Uri';
            } else if (aa == 'String') {
              aa = 'String';
            } else if (aa == 'Integer') {
              aa = 'Integer';
            } else if (aa == 'Datetime') {
              aa = 'Datetime';
            } else if (aa == 'Decimal') {
              aa = 'Decimal';
            } else if (aa == 'Boolean') {
              aa = 'Boolean';
            }
          }
        } else if (key == 'lang') {
          if (tbb == 'number' && taa == 'string') {
            if (bb == 0) {
              bb = 'NONE';
            }
          } else if (taa == 'number' && tbb == 'string') {
            if (aa == 0) {
              aa = 'NONE';
            }
          }
        }
        result &= compare(aa, bb);
        if (!result) {
          return false;
        }
      }
    }
    return result;
  }

  static async addToGroup (ticket, group, resource, allow, deny) {
    const new_membership_uri = Util.genUri() + '-mbh';
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

    const res = await Backend.put_individual(ticket, new_membership);
    return [new_membership, res];
  };

  static async removeFromGroup (ticket, group, resource) {
    const membership_uri = Util.genUri() + '-mbh';
    const membership = {
      '@': membership_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:memberOf': Util.newUri(group),
      'v-s:resource': Util.newUri(resource),
      'v-s:deleted': Util.newBool(true),
    };

    const res = await Backend.put_individual(ticket, membership);
    return [membership, res];
  }

  static async addRight (ticket, subj_uri, obj_uri, allow, deny, filter) {
    const permission_uri = Util.genUri() + '-r';
    const permission = {
      '@': permission_uri,
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

    if (filter) {
      permission['v-s:useFilter'] = Util.newUri(filter);
    }

    const res = await Backend.put_individual(ticket, permission);
    return [permission, res];
  }

  static async test_success_read (ticket, original_individual) {
    const server_individual = await Backend.get_individual(ticket.ticket, original_individual['@']);
    assert(Helpers.compare(server_individual, original_individual));
  }

  static async test_fail_read (ticket, original_individual) {
    assert.rejects(Backend.get_individual(ticket.ticket, original_individual['@']));
  }

  static async test_success_update (ticket, indvidual) {
    await Backend.put_individual(ticket.ticket, indvidual);
  }

  static async test_fail_update (ticket, indvidual) {
    assert.rejects(Backend.put_individual(ticket.ticket, indvidual));
  }

  static async check_rights_success (ticket, uri, expected_rights) {
    const res = await Helpers.check_rights(ticket, uri, expected_rights);
    assert(res === true);
  }

  static async check_rights_fail (ticket, uri, expected_rights) {
    const res = await Helpers.check_rights(ticket, uri, expected_rights);
    assert(res === false);
  }

  static async check_rights (ticket, uri, expected_rights) {
    const rights = await Backend.get_rights(ticket, uri);

    let result = true;

    for (let i = 0; i < expected_rights.length; i++) {
      const expected = expected_rights[i];
      if (expected === 'v-s:canCreate') {
        result = result && ('v-s:canCreate' in rights);
      } else if (expected === 'v-s:canRead') {
        result = result && ('v-s:canRead' in rights);
      } else if (expected === 'v-s:canUpdate') {
        result = result && ('v-s:canUpdate' in rights);
      } else if (expected === 'v-s:canDelete') {
        result = result && ('v-s:canDelete' in rights);
      }
    }

    return result;
  }
}
