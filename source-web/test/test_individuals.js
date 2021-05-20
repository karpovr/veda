// QUnit veda server API tests

var Backend;

if (typeof exports === 'object') {
    var fs = require("fs");
    eval(fs.readFileSync(__dirname + '/lib/util.js').toString());
    Backend = require('./lib/backend.js').Backend;
}

Backend = new Backend();

QUnit.module('Individuals');

var _admin_ticket = '';
var _user1_ticket = '';
var _user2_ticket = '';
var _event_id;

function get_admin_ticket() {
    if (_admin_ticket == '') {
        return _admin_ticket = Backend.authenticate("karpovrt", "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3");
    }
    return _admin_ticket;
}

function get_user1_ticket() {
    if (_user1_ticket == '') {
        _user1_ticket = Backend.authenticate("bushenevvt", "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3");
    }
    return _user1_ticket;
}

function get_user2_ticket() {
    if (_user2_ticket == '') {
        _user2_ticket = Backend.authenticate("BychinAt", "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3");
    }
    return _user2_ticket;
}

function generate_test_document1(ticket) {
    var new_test_doc1_uri = genUri();
    var new_test_doc1 = {
        '@': new_test_doc1_uri,
        'rdf:type': newUri('rdfs:Resource1'),
        'v-s:test_integer_32': newInt(922337203),
        'v-s:test_integer_64': newInt(9223372036854775295),
        'v-s:test_negative_integer': newInt(-144365435),
        'v-s:test_decimal': newDecimal(12.12345678912345),
        'v-s:test_negative_decimal': newDecimal(-54.89764),
        'v-s:test_decimal2': newDecimal(0.7),
        'v-s:test_decimal3': newDecimal(764.3),
        'v-s:test_decimal4': newDecimal(90.8),
        'v-s:test_decimal5': newDecimal(7.6),
        'v-s:test_decimal6': newDecimal(0.07),
        'v-s:test_decimal6_1': newDecimal(-0.07),
        'v-s:test_decimal7': newDecimal(0.007),
        'v-s:test_decimal8': newDecimal(1),
        'v-s:test_decimal9': newDecimal(5.0),
        'v-s:created': newDate(new Date()),
        'v-s:test_datetime0': newDate(new Date("2014-01-02")),
        'v-s:test_datetime1': newDate(new Date("2014-01-02T20:00")),
        'v-s:test_datetime2': newDate(new Date("2014-01-02T20:10:24")),
        'v-s:test_datetime3': newDate(new Date("2014-01-02T20:10:24.768")),
        'v-s:test_datetime4': newDate(new Date("1960-01-02")),
        'v-s:canUpdate': newBool(true),
        'v-s:permissionSubject': newUri('individual_' + guid()),
        'v-s:author': newUri(ticket.user_uri)
    };
    return new_test_doc1;
}

function generate_test_document2(ticket) {
    var new_test_doc2_uri = genUri();
    var new_test_doc2 = {
        '@': new_test_doc2_uri,
        'rdf:type': newUri('rdfs:Resource1'),
        'v-s:test_integer_32': [newInt(922337203)[0], newInt(456403)[0]],
        'v-s:test_negative_integer': newInt(-144365435),
        'v-s:test_decimal': newDecimal(12.12345678912345),
        'v-s:test_negative_decimal': newDecimal(-54.89764),
        'v-s:test_decimal2': [newDecimal(0.7)[0], newDecimal(0.4)[0]],
        'v-s:test_decimal3': newDecimal(764.3),
        'v-s:test_decimal4': newDecimal(90.8),
        'v-s:test_decimal5': newDecimal(7.6),
        'v-s:test_decimal6': newDecimal(0.07),
        'v-s:test_decimal6_1': newDecimal(-0.07),
        'v-s:test_decimal7': newDecimal(0.007),
        'v-s:test_decimal8': newDecimal(1),
        'v-s:test_decimal9': newDecimal(5.0),
        'v-s:created': newDate(new Date()),
        'v-s:test_datetime0': newDate(new Date("2014-01-02")),
        'v-s:test_datetime1': newDate(new Date("2014-01-02T20:00")),
        'v-s:test_datetime2': newDate(new Date("2014-01-02T20:10:24")),
        'v-s:test_datetime3': newDate(new Date("2014-01-02T20:10:24.768")),
        'v-s:test_datetime4': newDate(new Date("1960-01-02")),
        'v-s:canUpdate': newBool(true),
        'v-s:permissionSubject': [newUri('individual_' + guid())[0], newUri('individual_' + guid())[0]],
        'rdfs:label': [newStr("Русский", "RU")[0], newStr("English", "EN")[0]],
        'v-s:author': newUri(ticket.user_uri)
    };

    return new_test_doc2;
}

function generate_test_document3(ticket) {
    var new_test_doc3_uri = genUri();
    var new_test_doc3 = {
        '@': new_test_doc3_uri,
        'rdf:type': newUri('rdfs:Resource1'),
        'v-s:created': newDate(new Date()),
        'rdfs:label': [newStr("Русский", "RU")[0], newStr("English", "EN")[0]],
        'v-s:author': newUri(ticket.user_uri)
    };
    return new_test_doc3;
}

function create_test_document3(ticket) {
    var new_test_doc3 = generate_test_document3(ticket)
    var res = Backend.put_individual(ticket.id, new_test_doc3);
    Backend.wait_module(m_acl, res.op_id);
    Backend.wait_module(m_scripts, res.op_id);
    return new_test_doc3;
}

function generate_test_document4(ticket) {
    var new_test_doc4_uri = genUri();
    var new_test_doc4 = {
        '@': new_test_doc4_uri,
        'rdf:type': newUri('rdfs:Resource1'),
        'v-s:created': newDate(new Date()),
        'rdfs:label': [newStr("Русский", "RU")[0], newStr("English", "EN")[0]],
        'v-s:author': newUri(ticket.user_uri)
    };
    return new_test_doc4;
}

function create_test_document4(ticket) {
    var new_test_doc4 = generate_test_document4(ticket)
    var res = Backend.put_individual(ticket.id, new_test_doc4);
    Backend.wait_module(m_acl, res.op_id);
    Backend.wait_module(m_scripts, res.op_id);
    return new_test_doc4;
}

function generate_test_membership1(ticket, doc_group) {
    var new_test_membership1_uri = genUri();
    var new_test_membership1 = {
        '@': new_test_membership1_uri,
        'rdf:type': newUri('v-s:Membership'),
        'v-s:isExclusive': newBool(true),
        'v-s:resource': newUri('td:ValeriyBushenev'),
        'v-s:memberOf': newUri(doc_group),
        'rdfs:label': [newStr("Русский", "RU")[0], newStr("English", "EN")[0]],
        'v-s:author': newUri(ticket.user_uri),
        'v-s:created': newDate(new Date())
    };
    return new_test_membership1;
}

function create_test_membership1(ticket, doc_group) {
    var new_test_membership1 = generate_test_membership1(ticket, doc_group)
    var res = Backend.put_individual(ticket.id, new_test_membership1);
    Backend.wait_module(m_acl, res.op_id);
    Backend.wait_module(m_scripts, res.op_id);
    return new_test_membership1;
}

function generate_test_membership2(ticket, doc_group) {
    var new_test_membership2_uri = genUri();
    var new_test_membership2 = {
        '@': new_test_membership2_uri,
        'rdf:type': newUri('v-s:Membership'),
        'v-s:ignoreExclusive': newBool(true),
        'v-s:resource': newUri('td:ValeriyBushenev'),
        'v-s:memberOf': newUri(doc_group),
        'rdfs:label': [newStr("Русский", "RU")[0], newStr("English", "EN")[0]],
        'v-s:created': newDate(new Date()),
        'v-s:author': newUri(ticket.user_uri)
    };
    return new_test_membership2;
}

function create_test_membership2(ticket, doc_group) {
    var new_test_membership2 = generate_test_membership2(ticket, doc_group)
    var res = Backend.put_individual(ticket.id, new_test_membership2);
    Backend.wait_module(m_acl, res.op_id);
    Backend.wait_module(m_scripts, res.op_id);
    return new_test_membership2;
}

function create_test_document1(ticket, prefix) {
    var new_test_doc1 = generate_test_document1(ticket)

    if (prefix)
        new_test_doc1['@'] = prefix + new_test_doc1['@']

    var res = Backend.put_individual(ticket.id, new_test_doc1);
    //Backend.wait_module(m_subject, res.op_id);
    Backend.wait_module(m_acl, res.op_id);
    Backend.wait_module(m_scripts, res.op_id);
    return new_test_doc1;
}

function create_test_document2(ticket, prefix) {
    var new_test_doc2 = generate_test_document2(ticket)

    if (prefix)
        new_test_doc2['@'] = prefix + new_test_doc2['@']

    var res = Backend.put_individual(ticket.id, new_test_doc2);
    //Backend.wait_module(m_subject, res.op_id);
    Backend.wait_module(m_acl, res.op_id);
    Backend.wait_module(m_scripts, res.op_id);
    return new_test_doc2;
}

function test_success_read(assert, ticket, read_indv_uri, ethalon_indv, reopen) {
    var read_individual;

    if (!reopen)
        reopen = false;

    try {
        read_individual = Backend.get_individual(ticket.id, read_indv_uri, reopen);
    } catch (e) {
        read_individual = {};
    }

    var res = compare(ethalon_indv, read_individual);
    assert.ok(res == true);

    return res == true;
}

function test_fail_read(assert, ticket, read_indv_uri, ethalon_indv, reopen) {
    var read_individual;

    if (!reopen)
        reopen = false;

    try {
        read_individual = Backend.get_individual(ticket.id, read_indv_uri, true);
    } catch (e) {
        read_individual = {};
    }

    var res = compare(ethalon_indv, read_individual);
    assert.ok(res == false);

    return res == false;
}


function test_success_update(assert, ticket, ethalon_indv, reopen) {
    if (!reopen)
        reopen = false;

    try {
        Backend.put_individual(ticket.id, ethalon_indv, reopen);
        assert.ok(true);
    } catch (e) {
        assert.ok(false);
    }
}

function test_fail_update(assert, ticket, ethalon_indv, reopen) {
    if (!reopen)
        reopen = false;

    try {
        Backend.put_individual(ticket.id, ethalon_indv, reopen);
        assert.ok(false);
    } catch (e) {
        assert.ok(true);
    }
}

function check_rights_success(assert, ticket, uri, expected_rights) {
    var res = check_rights(ticket, uri, expected_rights);
    return assert.ok(res === true);
}

function check_rights_fail(assert, ticket, uri, expected_rights) {
    var res = check_rights(ticket, uri, expected_rights);
    return assert.ok(res === false);
}

function check_rights(ticket, uri, expected_rights) {
    var rights = Backend.get_rights(ticket, uri);

    var result = true;

    for (var i = 0; i < expected_rights.length; i++) {
        var expected = expected_rights[i];
        if (expected === can_create) {
            result = result && ("v-s:canCreate" in rights);
        } else if (expected === can_read) {
            result = result && ("v-s:canRead" in rights);
        } else if (expected === can_update) {
            result = result && ("v-s:canUpdate" in rights);
        } else if (expected === can_delete) {
            result = result && ("v-s:canDelete" in rights);
        }
    }

    return result;
}

var i = 0;

for (i = 0; i < 1; i++) {
    QUnit.test(
        "#001 Login",
        function (assert) {
            var ticket = get_user1_ticket();

            //#1
            assert.ok(ticket.id.length > 0);
        });

    QUnit.test(
        "#002 Get individual 'owl:'",
        function (assert) {
            var ticket = get_user1_ticket();
            var res = Backend.get_individual(ticket.id, "owl:");

            //#1
            assert.ok(res["@"] == "owl:");

            var labels = res["rdfs:label"];

            var ee;
            for (var key in labels) {
                if (labels[key].lang == "RU") {
                    ee = labels[key];
                    break;
                }
            }

            //#2
            assert.ok(ee != null);

            //#3
            assert.ok(ee.data == "Словарь OWL 2 Schema (OWL 2)");
        });

    QUnit.test(
        "#003 Query '@' == 'owl:' ++ Get individual 'owl:'",
        function (assert) {
            var ticket = get_user1_ticket();
            var data = Backend.query(ticket.id, "owl:").result;

            //#1
            assert.ok(data.indexOf("owl:") >= 0);
        });
/*
    QUnit.test(
        "#100 SearchQuery",
        function (assert) {
            var ticket = get_user1_ticket();
            var data = Backend.query(ticket.id, "SELECT id FROM veda_tt.`owl:Class` WHERE id LIKE 'owl:%'").result;

            //#1
            assert.ok(data.indexOf("owl:Thing") >= 0);
            assert.ok(data.indexOf("owl:Nothing") >= 0);
        });
*/
    QUnit.test(
        "#004 search form test",
        function (assert) {
            var res;
            var ticket_user1 = get_user1_ticket();

            var test_group_uid = "test30:" + guid();

            var new_test_doc1_uri = "test30:" + guid();
            var label1 = "test30.1:" + guid();
            var comment = "comment30:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'rdfs:label': newUri(label1),
                'rdfs:comment': newUri(comment),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date())
            };

            var new_test_doc2_uri = "test30:" + guid();
            var label2 = "test30.2:" + guid();
            var new_test_doc2 = {
                '@': new_test_doc2_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'rdfs:label': newUri(label2),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date())
            };

            var new_test_doc3_uri = "test30.1:" + guid();
            var new_test_doc3 = {
                '@': new_test_doc3_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'rdfs:label': newUri(label1),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date())
            };

            var new_test_doc4_uri = "test30.1:" + guid();
            var new_test_doc4 = {
                '@': new_test_doc4_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'rdfs:label': newUri(label2),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date())
            };

            var new_test_doc5_uri = "test30.2:" + guid();
            var comment2 = "comm1" + guid();
            var new_test_doc5 = {
                '@': new_test_doc5_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'rdfs:label': newUri(label1),
                'rdfs:comment': newUri(comment2),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date())
            };

            var new_test_doc6_uri = "test30.2:" + guid();
            var new_test_doc6 = {
                '@': new_test_doc6_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date())
            };

            res = Backend.put_individual(ticket_user1.id, new_test_doc1, false);
            res = Backend.put_individual(ticket_user1.id, new_test_doc2, false);
            res = Backend.put_individual(ticket_user1.id, new_test_doc3, false);
            res = Backend.put_individual(ticket_user1.id, new_test_doc4, false);
            res = Backend.put_individual(ticket_user1.id, new_test_doc5, false);
            res = Backend.put_individual(ticket_user1.id, new_test_doc6, false);

            Backend.wait_module(m_fulltext_indexer, res.op_id);
            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            var data = Backend.query(ticket_user1.id, "'*' == 'test30.1*' && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#2
            assert.ok(compare(data.length, 3));

            var data = Backend.query(ticket_user1.id, test_group_uid, undefined, undefined, true).result;

            //#1
            assert.ok(compare(data.length, 6));

            var data = Backend.query(ticket_user1.id, "'@' == 'test30.1*' && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#3
            assert.ok(compare(data.length, 2));

            var data = Backend.query(ticket_user1.id, "('@' == 'test30.1*' || '@' == 'test30.2*') && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#4
            assert.ok(compare(data.length, 4));

            var data = Backend.query(ticket_user1.id, "'@' == 'test30*' && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#5
            assert.ok(compare(data.length, 6));

            var data = Backend.query(ticket_user1.id, "'rdfs:label.isExists' == 'true' && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#6
            assert.ok(compare(data.length, 5));

            var data = Backend.query(ticket_user1.id, "'rdfs:comment' == 'comment*' && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#7
            assert.ok(compare(data.length, 1));

            res = Backend.remove_individual(ticket_user1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#8
            test_fail_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);

            //var data = Backend.query(ticket_user1.id, "'rdfs:comment' == 'comment*' && 'v-s:deleted' == true && 'v-s:test_group' == '" + test_group_uid + "'" , undefined, undefined, true).result;

            //#9
            //assert.ok(compare(data.length, 1));

            var data = Backend.query(ticket_user1.id, "'rdfs:comment' == 'comm1*' && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#10
            assert.ok(compare(data.length, 1));

            //var data = Backend.query(ticket_user1.id, "'rdfs:comment' == 'comm1* && 'v-s:system' === true && 'v-s:test_group' === '" + test_group_uid + "'" , undefined, undefined, true).result;

            //#
            //assert.ok(compare(data.length, 1));

            //var data = Backend.query(ticket_user1.id, "(('rdfs:comment' == 'comment*' && 'v-s:deleted' == true) || ('rdfs:comment' == 'comm1*')) && 'v-s:test_group' == '" + test_group_uid + "'" , undefined, undefined, true).result;

            //#11
            //assert.ok(compare(data.length, 1));

            //var data = Backend.query(ticket_user1.id, "(('rdfs:comment' == 'comm1*') || ('rdfs:comment' == 'comment*' && 'v-s:deleted' == true)) && 'v-s:test_group' == '" + test_group_uid + "'" , undefined, undefined, true).result;

            //#
            //assert.ok(compare(data.length, 2));//0


            //var data = Backend.query(ticket_user1.id, "(('rdfs:comment' == 'comm1*' && 'v-s:basic' === true) || ('rdfs:comment' == 'comment*' && 'v-s:deleted' === true)) && 'v-s:test_group' === '" + test_group_uid + "'" , undefined, undefined, true).result;

            //#
            //assert.ok(compare(data.length, 2));//0

            //var data = Backend.query(ticket_user1.id, "(('rdfs:comment' == 'comment*' && 'v-s:deleted' === true) || ('rdfs:comment' == 'comm1*' && 'v-s:basic' === true)) && 'v-s:test_group' === '" + test_group_uid + "'" , undefined, undefined, true).result;

            //#
            //assert.ok(compare(data.length, 2));//0

            res = Backend.remove_individual(ticket_user1.id, new_test_doc5['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#12
            test_fail_read(assert, ticket_user1, new_test_doc5['@'], new_test_doc5);

            //var data = Backend.query(ticket_user1.id, "(('rdfs:comment' == 'comment*' && 'v-s:deleted' === true) || ('rdfs:comment' == 'comm1*' && 'v-s:basic' === true)) && 'v-s:test_group' === '" + test_group_uid + "'" , undefined, undefined, true).result;
            //
            //#
            //assert.ok(compare(data.length, 2));//0

            //var data = Backend.query(ticket_user1.id, "(('rdfs:comment' == 'comment*' && 'v-s:deleted' === true) || ('rdfs:comment' == 'comm1*')) && 'v-s:test_group' === '" + test_group_uid + "'" , undefined, undefined, true).result;

            //#13
            //assert.ok(compare(data.length, 2));

            res = Backend.remove_individual(ticket_user1.id, new_test_doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#14
            test_fail_read(assert, ticket_user1, new_test_doc2['@'], new_test_doc2);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#15
            test_fail_read(assert, ticket_user1, new_test_doc3['@'], new_test_doc3);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc4['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#16
            test_fail_read(assert, ticket_user1, new_test_doc4['@'], new_test_doc4);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc6['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#17
            test_fail_read(assert, ticket_user1, new_test_doc6['@'], new_test_doc6);

        }
    );

    QUnit.test(
        "#005 Individual store user1 and no read user2, +lang",
        function (assert) {
            var ticket_user1 = get_user1_ticket();

            //#1
            assert.ok(ticket_user1.id.length > 0);

            var ticket_user2 = get_user2_ticket();

            //#2
            assert.ok(ticket_user2.id.length > 0);

            var new_test_doc1_uri = "test3:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newStr('test data', 'EN')
            };

            var res = Backend.put_individual(ticket_user1.id, new_test_doc1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            //#3
            test_success_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);

            //#4
            test_fail_read(assert, ticket_user2, new_test_doc1['@'], new_test_doc1);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);
            //Backend.wait_module(m_acl, res.op_id);

            //#5
            test_fail_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);
        });

    QUnit.test(
        "#006 Individual store user1 and add right, user2 successfully read it, next user1 add denied right and no user2 fail read it",
        function (assert) {
            var ticket_user1 = get_user1_ticket();

            //#1
            assert.ok(ticket_user1.id.length > 0);

            var ticket_user2 = get_user2_ticket();

            //#2
            assert.ok(ticket_user2.id.length > 0);

            var new_test_doc1_uri = "test5:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newStr('test data', 'NONE')
            };

            var res = Backend.put_individual(ticket_user1.id, new_test_doc1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            //#3
            test_fail_read(assert, ticket_user2, new_test_doc1_uri, new_test_doc1);

            //#4
            test_success_read(assert, ticket_user1, new_test_doc1_uri, new_test_doc1);
            var read_individual;

            var res = addRight(ticket_user1.id, [can_read], ticket_user2.user_uri, new_test_doc1_uri);
            var new_permission = res[0];
            Backend.wait_module(m_acl, res[1].op_id);

            //#5
            test_success_read(assert, ticket_user2, new_test_doc1_uri, new_test_doc1, true);

            new_permission["@"] = "_";
            delete new_permission["v-s:permissionObject"];
            delete new_permission["v-s:permissionSubject"];

            var right1 = Backend.get_rights(ticket_user1.id, new_test_doc1_uri);
            var right2 = Backend.get_rights(ticket_user2.id, new_test_doc1_uri);

            //#6
            assert.ok(compare(new_permission, right2));

            new_permission['v-s:canUpdate'] = newBool(true);
            new_permission['v-s:canDelete'] = newBool(true);
            new_permission['v-s:canCreate'] = newBool(true);

            //#7
            assert.ok(compare(new_permission, right1));

            //#8
            test_success_read(assert, ticket_user2, new_test_doc1_uri, new_test_doc1);

            res = addRight(ticket_user1.id, [cant_read], ticket_user2.user_uri, new_test_doc1_uri);
            res = addRight(ticket_user1.id, [can_read], ticket_user2.user_uri, new_test_doc1_uri);
            Backend.wait_module(m_acl, res[1].op_id);

            //#9
            test_fail_read(assert, ticket_user2, new_test_doc1_uri, new_test_doc1);

            //#10
            try {
                // test UPDATE rights
                new_test_doc1['v-s:updateCounter'] = newInteger(0);
                res = Backend.put_individual(ticket_user2.id, new_test_doc1);
                assert.ok(false);
            } catch (e) {
                assert.ok(true);
            }

            res = Backend.remove_individual(ticket_user1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#11
            test_fail_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);
        });

    QUnit.test(
        "#007 Individual store user1 and read admin",
        function (assert) {

            var ticket_user1 = get_user1_ticket();

            //#1
            assert.ok(ticket_user1.id != "");

            var a_ticket = get_admin_ticket();

            var new_test_doc1_uri = "test6:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newStr('test data', 'NONE')
            };

            var res = Backend.put_individual(ticket_user1.id, new_test_doc1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            var read_individual = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

            //#2
            assert.ok(compare(new_test_doc1, read_individual));

            read_individual = Backend.get_individual(a_ticket.id, new_test_doc1_uri);

            //#3
            assert.ok(compare(new_test_doc1, read_individual));

            res = Backend.remove_individual(ticket_user1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#4
            test_fail_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);

        });

    QUnit.test(
        "#008 Individual store and read, test datatype",
        function (assert) {
            var ticket = get_user1_ticket();

            var new_test_doc1 = create_test_document1(ticket);

            var read_individual = Backend.get_individual(ticket.id, new_test_doc1['@']);

            //#1
            assert.ok(compare(new_test_doc1, read_individual));

            var res = Backend.remove_individual(ticket.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#2
            test_fail_read(assert, ticket, new_test_doc1['@'], new_test_doc1);
        }
    );

    QUnit.test("#009 test [v-s:PermissionStatement]: user1 store file, user2 not read file, add right for user2, add cant read right for user2",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var ticket2 = get_user2_ticket();

            var res;
            var new_test_doc1 = create_test_document1(ticket1);

            //#1
            res = test_success_read(assert, ticket1, new_test_doc1['@'], new_test_doc1);

            //#2
            res = test_fail_read(assert, ticket2, new_test_doc1['@'], new_test_doc1);

            res = addRight(ticket1.id, [can_read], ticket2.user_uri, new_test_doc1['@']);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            //#3
            res = test_success_read(assert, ticket2, new_test_doc1['@'], new_test_doc1, true);

            res = addRight(ticket1.id, [cant_read], ticket2.user_uri, new_test_doc1['@']);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            //#4
            res = test_fail_read(assert, ticket2, new_test_doc1['@'], new_test_doc1, true);

            res = Backend.remove_individual(ticket1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#5
            test_fail_read(assert, ticket1, new_test_doc1['@'], new_test_doc1);
        });

    QUnit.test(
        "#010 Individual of [v-s:NoPermissionStatement] store 3 and read 3",
        function (assert) {
            var ticket = get_user1_ticket();

            var permissionSubject = "test9:" + guid();
            var permissionObject = "test9:" + guid();

            var new_test_doc1_uri = "test9:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('v-s:NoPermissionStatement'),
                'v-s:canDelete': newBool(true),
                'v-s:canRead': newBool(true),
                'v-s:canUpdate': newBool(true),
                'v-s:permissionObject': newUri(permissionObject),
                'v-s:permissionSubject': newUri(permissionSubject),
                'v-s:created': newDate(new Date()),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1')
            };

            var res = Backend.put_individual(ticket.id, new_test_doc1);
            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);

            var read_individual = Backend.get_individual(ticket.id, new_test_doc1_uri, true);

            //#1
            assert.ok(compare(new_test_doc1, read_individual));

            res = Backend.remove_individual(ticket.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#2
            test_fail_read(assert, ticket, new_test_doc1['@'], new_test_doc1);

            var new_test_doc2 = new_test_doc1;
            var new_test_doc2_uri = "test9:" + guid();
            new_test_doc2['@'] = new_test_doc2_uri;
            new_test_doc2['v-s:canRead'] = newBool(false);
            var res = Backend.put_individual(ticket.id, new_test_doc2);
            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);

            read_individual = Backend.get_individual(ticket.id, new_test_doc2_uri, true);

            //#3
            assert.ok(compare(new_test_doc2, read_individual));


            res = Backend.remove_individual(ticket.id, new_test_doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#4
            test_fail_read(assert, ticket, new_test_doc2['@'], new_test_doc2);

            var new_test_doc3 = new_test_doc2;
            var new_test_doc3_uri = "test9:" + guid();
            new_test_doc3['@'] = new_test_doc3_uri;
            new_test_doc3['v-s:canRead'] = newBool(true);
            var res = Backend.put_individual(ticket.id, new_test_doc3);
            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);

            read_individual = Backend.get_individual(ticket.id, new_test_doc3_uri);

            //#5
            assert.ok((read_individual['@'] == new_test_doc3_uri) == true);

            res = Backend.remove_individual(ticket.id, new_test_doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#6
            test_fail_read(assert, ticket, new_test_doc3['@'], new_test_doc3);
        });

    QUnit.test("#011 Individual of [v-s:Membership]",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var ticket2 = get_user2_ticket();

            var res;
            var new_test_doc1 = create_test_document1(ticket1);

            //#1
            res = test_success_read(assert, ticket1, new_test_doc1['@'], new_test_doc1);

            //#2
            res = test_fail_read(assert, ticket2, new_test_doc1['@'], new_test_doc1);

            var doc_group = 'g:doc_g1roup_' + guid();
            var user_group = 'g:user_g1roup_' + guid();

            res = addToGroup(ticket1, doc_group, new_test_doc1['@']);
            res = addToGroup(ticket1, user_group, ticket2.user_uri);

            var membersip1 = res[0];

            res = addRight(ticket1.id, [can_read], user_group, doc_group);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            //#3
            res = test_success_read(assert, ticket2, new_test_doc1['@'], new_test_doc1, true);

            res = removeFromGroup(ticket1, user_group, ticket2.user_uri);
            Backend.wait_module(m_acl, res[1].op_id);

            //#4
            test_fail_read(assert, ticket2, new_test_doc1['@'], new_test_doc1, true);

            res = Backend.remove_individual(ticket1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#5
            test_fail_read(assert, ticket1, new_test_doc1['@'], new_test_doc1);
        });

    QUnit.test("#012 Individual of [v-s:NoMembership] store 3 and read 3 (this no membership)",
        function (assert) {
            var ticket = get_user1_ticket();

            var memberOf = "test11:" + guid();
            var resources = "test11:" + guid();

            var new_test_doc1_uri = "test11:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('v-s:ThisNoMembership'),
                'v-s:memberOf': newUri(memberOf),
                'v-s:resource': newUri(resources),
                'v-s:created': newDate(new Date()),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1')
            };

            var res = Backend.put_individual(ticket.id, new_test_doc1);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);

            var read_individual = Backend.get_individual(ticket.id, new_test_doc1_uri);

            //#1
            assert.ok(compare(new_test_doc1, read_individual));

            res = Backend.remove_individual(ticket.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#2
            test_fail_read(assert, ticket, new_test_doc1['@'], new_test_doc1);

            var new_test_doc2 = new_test_doc1;
            var new_test_doc2_uri = "test11:" + guid();
            new_test_doc2['@'] = new_test_doc2_uri;
            new_test_doc2['v-s:memberOf'] = newUri("test11:" + guid());
            var res = Backend.put_individual(ticket.id, new_test_doc2);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);

            read_individual = Backend.get_individual(ticket.id, new_test_doc2_uri);

            //#3
            assert.ok(compare(new_test_doc2, read_individual));

            res = Backend.remove_individual(ticket.id, new_test_doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#4
            test_fail_read(assert, ticket, new_test_doc2['@'], new_test_doc2);

            var new_test_doc3 = new_test_doc2;
            var new_test_doc3_uri = "test11:" + guid();
            new_test_doc3['@'] = new_test_doc3_uri;
            new_test_doc3['v-s:memberOf'] = newUri(memberOf);
            var res = Backend.put_individual(ticket.id, new_test_doc3);
            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);

            read_individual = Backend.get_individual(ticket.id, new_test_doc3_uri);

            //#5
            assert.ok((read_individual['@'] == new_test_doc3_uri) == true);

            res = Backend.remove_individual(ticket.id, new_test_doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#6
            test_fail_read(assert, ticket, new_test_doc3['@'], new_test_doc3);
        });

    QUnit.test(
        "#013 user1 store 3 individuals (one of the individuals contains an invalid field [author]), the user1 finds 2 individuals, and the user2 does not find anything.",
        function (assert) {
            var ticket_user1 = get_user1_ticket();

            //#1
            assert.ok(ticket_user1.id.length > 0);

            var ticket_user2 = get_user2_ticket();

            //#2
            assert.ok(ticket_user2.id.length > 0);

            var test_data_uid = "test12_" + guid();
            var test_data = 'testdata ' + test_data_uid;

            var new_test_doc1_uri_1 = "test12:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri_1,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newStr(test_data, 'NONE'),
                'v-s:test_fieldA': newUri('BBB' + test_data_uid),
                'v-s:test_fieldB': newUri('CCC' + test_data_uid)
            };

            // document content author != user1
            var new_test_doc1_uri_2 = "test12:" + guid();
            var new_test_doc2 = {
                '@': new_test_doc1_uri_2,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:AndreyBychin-Analyst2'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newUri(test_data)
            };

            var new_test_doc1_uri_3 = "test12:" + guid();
            var new_test_doc3 = {
                '@': new_test_doc1_uri_3,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newUri(test_data),
                'v-s:test_fieldA': newUri('BBB' + test_data_uid)
            };

            var new_test_doc1_uri_4 = "test12:" + guid();
            var new_test_doc4 = {
                '@': new_test_doc1_uri_4,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newUri('AAA' + test_data_uid),
                'v-s:test_fieldA': newUri('BBB' + test_data_uid),
                'v-s:test_fieldB': newUri('CCC' + test_data_uid)
            };

            var res = Backend.put_individual(ticket_user1.id, new_test_doc1, false);
            var res = Backend.put_individual(ticket_user1.id, new_test_doc2, false);
            var res = Backend.put_individual(ticket_user1.id, new_test_doc3, false);
            var res = Backend.put_individual(ticket_user1.id, new_test_doc4, false);

//            Backend.flush (m_fulltext_indexer, res.op_id);

            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_fulltext_indexer, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);

            var data = Backend.query(ticket_user1.id, test_data_uid, undefined, undefined, true).result;

            //#3
            assert.ok(compare(data.length, 2));

            data = Backend.query(ticket_user2.id, test_data_uid, undefined, undefined, true).result;

            //#4
            assert.ok(compare(data.length, 0));

            data = Backend.query(ticket_user1.id, "'v-s:test_field' === '" + test_data_uid + "'", undefined, undefined, true).result;

            //#5
            assert.ok(compare(data.length, 2));

            try {
                data = Backend.query(ticket_user1.id, "'v-s:test_field1' === '" + test_data_uid + "'", undefined, undefined, true).result;
            } catch (e) {
                assert.ok(true);
            }

            try {
                data = Backend.query(ticket_user1.id, "'v-s:test_field1' === '" + test_data_uid + " t1'", undefined, undefined, true).result;
            } catch (e) {
                assert.ok(true);
            }

            data = Backend.query(ticket_user1.id, "'v-s:test_field' === '" + test_data_uid + "' || 'v-s:test_field' === 'AAA" + test_data_uid + "'", undefined, undefined, true).result;

            //#8
            assert.ok(compare(data.length, 3));

            data = Backend.query(ticket_user1.id, "'v-s:test_fieldB' === 'CCC" + test_data_uid + "' && 'v-s:test_fieldA' === 'BBB" + test_data_uid + "'", undefined, undefined, true).result;

            //#9
            assert.ok(compare(data.length, 2));


            res = Backend.remove_individual(ticket_user1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#10
            test_fail_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);

            res = Backend.remove_individual(ticket_user2.id, new_test_doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#11
            test_fail_read(assert, ticket_user2, new_test_doc2['@'], new_test_doc2);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#12
            test_fail_read(assert, ticket_user1, new_test_doc3['@'], new_test_doc3);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc4['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#13
            test_fail_read(assert, ticket_user1, new_test_doc4['@'], new_test_doc4);
        });

    QUnit.test(
        "#014 Individual store, Backend.add_to_individual, Backend.set_in_individual test, remove_from",
        function (assert) {
            var ticket_user1 = get_user1_ticket();

            //#1
            assert.ok(ticket_user1.id.length > 0);

           var now = newDate(new Date());

            var new_test_doc1_uri = "test14:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': now,
                'v-s:test_field': newStr('test data', 'EN')
            };

            var res = Backend.put_individual(ticket_user1.id, new_test_doc1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            var read_individual = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

            //#2
            assert.ok(compare(new_test_doc1, read_individual));

            /////////////////////////// ADD TO

            var new_test_add1 = {
                '@': new_test_doc1_uri,
                'v-s:author': [
                    {
                        data: 'td:ValeriyBushenev-Programmer2',
                        type: "Uri"
                    },
                    {
                        data: 'td:test-q',
                        type: "Uri"
                    }]
            };

            Backend.add_to_individual(ticket_user1.id, new_test_add1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            var new_test_doc1_add1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': [
                    {
                        data: 'td:ValeriyBushenev-Programmer1',
                        type: "Uri"
                    },
                    {
                        data: 'td:ValeriyBushenev-Programmer2',
                        type: "Uri"
                    },
                    {
                        data: 'td:test-q',
                        type: "Uri"
                    }],
                'v-s:created': now,
                'v-s:test_field': newStr('test data', 'EN')
            };

            read_individual = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

            //#3
            assert.ok(compare(new_test_doc1_add1, read_individual));

            ////////////////////////// SET IN

            var new_test_set1 = {
                '@': new_test_doc1_uri,
                'v-s:author': newUri('td:test-e1')
            };

            Backend.set_in_individual(ticket_user1.id, new_test_set1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            var new_test_doc1_set1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:test-e1'),
                'v-s:created': now,
                'v-s:test_field': newStr('test data', 'EN')
            };

            read_individual = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

            //#4
            assert.ok(compare(new_test_doc1_set1, read_individual));

      /////////////////////// ADD TO (2)
            var new_test_set1 = {
                '@': new_test_doc1_uri,
                'v-s:author': newUri('td:test-e2')
            };

            Backend.add_to_individual(ticket_user1.id, new_test_set1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            var new_test_doc1_set1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': [newUri('td:test-e1')[0], newUri('td:test-e2')[0]],
                'v-s:created': now,
                'v-s:test_field': newStr('test data', 'EN')
            };

            read_individual = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

            //#5
            assert.ok(compare(new_test_doc1_set1, read_individual));

      /////////////////////// ADD TO (3)
            var new_test_set1 = {
                '@': new_test_doc1_uri,
                'v-s:author': newUri('td:test-e3')
            };

            Backend.add_to_individual(ticket_user1.id, new_test_set1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            var new_test_doc1_set1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': [newUri('td:test-e1')[0], newUri('td:test-e2')[0], newUri('td:test-e3')[0]],
                'v-s:created': now,
                'v-s:test_field': newStr('test data', 'EN')
            };

            read_individual = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

            //#6
            assert.ok(compare(new_test_doc1_set1, read_individual));


            /////////////////////// REMOVE FROM

            var new_test_remove_from2 = {
                '@': new_test_doc1_uri,
                'v-s:author': newUri('td:test-e2')
            };

            Backend.remove_from_individual(ticket_user1.id, new_test_remove_from2);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            read_individual = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

            var new_test_doc1_remove_from1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:created': now,
                'v-s:author': [newUri('td:test-e1')[0], newUri('td:test-e3')[0]],
                'v-s:test_field': newStr('test data', 'EN')
            };
            //#7
            assert.ok(compare(new_test_doc1_remove_from1, read_individual));

            res = Backend.remove_individual(ticket_user1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#8
            test_fail_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);
        });

    QUnit.test("#015 Document as a group",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var ticket2 = get_user2_ticket();

            var res;
            var doc1 = create_test_document1(ticket1);
            var doc2 = create_test_document1(ticket1);

            //#1
            res = test_success_read(assert, ticket1, doc1['@'], doc1);

            //#2
            res = test_fail_read(assert, ticket2, doc1['@'], doc1);

            //#3
            res = test_success_read(assert, ticket1, doc2['@'], doc2);

            //#4
            res = test_fail_read(assert, ticket2, doc2['@'], doc2);

            res = addToGroup(ticket1, doc1['@'], doc2['@']);
            res = addRight(ticket1.id, [can_read], ticket2.user_uri, doc1['@']);

            Backend.wait_module(m_acl, res[1].op_id);

            //#5
            res = test_success_read(assert, ticket2, doc1['@'], doc1, true);

            //#6
            res = test_success_read(assert, ticket2, doc2['@'], doc2, true);

            res = removeFromGroup(ticket1, doc1['@'], doc2['@']);

            Backend.wait_module(m_acl, res[1].op_id);

            //#7
            res = test_success_read(assert, ticket2, doc1['@'], doc1, true);

            //#8
            res = test_fail_read(assert, ticket2, doc2['@'], doc2, true);

            res = Backend.remove_individual(ticket1.id, doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#9
            test_fail_read(assert, ticket1, doc1['@'], doc1);

            res = Backend.remove_individual(ticket1.id, doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#10
            test_fail_read(assert, ticket1, doc2['@'], doc2);
        });

    QUnit.test("#016 Nested groups",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var ticket2 = get_user2_ticket();

            var res;
            var doc1 = create_test_document1(ticket1);
            var doc2 = create_test_document1(ticket1);
            var doc_group1_uri = 'g:doc_g1roup_' + guid();

            //#1
            res = test_success_read(assert, ticket1, doc1['@'], doc1);

            //#2
            res = test_fail_read(assert, ticket2, doc1['@'], doc1);

            //#3
            res = test_success_read(assert, ticket1, doc2['@'], doc2);

            //#4
            res = test_fail_read(assert, ticket2, doc2['@'], doc2);

            res = addToGroup(ticket1, doc1['@'], doc2['@']);
            res = addToGroup(ticket1, doc_group1_uri, doc1['@']);

            res = addRight(ticket1.id, [can_read], ticket2.user_uri, doc_group1_uri);

            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            //#5
            res = test_success_read(assert, ticket2, doc1['@'], doc1, true);

            //#6
            res = test_success_read(assert, ticket2, doc2['@'], doc2, true);

            res = Backend.remove_individual(ticket1.id, doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#7
            test_fail_read(assert, ticket1, doc1['@'], doc1);

            res = Backend.remove_individual(ticket1.id, doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#8
            test_fail_read(assert, ticket1, doc2['@'], doc2);
        });

    QUnit.test("#017 Nested groups with restrictions 1",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var ticket2 = get_user2_ticket();

            var res;
            var doc1 = create_test_document1(ticket1, 'doc1_');
            var doc2 = create_test_document1(ticket1, 'doc2_');
            var doc3 = create_test_document1(ticket1, 'doc3_');
            var doc_group1_uri = 'g:doc_g1roup1_' + guid();
            var doc_group2_uri = 'g:doc_g1roup2_' + guid();
            var doc_group3_uri = 'g:doc_g1roup3_' + guid();

            //#1
            res = test_success_read(assert, ticket1, doc1['@'], doc1);

            //#2
            res = test_fail_read(assert, ticket2, doc1['@'], doc1);

            //#3
            res = test_success_read(assert, ticket1, doc2['@'], doc2);

            //#4
            res = test_fail_read(assert, ticket2, doc2['@'], doc2);

            //#5
            res = test_success_read(assert, ticket1, doc3['@'], doc3);

            //#6
            res = test_fail_read(assert, ticket2, doc3['@'], doc3);

            res = addToGroup(ticket1, doc1['@'], doc2['@']);
            res = addToGroup(ticket1, doc1['@'], doc3['@'], [can_read]);
            res = addToGroup(ticket1, doc_group1_uri, doc1['@']);
            res = addToGroup(ticket1, doc_group2_uri, doc1['@']);
            res = addToGroup(ticket1, doc_group3_uri, doc_group1_uri);
            res = addToGroup(ticket1, doc_group3_uri, doc_group2_uri);

            res = addRight(ticket1.id, [can_read], ticket2.user_uri, doc_group3_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            res = addRight(ticket1.id, [can_update], ticket2.user_uri, doc_group2_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            res = addRight(ticket1.id, [can_delete], ticket2.user_uri, doc_group1_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            //#7
            check_rights_success(assert, ticket2.id, doc1['@'], [can_read, can_update, can_delete]);

            //#8
            check_rights_success(assert, ticket2.id, doc3['@'], [can_read]);

            //#9
            check_rights_fail(assert, ticket2.id, doc3['@'], [can_update]);

            //#10
            check_rights_fail(assert, ticket2.id, doc3['@'], [can_delete]);

            res = Backend.remove_individual(ticket1.id, doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#11
            test_fail_read(assert, ticket1, doc1['@'], doc1);

            res = Backend.remove_individual(ticket1.id, doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#12
            test_fail_read(assert, ticket1, doc2['@'], doc2);

            res = Backend.remove_individual(ticket1.id, doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#13
            test_fail_read(assert, ticket1, doc3['@'], doc3);

        });

    QUnit.test("#018 Nested groups with restrictions 2",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var ticket2 = get_user2_ticket();

            var res;
            var doc1 = create_test_document1(ticket1, 'doc1_');
            var doc2 = create_test_document1(ticket1, 'doc2_');
            var doc3 = create_test_document1(ticket1, 'doc3_');
            var doc_group1_uri = 'g:doc_g1roup1_' + guid();
            var doc_group2_uri = 'g:doc_g1roup2_' + guid();
            var doc_group3_uri = 'g:doc_g1roup3_' + guid();

            //#1
            res = test_success_read(assert, ticket1, doc1['@'], doc1);

            //#2
            res = test_fail_read(assert, ticket2, doc1['@'], doc1);

            //#3
            res = test_success_read(assert, ticket1, doc2['@'], doc2);

            //#4
            res = test_fail_read(assert, ticket2, doc2['@'], doc2);

            //#5
            res = test_success_read(assert, ticket1, doc3['@'], doc3);

            //#6
            res = test_fail_read(assert, ticket2, doc3['@'], doc3);

            res = addToGroup(ticket1, doc_group1_uri, doc3['@']);
            res = addToGroup(ticket1, doc_group2_uri, doc3['@']);
            res = addToGroup(ticket1, doc_group1_uri, doc1['@']);
            res = addToGroup(ticket1, doc_group2_uri, doc1['@']);
            res = addToGroup(ticket1, doc1['@'], doc2['@']);
            res = addToGroup(ticket1, doc1['@'], doc3['@'], [can_read]);
            res = addToGroup(ticket1, doc_group3_uri, doc_group1_uri);
            res = addToGroup(ticket1, doc_group3_uri, doc_group2_uri);

            res = addRight(ticket1.id, [can_read], ticket2.user_uri, doc_group3_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            res = addRight(ticket1.id, [can_update], ticket2.user_uri, doc_group2_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            res = addRight(ticket1.id, [can_delete], ticket2.user_uri, doc_group1_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            //#7
            check_rights_success(assert, ticket2.id, doc1['@'], [can_read, can_update, can_delete]);

            //#8
            check_rights_success(assert, ticket2.id, doc3['@'], [can_read]);

            //#9
            check_rights_success(assert, ticket2.id, doc3['@'], [can_update]);

            //#10
            check_rights_success(assert, ticket2.id, doc3['@'], [can_delete]);

            res = Backend.remove_individual(ticket1.id, doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#11
            test_fail_read(assert, ticket1, doc1['@'], doc1);

            res = Backend.remove_individual(ticket1.id, doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#12
            test_fail_read(assert, ticket1, doc2['@'], doc2);

            res = Backend.remove_individual(ticket1.id, doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#13
            test_fail_read(assert, ticket1, doc3['@'], doc3);

        });

    QUnit.test("#019 Nested groups with restrictions & cycles",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var ticket2 = get_user2_ticket();

            var res;
            var doc1 = create_test_document1(ticket1, 'doc1_');
            var doc2 = create_test_document1(ticket1, 'doc2_');
            var doc3 = create_test_document1(ticket1, 'doc3_');
            var doc_group1_uri = 'g:doc_g1roup1_' + guid();
            var doc_group2_uri = 'g:doc_g1roup2_' + guid();
            var doc_group3_uri = 'g:doc_g1roup3_' + guid();

            //#1
            res = test_success_read(assert, ticket1, doc1['@'], doc1);

            //#2
            res = test_fail_read(assert, ticket2, doc1['@'], doc1);

            //#3
            res = test_success_read(assert, ticket1, doc2['@'], doc2);

            //#4
            res = test_fail_read(assert, ticket2, doc2['@'], doc2);

            //#5
            res = test_success_read(assert, ticket1, doc3['@'], doc3);

            //#6
            res = test_fail_read(assert, ticket2, doc3['@'], doc3);


            res = addToGroup(ticket1, doc2['@'], doc3['@'], [can_read]);
            res = addToGroup(ticket1, doc1['@'], doc2['@']);
            res = addToGroup(ticket1, doc3['@'], doc1['@'], [can_read]);

            res = addToGroup(ticket1, doc_group1_uri, doc1['@']);
            res = addToGroup(ticket1, doc_group1_uri, doc2['@']);
            res = addToGroup(ticket1, doc_group1_uri, doc3['@']);

            res = addToGroup(ticket1, doc_group2_uri, doc_group1_uri);
            res = addToGroup(ticket1, doc_group3_uri, doc_group2_uri);

            res = addRight(ticket1.id, [can_read], ticket2.user_uri, doc_group1_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            res = addRight(ticket1.id, [can_update], ticket2.user_uri, doc_group2_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            res = addRight(ticket1.id, [can_delete], ticket2.user_uri, doc_group3_uri);
            var op_id = res[1].op_id;
            Backend.wait_module(m_acl, res[1].op_id);

            //#7
            check_rights_success(assert, ticket2.id, doc1['@'], [can_read, can_update, can_delete]);

            //#8
            check_rights_success(assert, ticket2.id, doc3['@'], [can_read, can_update, can_delete]);

            res = Backend.remove_individual(ticket1.id, doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#9
            test_fail_read(assert, ticket1, doc1['@'], doc1);

            res = Backend.remove_individual(ticket1.id, doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#10
            test_fail_read(assert, ticket1, doc2['@'], doc2);

            res = Backend.remove_individual(ticket1.id, doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#11
            test_fail_read(assert, ticket1, doc3['@'], doc3);
        });

    QUnit.test("#020 Search with cursor",
        function (assert) {
            var user = Backend.authenticate("bushenevvt", "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3");
            var admin = Backend.authenticate("karpovrt", "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3");

            var meeting_template = '{\
            "@": "d:QueryTestResource_$i", \
            "rdf:type": [{ "type": "Uri", "data": "rdfs:Resource" }], \
            "v-s:creator": [{ "type": "Uri", "data": "$creator" }], \
            "rdfs:label": [{ "type": "String", "data": "$i", "lang": "NONE" }] \
          }';

            createMeetings(user, 1, 5);
            createMeetings(admin, 6, 3);
            createMeetings(user, 9, 3);
            var res = createMeetings(admin, 12, 9);

            Backend.wait_module(m_subject, res.op_id);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);
            Backend.wait_module(m_fulltext_indexer, res.op_id);

            var q = "'rdf:type'==='rdfs:Resource' && '@'=='d:QueryTestResource*'";
            var s = "'rdfs:label' asc";

            var params_admin1 = {
                ticket: admin.id,
                query: q,
                sort: s,
                top: 3,
                from: 0
            };
            var results_admin1 = Backend.query(params_admin1);

            //#1
            assert.ok(results_admin1.count === 3 && results_admin1.cursor === 3 && results_admin1.processed === 3);

            var params_admin2 = {
                ticket: admin.id,
                query: q,
                sort: s,
                top: 10,
                from: 10
            };
            var results_admin2 = Backend.query(params_admin2);

            //#2
            assert.ok(results_admin2.count === 10 && results_admin2.cursor === 20 && results_admin2.processed === 10);

            var params_user1 = {
                ticket: user.id,
                query: q,
                sort: s,
                top: 6,
                from: 0
            };
            var results_user1 = Backend.query(params_user1);

            //#3
            assert.ok(results_user1.count === 6 && results_user1.cursor === 9 && results_user1.processed === 9);

            var params_user2 = {
                ticket: user.id,
                query: q,
                sort: s,
                top: 10,
                limit: 10,
                from: 3
            };
            var results_user2 = Backend.query(params_user2);

            //#4
            assert.ok(results_user2.count === 5 && results_user2.cursor === 13 && results_user2.processed === 10);

            function createMeetings(creator, start, count) {
                var res;
                for (var i = start; i < start + count; i++) {
                    var meeting = JSON.parse(meeting_template.replace(/\$i/g, i.toString().length === 2 ? i : "0" + i).replace(/\$creator/g, creator.user_uri));
                    res = Backend.put_individual(creator.id, meeting);
                }
                return res;
            }

        });

    QUnit.test("#021 Individual A, B, C store and read use Backend.get_individuals", function (assert) {
        var ticket = get_user1_ticket();

        var A = create_test_document1(ticket);
        var B = create_test_document1(ticket);
        var C = create_test_document1(ticket);

        var new_idividuals = [A, B, C];

        var res = Backend.get_individuals(ticket.id, [A['@'], B['@'], C['@']]);

        //#1
        assert.ok(res.length == 3);

        //#2#3#4
        for (var idx = 0; idx < 3; idx++) {
            for (var idx2 = 0; idx2 < 3; idx2++) {
                if (res[idx]['@'] == new_idividuals[idx2]['@']) {
                    assert.ok(compare(res[idx], new_idividuals[idx2]));
                }
            }
        }

        res = Backend.remove_individual(ticket.id, A['@']);
        //Backend.wait_module(m_scripts, res.op_id);

        //#5
        test_fail_read(assert, ticket, A['@'], A);

        res = Backend.remove_individual(ticket.id, B['@']);
        //Backend.wait_module(m_scripts, res.op_id);

        //#6
        test_fail_read(assert, ticket, B['@'], B);

        res = Backend.remove_individual(ticket.id, C['@']);
        //Backend.wait_module(m_scripts, res.op_id);

        //#7
        test_fail_read(assert, ticket, C['@'], C);
    });

    QUnit.test("#022 test search on invalid query", function (assert) {
        var ticket = get_user1_ticket();

        var A = create_test_document1(ticket);

        var params_q1 = {
            ticket: ticket.id,
            query: "(('rdf:type' == 'v-s:Department')) && ('*' == '.;u*')",
            sort: "",
            top: 3,
            from: 0
        };

        var res = Backend.query(params_q1);

        //#1
        assert.ok(res.result.length == 0);

        res = Backend.remove_individual(ticket.id, A['@']);
        //Backend.wait_module(m_scripts, res.op_id);

        //#2
        test_fail_read(assert, ticket, A['@'], A);
    });

    QUnit.test("#023 test get_rights_origin", function (assert) {
        var ticket_admin = get_admin_ticket();

        var res = Backend.get_rights_origin(ticket_admin.id, "td:RomanKarpov_pref")
        var result_rights = 0;
        res.forEach(function (item, i) {
            if (res[i]["v-s:canCreate"]) {
                result_rights |= 1;
            } else if (res[i]["v-s:canRead"]) {
                result_rights |= 2;
            } else if (res[i]["v-s:canUpdate"]) {
                result_rights |= 4;
            } else if (res[i]["v-s:canDelete"]) {
                result_rights |= 8;
            }
        });

        var res = Backend.get_rights(ticket_admin.id, "td:RomanKarpov_pref");
        var expected_rights = 0;
        if (res["v-s:canCreate"]) {
            expected_rights |= 1;
        }
        if (res["v-s:canRead"]) {
            expected_rights |= 2;
        }
        if (res["v-s:canUpdate"]) {
            expected_rights |= 4;
        }
        if (res["v-s:canDelete"]) {
            expected_rights |= 8;
        }

        //#1
        assert.ok(result_rights == expected_rights);
    });

    QUnit.test("#024 test get_membership", function (assert) {
        //"v-s:memberOf":[{"type":"Uri","data":"v-s:AllResourcesGroup"},{"type":"Uri","data":"td:RomanKarpov_pref"},{"type":"Uri","data":"cfg:TTLResourcesGroup"}]}

        var ticket_admin = get_admin_ticket();

        var res = Backend.get_membership(ticket_admin.id, "td:RomanKarpov_pref")
        var check = true;
        var found = 0;
        res["v-s:memberOf"].forEach(function (item, i) {
            switch (res["v-s:memberOf"][i]["data"]) {
                case "v-s:AllResourcesGroup":
                case "td:RomanKarpov_pref":
                case "v-ui:Preferences_group":
                case "v-s:UserThing_group":
                case "v-s:Exportable_group":
                case "rdfs:Resource_group":
                case "v-s:ClassAuthorized_group":
                case "v-s:Thing_group":
                case "v-s:GroupAuthorized_group":
                case "v-s:Embedded_group":
                case "v-s:Labeled_group":
                case "cfg:TTLResourcesGroup":
                    found++
                    break;
                default:
                    check = false;
                    break;
            }
        });

        //#1
        assert.ok(check && (found == 3));
    });

    QUnit.test("#025 test cycle of group", function (assert) {
        var ticket_admin = get_admin_ticket();

        var new_test_doc1 = create_test_document1(ticket_admin);

        var group_A = 'g:group_A' + guid();
        var group_B = 'g:group_B' + guid();
        var group_C = 'g:group_C' + guid();

        var res;

        res = addToGroup(ticket_admin, group_A, group_B);

        //#1
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_B, group_C);

        //#2
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_C, group_A);

        //#3
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_C, new_test_doc1['@']);

        //#4
        assert.ok(res[1].result == 200);

        res = addRight(ticket_admin.id, [can_read], group_C, new_test_doc1['@']);

        //#5
        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        //#6
        check_rights_success(assert, ticket_admin.id, new_test_doc1['@'], [can_read]);

        res = Backend.remove_individual(ticket_admin.id, new_test_doc1['@']);
        //Backend.wait_module(m_scripts, res.op_id);

        //#7
        test_fail_read(assert, ticket_admin, new_test_doc1['@'], new_test_doc1);
    });

    QUnit.test("#026 test different group subtrees 1", function (assert) {
        var ticket_admin = get_admin_ticket();
        var ticket1 = get_user1_ticket();

        var new_test_doc1 = create_test_document1(ticket_admin);

        var group_A = 'g:group_A' + guid();
        var group_B = 'g:group_B' + guid();
        var group_C = 'g:group_C' + guid();

        var res;

        res = addToGroup(ticket_admin, group_A, new_test_doc1['@'], [can_read]);

        //#1
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_B, group_A, [can_read]);

        //#2
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_C, new_test_doc1['@']);

        //#3
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_B, group_C);

        //#4
        assert.ok(res[1].result == 200);

        res = addRight(ticket_admin.id, [can_read, can_update, can_delete], ticket1.user_uri, group_B);

        //#5
        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        //#6
        check_rights_success(assert, ticket1.id, new_test_doc1['@'], [can_read]);

        //#7
        check_rights_success(assert, ticket1.id, new_test_doc1['@'], [can_update]);

        //#8
        check_rights_success(assert, ticket1.id, new_test_doc1['@'], [can_delete]);

        res = Backend.remove_individual(ticket_admin.id, new_test_doc1['@']);
        //Backend.wait_module(m_scripts, res.op_id);

        //#9
        test_fail_read(assert, ticket_admin, new_test_doc1['@'], new_test_doc1);

    });

    QUnit.test("#027 test different group subtrees 2", function (assert) {
        var ticket_admin = get_admin_ticket();
        var ticket1 = get_user1_ticket();

        var new_test_doc1 = create_test_document1(ticket_admin);

        var group_A = 'g:group_A' + guid();
        var group_B = 'g:group_B' + guid();
        var group_C = 'g:group_C' + guid();

        var res;

        res = addToGroup(ticket_admin, group_A, new_test_doc1['@'], [can_read]);

        //#1
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_B, group_A, [can_read]);

        //#2
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_C, new_test_doc1['@']);

        //#3
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_B, group_C);

        //#4
        assert.ok(res[1].result == 200);

        res = addRight(ticket_admin.id, [can_read], ticket1.user_uri, group_B);

        //#5
        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        //#6
        check_rights_success(assert, ticket1.id, new_test_doc1['@'], [can_read]);

        //#7
        check_rights_fail(assert, ticket1.id, new_test_doc1['@'], [can_update]);

        //#8
        check_rights_fail(assert, ticket1.id, new_test_doc1['@'], [can_delete]);

        res = Backend.remove_individual(ticket_admin.id, new_test_doc1['@']);
        //Backend.wait_module(m_scripts, res.op_id);

        //#9
        test_fail_read(assert, ticket_admin, new_test_doc1['@'], new_test_doc1);
    });

    QUnit.test("#028 test different group subtrees 3", function (assert) {
        var ticket_admin = get_admin_ticket();
        var ticket1 = get_user1_ticket();

        var doc1 = create_test_document1(ticket_admin)["@"];
        var doc2 = create_test_document1(ticket_admin)["@"];
        var group_A = 'g:group_A' + guid();
        var group_B = 'g:group_B' + guid();

        var res;

        res = addToGroup(ticket_admin, doc2, doc1, [can_read]);

        //#1
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_A, doc2, [can_read]);

        //#2
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_B, group_A, [can_read]);

        //#3
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_B, doc2);

        //#4
        assert.ok(res[1].result == 200);

        res = addRight(ticket_admin.id, [can_read, can_update, can_delete], ticket1.user_uri, group_B);

        //5
        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        //#6
        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        //#7
        check_rights_fail(assert, ticket1.id, doc1, [can_update]);

        //#8
        check_rights_fail(assert, ticket1.id, doc1, [can_delete]);
    });


    QUnit.test("#029 test server side script: decimal, and various format [{}], {}, [[{}]]", function (assert) {
        var ticket_admin = get_admin_ticket();

        var new_test_script_uri = genUri();
        var new_test_script = {
            '@': new_test_script_uri,
            'rdf:type': newUri('v-s:Event'),
            'v-s:triggerByType': newUri('rdfs:Resource1'),
            'v-s:script': newStr('if (parent_script_id != "") return;' +
                'document["v-s:created"]= veda.Util.newDate(new Date("2017-03-03"))[0];' +
                'put_individual(ticket, document, _event_id);' +
                'var document1 = {' +
                '"@": document["@"],' +
                '"v-s:test_Obj": veda.Util.newDate(new Date("2017-03-03"))[0]};'+
                'set_in_individual(ticket, document1, _event_id);' +
                'var document2 = {' +
                '"@": document["@"],' +
                '"v-s:test_ArArObj": [veda.Util.newInt(20000001)]};'+
                'add_to_individual(ticket, document2, _event_id);' +
                'var document3 = {' +
                '"@": document["@"],' +
                '"v-s:test_datetime0": veda.Util.newDate(new Date("2017-01-03"))};'+
                'set_in_individual(ticket, document3, _event_id);'
                ),
            'v-s:created': newDate(new Date()),
            'v-s:author': newUri(ticket_admin.user_uri)
        };

        var res = Backend.put_individual(ticket_admin.id, new_test_script);
        //Backend.wait_module(m_subject, res.op_id);
        Backend.wait_module(m_acl, res.op_id);
        Backend.wait_module(m_scripts, res.op_id);

        var doc = create_test_document2(ticket_admin);

        Backend.remove_individual(ticket_admin.id, new_test_script['@']);

        test_fail_read(assert, ticket_admin, doc['@'], doc);

        doc["v-s:test_datetime0"] = newDate(new Date("2017-01-03"));
        doc["v-s:test_ArArObj"] = newInt(20000001);
        doc["v-s:test_Obj"] = newDate(new Date("2017-03-03"));
        doc["v-s:created"] = newDate(new Date("2017-03-03"));

        test_success_read(assert, ticket_admin, doc['@'], doc);
    });

    QUnit.test(
        "#030 user1 store 5 individuals, ft search use range ",
        function (assert) {
            var ticket_user1 = get_user1_ticket();

            //#1
            assert.ok(ticket_user1.id.length > 0);

            var test_group_uid = "test13:" + guid();

            var new_test_doc1_uri = "test13:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:test_datetime0': newDate(new Date("2014-01-01")),
                'v-s:test_datetime1': newDate(new Date("2014-05-01"))
            };

            var new_test_doc2_uri = "test13:" + guid();
            var new_test_doc2 = {
                '@': new_test_doc2_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:test_datetime0': newDate(new Date("2014-01-02")),
                'v-s:test_datetime1': newDate(new Date("2014-05-01"))
            };

            var new_test_doc3_uri = "test13:" + guid();
            var new_test_doc3 = {
                '@': new_test_doc3_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:test_datetime0': newDate(new Date("2014-01-02")),
                'v-s:test_datetime1': newDate(new Date("2014-06-11"))
            };

            var new_test_doc4_uri = "test13:" + guid();
            var new_test_doc4 = {
                '@': new_test_doc4_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_group': newUri(test_group_uid),
                'v-s:test_datetime0': newDate(new Date("2014-01-04")),
                'v-s:test_datetime1': newDate(new Date("2014-06-12"))
            };

            var res = Backend.put_individual(ticket_user1.id, new_test_doc1, false);
            var res = Backend.put_individual(ticket_user1.id, new_test_doc2, false);
            var res = Backend.put_individual(ticket_user1.id, new_test_doc3, false);
            var res = Backend.put_individual(ticket_user1.id, new_test_doc4, false);

            Backend.wait_module(m_fulltext_indexer, res.op_id);
            Backend.wait_module(m_subject, res.op_id);
            //Backend.wait_module(m_acl, res.op_id);
            //Backend.wait_module(m_scripts, res.op_id);

            var data = Backend.query(ticket_user1.id, test_group_uid, undefined, undefined, true).result;

            //#2
            assert.ok(compare(data.length, 4));

            data = Backend.query(ticket_user1.id, "'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#3
            assert.ok(compare(data.length, 4));

            data = Backend.query(ticket_user1.id,
                "'v-s:test_datetime0' === [2013-12-31T00:00:00, 2014-01-03T00:00:00] && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#4
            assert.ok(compare(data.length, 3));

            //#5
            assert.ok((data[0] == new_test_doc1_uri || data[1] == new_test_doc1_uri || data[2] == new_test_doc1_uri) &&
                (data[0] == new_test_doc2_uri || data[1] == new_test_doc2_uri || data[2] == new_test_doc2_uri) &&
                (data[0] == new_test_doc3_uri || data[1] == new_test_doc3_uri || data[2] == new_test_doc3_uri));

            data = Backend.query(ticket_user1.id,
                "'v-s:test_datetime1' === [2014-04-01T00:00:00, 2014-06-03T00:00:00] && 'v-s:test_datetime0' === [2013-12-31T00:00:00, 2014-01-03T00:00:00] && 'v-s:test_group' === '" + test_group_uid + "'", undefined, undefined, true).result;

            //#6
            assert.ok(compare(data.length, 2));

            //#7
            assert.ok((data[0] == new_test_doc1_uri || data[1] == new_test_doc1_uri) && (data[0] == new_test_doc2_uri || data[1] == new_test_doc2_uri));

            res = Backend.remove_individual(ticket_user1.id, new_test_doc1['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#8
            test_fail_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc2['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#9
            test_fail_read(assert, ticket_user1, new_test_doc2['@'], new_test_doc2);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc3['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#10
            test_fail_read(assert, ticket_user1, new_test_doc3['@'], new_test_doc3);

            res = Backend.remove_individual(ticket_user1.id, new_test_doc4['@']);
            //Backend.wait_module(m_scripts, res.op_id);

            //#11
            test_fail_read(assert, ticket_user1, new_test_doc4['@'], new_test_doc4);
        });

    QUnit.test(
        "#031 1) [A] store user1 and read user2. 2) store right content filter. 3) read A user 1 and dont read [A] user2",
        function (assert) {
            var ticket_user1 = get_user1_ticket();
            assert.ok(ticket_user1.id.length > 0);

            var ticket_user2 = get_user2_ticket();
            assert.ok(ticket_user2.id.length > 0);

            var ticket_admin = get_admin_ticket();
            assert.ok(ticket_admin.id.length > 0);

            var new_test_doc1_uri = "test31:" + guid();
            var new_test_doc1 = {
                '@': new_test_doc1_uri,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:created': newDate(new Date()),
                'v-s:test_field': newStr('test data', 'EN')
            };

            var res = Backend.put_individual(ticket_user1.id, new_test_doc1);
            Backend.wait_module(m_scripts, res.op_id);
            Backend.wait_module(m_acl, res.op_id);

            test_success_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);
            test_fail_read(assert, ticket_user2, new_test_doc1['@'], new_test_doc1);

            var res = addRight(ticket_user1.id, [can_read, can_update], ticket_user2.user_uri, new_test_doc1_uri);
            var new_permission = res[0];
            Backend.wait_module(m_acl, res[1].op_id);

            test_success_update(assert, ticket_user1, new_test_doc1);
            test_success_update(assert, ticket_user2, new_test_doc1);

            var new_permission_filter_uri = "test31-pf:" + guid();
            var new_permission_filter = {
                '@': new_permission_filter_uri,
                'rdf:type': newUri('v-s:PermissionFilter'),
                'v-s:created': newDate(new Date()),
                'v-s:permissionObject': newUri(new_test_doc1_uri),
                'v-s:resource': newUri(new_permission_filter_uri + 'xxx'),
                'v-s:canRead': newBool(true)
            };
            var res = Backend.put_individual(ticket_user1.id, new_permission_filter);

            Backend.wait_module(m_acl, res.op_id);

            test_fail_update(assert, ticket_user1, new_test_doc1);
            test_fail_update(assert, ticket_user2, new_test_doc1);
            test_success_read(assert, ticket_user1, new_test_doc1['@'], new_test_doc1);
            test_success_read(assert, ticket_user2, new_test_doc1['@'], new_test_doc1);

            var res1 = addRightWithFilter(ticket_admin.id, [can_update], ticket_user2.user_uri, new_test_doc1_uri, new_permission_filter_uri + 'xxx');
            var new_permission1 = res1[0];

            test_fail_update(assert, ticket_user1, new_test_doc1);
            test_success_update(assert, ticket_user2, new_test_doc1);

            // disable permission with filter
            new_permission1['v-s:deleted'] = newBool(true);
            res1 = Backend.put_individual(ticket_admin.id, new_permission1);

            Backend.wait_module(m_acl, res1.op_id);
            test_fail_update(assert, ticket_user2, new_test_doc1);

            // disable filter
            new_permission_filter['v-s:deleted'] = newBool(true);
            var res2 = Backend.put_individual(ticket_admin.id, new_permission_filter);
            Backend.wait_module(m_acl, res2.op_id);

            test_success_update(assert, ticket_user2, new_test_doc1);
        });

    QUnit.test(
        "#050 Bad requests",
        function (assert) {
            var ticket = get_user1_ticket();

            try {
                Backend.query();
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.query(ticket.id);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            Backend.query(ticket.id, {});
            Backend.query(ticket.id, 1);
            Backend.query(ticket.id, "1");
            Backend.query(ticket.id, false);
            Backend.query(ticket.id, []);
            try {
                Backend.query(ticket, [{}]);
            } catch (e) {
                assert.ok(e.message = "400");
            }

            try {
                Backend.put_individual();
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individual(ticket.id);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individual(ticket.id, {});
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.put_individual(ticket.id, 1);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.put_individual(ticket.id, "1");
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.put_individual(ticket.id, false);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.put_individual(ticket.id, []);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individual(ticket.id, [{}]);
            } catch (e) {
                assert.ok(e.message = "400");
            }

            try {
                Backend.put_individuals();
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individuals(ticket.id);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individuals(ticket.id, {});
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individuals(ticket.id, 1);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individuals(ticket.id, "1");
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individuals(ticket.id, false);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individuals(ticket.id, []);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.put_individuals(ticket.id, [{}]);
            } catch (e) {
                assert.ok(e.message = "904");
            }

            try {
                Backend.set_in_individual();
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.set_in_individual(ticket.id);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.set_in_individual(ticket.id, {});
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.set_in_individual(ticket.id, 1);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.set_in_individual(ticket.id, "1");
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.set_in_individual(ticket.id, false);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.set_in_individual(ticket, []);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.set_in_individual(ticket.id, [{}]);
            } catch (e) {
                assert.ok(e.message = "400");
            }

            try {
                Backend.add_to_individual();
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.add_to_individual(ticket.id);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.add_to_individual(ticket.id, {});
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.add_to_individual(ticket.id, 1);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.add_to_individual(ticket.id, "1");
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.add_to_individual(ticket.id, false);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.add_to_individual(ticket, []);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.add_to_individual(ticket.id, [{}]);
            } catch (e) {
                assert.ok(e.message = "400");
            }

            try {
                Backend.remove_from_individual();
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.remove_from_individual(ticket.id);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.remove_from_individual(ticket.id, {});
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.remove_from_individual(ticket.id, 1);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.remove_from_individual(ticket.id, "1");
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.remove_from_individual(ticket.id, false);
            } catch (e) {
                assert.ok(e.message = "904");
            }
            try {
                Backend.remove_from_individual(ticket, []);
            } catch (e) {
                assert.ok(e.message = "400");
            }
            try {
                Backend.remove_from_individual(ticket.id, [{}]);
            } catch (e) {
                assert.ok(e.message = "400");
            }

            ticket = get_user1_ticket();
            assert.ok(ticket.id.length > 0);
        });

    QUnit.test("#51 Test membership isExclusive & ignoreExclusive",
        function (assert) {
            var ticket1 = get_user1_ticket();
            var doc_group = 'g:doc_resource_group';
            var doc_group_another = 'g:doc_resource_another_group';
            var new_test_doc3 = create_test_document3(ticket1);
            // #1
            test_success_read(assert, ticket1, new_test_doc3['@'], new_test_doc3);
            addToGroup(ticket1, doc_group, new_test_doc3['@']);
            // #2
            test_success_read(assert, ticket1, new_test_doc3['@'], new_test_doc3);
            var new_test_membership1 = create_test_membership1(ticket1, doc_group);
            // #3
            test_success_read(assert, ticket1, new_test_doc3['@'], new_test_doc3);
            var new_test_doc4 = create_test_document4(ticket1);
            // #4
            test_success_read(assert, ticket1, new_test_doc4['@'], new_test_doc4);
            addToGroup(ticket1, doc_group_another, new_test_doc4['@']);
            // #5
            test_fail_read(assert, ticket1, new_test_doc4['@'], new_test_doc4);
            // #6
            var new_test_membership2 = create_test_membership2(ticket1, doc_group);
            test_success_read(assert, ticket1, new_test_doc4['@'], new_test_doc4);
            // #7
            test_success_read(assert, ticket1, new_test_doc3['@'], new_test_doc3);
        });
    /*
        QUnit.test("#040 test create individual with rdf:type rdfs:Resource", function(assert)
        {
          var ticket_admin = get_admin_ticket();

          var ticket_user = get_user1_ticket();

          var doc_admin = {
            '@': genUri(),
            'rdf:type': [{
              data: "rdfs:Resource",
              type: "Uri"
            }]
          };

          var doc_user = {
            '@': genUri(),
            'rdf:type': [{
              data: "rdfs:Resource",
              type: "Uri"
            }]
          };

          try {
            var res = Backend.put_individual(ticket_admin.id, doc_admin);
            assert.ok(true);
          } catch (err) {
            assert.ok(false, "Backend.put_individual with rdfs:Resource type by admin must success.");
          }

          try {
            var res = Backend.put_individual(ticket_user.id, doc_user);
            assert.ok(false, "Backend.put_individual with rdfs:Resource type by unprivileged user must fail with 472 error.");
          } catch (err) {
            assert.ok(true);
          }

        });
    */

    /*
        QUnit.test("#041 test Backend.put_individuals (user1 stores three individuals)", function(assert)
        {
            var ticket_user1 = get_user1_ticket();

            //#1
            assert.ok(ticket_user1.id.length > 0);

            var new_test_doc1_uri_1 = "test21_1:" + guid();

            var test_data_uid = guid();
            var test_data = 'testdata ' + test_data_uid;

            var new_test_doc1 = {
                '@': new_test_doc1_uri_1,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:test_field': newStr(test_data, 'NONE'),
                'v-s:test_fieldA': newUri('BBB' + test_data_uid),
                'v-s:test_fieldB': newUri('CCC' + test_data_uid)
            };

            // document content author != user1
            var new_test_doc1_uri_2 = "test21_2:" + guid();
            var new_test_doc2 = {
                '@': new_test_doc1_uri_2,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:test_field': newUri(test_data)
            };

            var new_test_doc1_uri_3 = "test21_3:" + guid();
            var new_test_doc3 = {
                '@': new_test_doc1_uri_3,
                'rdf:type': newUri('rdfs:Resource'),
                'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
                'v-s:test_field': newUri(test_data),
                'v-s:test_fieldA': newUri('BBB' + test_data_uid)
            };
            var res = Backend.put_individuals(ticket_user1.id, [new_test_doc1, new_test_doc2, new_test_doc3], false);
            var read_individual1 = Backend.get_individual(ticket_user1.id, new_test_doc1_uri_1);
            var read_individual2 = Backend.get_individual(ticket_user1.id, new_test_doc1_uri_2);
            var read_individual3 = Backend.get_individual(ticket_user1.id, new_test_doc1_uri_3);
            //#2
            assert.ok(compare(new_test_doc1, read_individual1) && compare(new_test_doc2, read_individual2) &&
                compare(new_test_doc3, read_individual3));
        });
    */


    QUnit.test("#051 test restrictions in subject groups", function (assert) {
        var ticket_admin = get_admin_ticket();

        var ticket1 = get_user1_ticket();
        var ticket2 = get_user2_ticket();

        var user1 = ticket1.user_uri;
        var user2 = ticket2.user_uri;

        var doc1 = create_test_document1(ticket_admin)["@"];

        var group_Doc = 'g:group_A' + guid();
        var group_User = 'g:group_B' + guid();

        var res;

        res = addToGroup(ticket_admin, group_Doc, doc1);

        //#1
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_User, user1, [can_read]);

        //#2
        assert.ok(res[1].result == 200);

        res = addToGroup(ticket_admin, group_User, user2);

        //#3
        assert.ok(res[1].result == 200);

        res = addRight(ticket_admin.id, [can_read, can_update, can_delete], group_User, group_Doc);

        //#4
        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        //#5
        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        //#6
        check_rights_fail(assert, ticket1.id, doc1, [can_update]);

        //#7
        check_rights_fail(assert, ticket1.id, doc1, [can_delete]);

        //#8
        check_rights_success(assert, ticket2.id, doc1, [can_read]);

        //#9
        check_rights_success(assert, ticket2.id, doc1, [can_update]);

        //#10
        check_rights_success(assert, ticket2.id, doc1, [can_delete]);
    });

    QUnit.test("#052 test rights counter", function (assert) {
        var ticket_admin = get_admin_ticket();

        var ticket1 = get_user1_ticket();

        var user1 = ticket1.user_uri;

        var doc1 = create_test_document1(ticket_admin)["@"];

        var res;

        // Right1 = R
        res = addRight(ticket_admin.id, [can_read], user1, doc1);

        var right1 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        // Right2 = RU
        res = addRight(ticket_admin.id, [can_read, can_update], user1, doc1);

        var right2 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        // Right3 = RUD
        res = addRight(ticket_admin.id, [can_read, can_update, can_delete], user1, doc1);

        var right3 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);


        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        check_rights_success(assert, ticket1.id, doc1, [can_delete]);


        res = Backend.remove_individual(ticket_admin.id, right1["@"]);

        Backend.wait_module(m_acl, res.op_id);


        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        check_rights_success(assert, ticket1.id, doc1, [can_delete]);


        res = Backend.remove_individual(ticket_admin.id, right2["@"]);

        Backend.wait_module(m_acl, res.op_id);


        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        check_rights_success(assert, ticket1.id, doc1, [can_delete]);


        res = Backend.remove_individual(ticket_admin.id, right3["@"]);

        Backend.wait_module(m_acl, res.op_id);


        check_rights_fail(assert, ticket1.id, doc1, [can_read]);

        check_rights_fail(assert, ticket1.id, doc1, [can_update]);

        check_rights_fail(assert, ticket1.id, doc1, [can_delete]);


        // Check multiple permission update & remove

        var doc2 = create_test_document2(ticket_admin)["@"];

        var res;

        res = addRight(ticket_admin.id, [can_read, can_update, can_delete], user1, doc2);

        var right4 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        res = Backend.put_individual(ticket_admin.id, right4);

        assert.ok(res.result == 200);

        Backend.wait_module(m_acl, res.op_id);

        res = Backend.put_individual(ticket_admin.id, right4);

        assert.ok(res.result == 200);

        Backend.wait_module(m_acl, res.op_id);


        check_rights_success(assert, ticket1.id, doc2, [can_read]);
        check_rights_success(assert, ticket1.id, doc2, [can_update]);
        check_rights_success(assert, ticket1.id, doc2, [can_delete]);


        res = Backend.remove_individual(ticket_admin.id, right4["@"]);

        assert.ok(res.result == 200);

        Backend.wait_module(m_acl, res.op_id);


        check_rights_fail(assert, ticket1.id, doc2, [can_read]);
        check_rights_fail(assert, ticket1.id, doc2, [can_update]);
        check_rights_fail(assert, ticket1.id, doc2, [can_delete]);


        // Check change permission rights

        res = addRight(ticket_admin.id, [can_read, can_update, can_delete], user1, doc2);

        var right5 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        check_rights_success(assert, ticket1.id, doc2, [can_read]);
        check_rights_success(assert, ticket1.id, doc2, [can_update]);
        check_rights_success(assert, ticket1.id, doc2, [can_delete]);

        delete right5["v-s:canUpdate"];
        delete right5["v-s:canDelete"];

        res = Backend.put_individual(ticket_admin.id, right5);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_success(assert, ticket1.id, doc2, [can_read]);
        check_rights_fail(assert, ticket1.id, doc2, [can_update]);
        check_rights_fail(assert, ticket1.id, doc2, [can_delete]);

    });

    QUnit.test("#053 test rights delete & restore", function (assert) {

        var ticket_admin = get_admin_ticket();

        var ticket1 = get_user1_ticket();

        var user1 = ticket1.user_uri;

        var doc1 = create_test_document1(ticket_admin)["@"];

        var res;

        // Right1 = U

        res = addRight(ticket_admin.id, [can_update], user1, doc1);

        var right1 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        // Right2 = R

        res = addRight(ticket_admin.id, [can_read], user1, doc1);

        var right2 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        // Delete Right2 with RU first time

        right2["v-s:canUpdate"] = newBool(true);

        right2["v-s:deleted"] = newBool(true);

        res = Backend.put_individual(ticket_admin.id, right2);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_fail(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        // Delete Right2 with RU second time

        res = Backend.put_individual(ticket_admin.id, right2);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_fail(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        // Restore Right2 with RUD

        delete right2["v-s:deleted"];

        right2["v-s:canDelete"] = newBool(true);

        res = Backend.put_individual(ticket_admin.id, right2);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        check_rights_success(assert, ticket1.id, doc1, [can_delete]);

        // Remove right1

        res = Backend.remove_individual(ticket_admin.id, right1["@"]);

        assert.ok(res.result == 200);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        check_rights_success(assert, ticket1.id, doc1, [can_delete]);

    });

    QUnit.test("#054 single right permissions delete & restore", function (assert) {

        var ticket_admin = get_admin_ticket();

        var ticket1 = get_user1_ticket();

        var user1 = ticket1.user_uri;

        var doc1 = create_test_document1(ticket_admin)["@"];

        var res;


        // Right1 = R

        res = addRight(ticket_admin.id, [can_read], user1, doc1);

        var right1 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_fail(assert, ticket1.id, doc1, [can_update]);


        // Right2 = U

        res = addRight(ticket_admin.id, [can_update], user1, doc1);

        var right2 = res[0];

        assert.ok(res[1].result == 200);

        Backend.wait_module(m_acl, res[1].op_id);

        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);


        // Delete Right1

        right1["v-s:deleted"] = newBool(true);

        res = Backend.put_individual(ticket_admin.id, right1);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_fail(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);


        // Delete Right2

        right2["v-s:deleted"] = newBool(true);

        res = Backend.put_individual(ticket_admin.id, right2);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_fail(assert, ticket1.id, doc1, [can_read]);

        check_rights_fail(assert, ticket1.id, doc1, [can_update]);

        // Restore Right1

        delete right1["v-s:deleted"];

        res = Backend.put_individual(ticket_admin.id, right1);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_fail(assert, ticket1.id, doc1, [can_update]);

        // Restore Right2

        delete right2["v-s:deleted"];

        res = Backend.put_individual(ticket_admin.id, right2);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_success(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        // Remove Right1

        res = Backend.remove_individual(ticket_admin.id, right1["@"]);

        assert.ok(res.result == 200);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_fail(assert, ticket1.id, doc1, [can_read]);

        check_rights_success(assert, ticket1.id, doc1, [can_update]);

        // Remove Right2

        res = Backend.remove_individual(ticket_admin.id, right2["@"]);

        assert.ok(res.result == 200);

        Backend.wait_module(m_acl, res.op_id);

        check_rights_fail(assert, ticket1.id, doc1, [can_read]);

        check_rights_fail(assert, ticket1.id, doc1, [can_update]);

    });

    QUnit.test("#055 Individual store user1 and remove user2", function (assert) {
        var ticket_user1 = get_user1_ticket();

        var ticket_user2 = get_user2_ticket();

        //#1
        assert.ok(ticket_user1.id != "");

        //#2
        assert.ok(ticket_user2.id != "");

        var new_test_doc1_uri = "test6:" + guid();
        var new_test_doc1 = {
            '@': new_test_doc1_uri,
            'rdf:type': newUri('rdfs:Resource'),
            'v-s:author': newUri('td:ValeriyBushenev-Programmer1'),
            'v-s:created': newDate(new Date()),
            'v-s:test_field': newStr('test data', 'NONE')
        };

        var res = Backend.put_individual(ticket_user1.id, new_test_doc1);
        Backend.wait_module(m_scripts, res.op_id);
        Backend.wait_module(m_acl, res.op_id);

        var read_individual1 = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

        //#3
        assert.ok(compare(new_test_doc1, read_individual1));

        try {
            res = Backend.remove_individual(ticket_user2.id, new_test_doc1['@']);
            assert.ok(false);
        } catch (e) {
            //#4
            assert.ok(true);
        }

        var read_individual2 = Backend.get_individual(ticket_user1.id, new_test_doc1_uri);

        //#5
        assert.ok(compare(new_test_doc1, read_individual2));
    });
}
