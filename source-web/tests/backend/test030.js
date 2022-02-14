export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#030 Check search using ranges`, async () => {
    const ticket_user1 = await Helpers.get_user1_ticket();

    const test_group_uid = 'test13:' + Util.guid();

    const new_test_doc1_uri = 'test13:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:test_datetime0': Util.newDate(new Date('2014-01-01')),
      'v-s:test_datetime1': Util.newDate(new Date('2014-05-01')),
    };

    const new_test_doc2_uri = 'test13:' + Util.guid();
    const new_test_doc2 = {
      '@': new_test_doc2_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:test_datetime0': Util.newDate(new Date('2014-01-02')),
      'v-s:test_datetime1': Util.newDate(new Date('2014-05-01')),
    };

    const new_test_doc3_uri = 'test13:' + Util.guid();
    const new_test_doc3 = {
      '@': new_test_doc3_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:test_datetime0': Util.newDate(new Date('2014-01-02')),
      'v-s:test_datetime1': Util.newDate(new Date('2014-06-11')),
    };

    const new_test_doc4_uri = 'test13:' + Util.guid();
    const new_test_doc4 = {
      '@': new_test_doc4_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:test_datetime0': Util.newDate(new Date('2014-01-04')),
      'v-s:test_datetime1': Util.newDate(new Date('2014-06-12')),
    };

    await Backend.put_individual(ticket_user1.ticket, new_test_doc1);
    await Backend.put_individual(ticket_user1.ticket, new_test_doc2);
    await Backend.put_individual(ticket_user1.ticket, new_test_doc3);
    let res = await Backend.put_individual(ticket_user1.ticket, new_test_doc4);

    assert(await Backend.wait_module(Constants.m_fulltext_indexer, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    let data;

    data = await Backend.query(ticket_user1.ticket, test_group_uid);
    assert(data.result.length === 4);

    data = await Backend.query(ticket_user1.ticket, "'v-s:test_group' === '" + test_group_uid + "'");
    assert(data.result.length === 4);

    data = await Backend.query(ticket_user1.ticket, "'v-s:test_datetime0' === [2013-12-31T00:00:00, 2014-01-03T00:00:00] && 'v-s:test_group' === '" + test_group_uid + "'");
    assert(data.result.length === 3);

    assert((data.result[0] == new_test_doc1_uri || data.result[1] == new_test_doc1_uri || data.result[2] == new_test_doc1_uri) &&
                (data.result[0] == new_test_doc2_uri || data.result[1] == new_test_doc2_uri || data.result[2] == new_test_doc2_uri) &&
                (data.result[0] == new_test_doc3_uri || data.result[1] == new_test_doc3_uri || data.result[2] == new_test_doc3_uri));

    data = await Backend.query(ticket_user1.ticket, "'v-s:test_datetime1' === [2014-04-01T00:00:00, 2014-06-03T00:00:00] && 'v-s:test_datetime0' === [2013-12-31T00:00:00, 2014-01-03T00:00:00] && 'v-s:test_group' === '" + test_group_uid + "'");
    assert(data.result.length === 2);

    assert((data.result[0] == new_test_doc1_uri || data.result[1] == new_test_doc1_uri) && (data.result[0] == new_test_doc2_uri || data.result[1] == new_test_doc2_uri));

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc1['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    await Helpers.test_fail_read(ticket_user1, new_test_doc1);

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc2['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    await Helpers.test_fail_read(ticket_user1, new_test_doc2);

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc3['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    await Helpers.test_fail_read(ticket_user1, new_test_doc3);

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc4['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    await Helpers.test_fail_read(ticket_user1, new_test_doc4);
  });
};
