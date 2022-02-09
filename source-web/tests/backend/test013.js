export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#013 user1 store 3 individuals (one of the individuals contains an invalid field [author]), the user1 finds 2 individuals, and the user2 does not find anything.', async () => {
    const ticket_user1 = await Helpers.get_user1_ticket();
    const ticket_user2 = await Helpers.get_user2_ticket();

    const test_data_uid = 'test12_' + Util.guid();
    const test_data = 'testdata ' + test_data_uid;

    const new_test_doc1_uri_1 = 'test12:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri_1,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newStr(test_data, 'NONE'),
      'v-s:test_fieldA': Util.newUri('BBB' + test_data_uid),
      'v-s:test_fieldB': Util.newUri('CCC' + test_data_uid),
    };

    // document content author != user1
    const new_test_doc1_uri_2 = 'test12:' + Util.guid();
    const new_test_doc2 = {
      '@': new_test_doc1_uri_2,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:AndreyBychin-Analyst2'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newUri(test_data),
    };

    const new_test_doc1_uri_3 = 'test12:' + Util.guid();
    const new_test_doc3 = {
      '@': new_test_doc1_uri_3,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newUri(test_data),
      'v-s:test_fieldA': Util.newUri('BBB' + test_data_uid),
    };

    const new_test_doc1_uri_4 = 'test12:' + Util.guid();
    const new_test_doc4 = {
      '@': new_test_doc1_uri_4,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newUri('AAA' + test_data_uid),
      'v-s:test_fieldA': Util.newUri('BBB' + test_data_uid),
      'v-s:test_fieldB': Util.newUri('CCC' + test_data_uid),
    };

    let res;
    res = await Backend.put_individual(ticket_user1.ticket, new_test_doc1);
    res = await Backend.put_individual(ticket_user1.ticket, new_test_doc2);
    res = await Backend.put_individual(ticket_user1.ticket, new_test_doc3);
    res = await Backend.put_individual(ticket_user1.ticket, new_test_doc4);

    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_fulltext_indexer, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    let data = await Backend.query(ticket_user1.ticket, test_data_uid);
    assert(data.result.length === 2);

    data = await Backend.query(ticket_user2.ticket, test_data_uid);
    assert(data.result.length === 1);

    data = await Backend.query(ticket_user1.ticket, "'v-s:test_field' === '" + test_data_uid + "'");
    assert(data.result.length === 2);

    data = await Backend.query(ticket_user1.ticket, "'v-s:test_field' === '" + test_data_uid + "' || 'v-s:test_field' === 'AAA" + test_data_uid + "'");
    assert(data.result.length === 3);

    data = await Backend.query(ticket_user1.ticket, "'v-s:test_fieldB' === 'CCC" + test_data_uid + "' && 'v-s:test_fieldA' === 'BBB" + test_data_uid + "'");
    assert(data.result.length === 2);

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc1['@']);
    assert.rejects(Backend.get_individual(ticket_user1.ticket, new_test_doc1['@']));

    res = await Backend.remove_individual(ticket_user2.ticket, new_test_doc2['@']);
    assert.rejects(Backend.get_individual(ticket_user2.ticket, new_test_doc2['@']));

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc3['@']);
    assert.rejects(Backend.get_individual(ticket_user1.ticket, new_test_doc3['@']));

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc4['@']);
    assert.rejects(Backend.get_individual(ticket_user1.ticket, new_test_doc4['@']));
  });
};
