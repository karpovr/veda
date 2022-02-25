export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#004 Attributive search`, async () => {
    const ticket_user1 = (await Helpers.get_user1_ticket()).ticket;
    const test_group_uid = 'test30:' + Util.guid();

    const new_test_doc1_uri = 'test30:' + Util.guid();
    const label1 = 'test30.1:' + Util.guid();
    const comment = 'comment30:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'rdfs:label': Util.newUri(label1),
      'rdfs:comment': Util.newUri(comment),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
    };

    const new_test_doc2_uri = 'test30:' + Util.guid();
    const label2 = 'test30.2:' + Util.guid();
    const new_test_doc2 = {
      '@': new_test_doc2_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'rdfs:label': Util.newUri(label2),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
    };

    const new_test_doc3_uri = 'test30.1:' + Util.guid();
    const new_test_doc3 = {
      '@': new_test_doc3_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'rdfs:label': Util.newUri(label1),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
    };

    const new_test_doc4_uri = 'test30.1:' + Util.guid();
    const new_test_doc4 = {
      '@': new_test_doc4_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'rdfs:label': Util.newUri(label2),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
    };

    const new_test_doc5_uri = 'test30.2:' + Util.guid();
    const comment2 = 'comm1' + Util.guid();
    const new_test_doc5 = {
      '@': new_test_doc5_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'rdfs:label': Util.newUri(label1),
      'rdfs:comment': Util.newUri(comment2),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
    };

    const new_test_doc6_uri = 'test30.2:' + Util.guid();
    const new_test_doc6 = {
      '@': new_test_doc6_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:test_group': Util.newUri(test_group_uid),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
    };

    let res;

    await Backend.put_individual(ticket_user1, new_test_doc1);
    await Backend.put_individual(ticket_user1, new_test_doc2);
    await Backend.put_individual(ticket_user1, new_test_doc3);
    await Backend.put_individual(ticket_user1, new_test_doc4);
    await Backend.put_individual(ticket_user1, new_test_doc5);
    res = await Backend.put_individual(ticket_user1, new_test_doc6);

    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_fulltext_indexer, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    let data;

    data = (await Backend.query(ticket_user1, "'*' == 'test30.1*' && 'v-s:test_group' === '" + test_group_uid + "'")).result;
    assert(data.length === 3);

    data = (await Backend.query(ticket_user1, test_group_uid)).result;
    assert(data.length === 6);

    data = (await Backend.query(ticket_user1, "'@' == 'test30.1*' && 'v-s:test_group' === '" + test_group_uid + "'")).result;
    assert(data.length === 2);

    data = (await Backend.query(ticket_user1, "('@' == 'test30.1*' || '@' == 'test30.2*') && 'v-s:test_group' === '" + test_group_uid + "'")).result;
    assert(data.length === 4);

    data = (await Backend.query(ticket_user1, "'@' == 'test30*' && 'v-s:test_group' === '" + test_group_uid + "'")).result;
    assert(data.length === 6);

    data = (await Backend.query(ticket_user1, "'rdfs:label.isExists' == 'true' && 'v-s:test_group' === '" + test_group_uid + "'")).result;
    assert(data.length === 5);

    data = (await Backend.query(ticket_user1, "'rdfs:comment' == 'comment*' && 'v-s:test_group' === '" + test_group_uid + "'")).result;
    assert(data.length === 1);

    await Backend.remove_individual(ticket_user1, new_test_doc1['@']);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc1['@']));

    data = (await Backend.query(ticket_user1, "'rdfs:comment' == 'comm1*' && 'v-s:test_group' === '" + test_group_uid + "'")).result;
    assert(data.length === 1);

    await Backend.remove_individual(ticket_user1, new_test_doc5['@']);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc5['@']));

    await Backend.remove_individual(ticket_user1, new_test_doc2['@']);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc2['@']));

    await Backend.remove_individual(ticket_user1, new_test_doc3['@']);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc3['@']));

    await Backend.remove_individual(ticket_user1, new_test_doc4['@']);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc4['@']));

    await Backend.remove_individual(ticket_user1, new_test_doc6['@']);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc6['@']));
  });
};
