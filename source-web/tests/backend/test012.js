export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#012 Store, read and delete 3 individuals`, async () => {
    const ticket = await Helpers.get_user1_ticket();

    const memberOf = 'test11:' + Util.guid();
    const resources = 'test11:' + Util.guid();

    const new_test_doc1_uri = 'test11:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('v-s:ThisNoMembership'),
      'v-s:memberOf': Util.newUri(memberOf),
      'v-s:resource': Util.newUri(resources),
      'v-s:created': Util.newDate(new Date()),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
    };

    let res;
    res = await Backend.put_individual(ticket.ticket, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const server_test_doc1 = await Backend.get_individual(ticket.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    res = await Backend.remove_individual(ticket.ticket, new_test_doc1['@']);
    await assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc1['@']));

    const new_test_doc2 = new_test_doc1;
    const new_test_doc2_uri = 'test11:' + Util.guid();
    new_test_doc2['@'] = new_test_doc2_uri;
    new_test_doc2['v-s:memberOf'] = Util.newUri('test11:' + Util.guid());

    res = await Backend.put_individual(ticket.ticket, new_test_doc2);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const server_test_doc2 = await Backend.get_individual(ticket.ticket, new_test_doc2_uri);
    assert(Helpers.compare(new_test_doc2, server_test_doc2));

    res = await Backend.remove_individual(ticket.ticket, new_test_doc2['@']);
    await assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc2['@']));

    const new_test_doc3 = new_test_doc2;
    const new_test_doc3_uri = 'test11:' + Util.guid();
    new_test_doc3['@'] = new_test_doc3_uri;
    new_test_doc3['v-s:memberOf'] = Util.newUri(memberOf);

    res = await Backend.put_individual(ticket.ticket, new_test_doc3);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const server_test_doc3 = await Backend.get_individual(ticket.ticket, new_test_doc3_uri);
    assert(Helpers.compare(new_test_doc3, server_test_doc3));

    res = await Backend.remove_individual(ticket.ticket, new_test_doc3['@']);
    await assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc3['@']));
  });
};
