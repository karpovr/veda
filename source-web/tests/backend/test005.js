export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#005 User1 stores individual, user2 should fail to read individual`, async () => {
    const ticket_user1 = (await Helpers.get_user1_ticket()).ticket;
    const ticket_user2 = (await Helpers.get_user2_ticket()).ticket;

    const new_test_doc1_uri = 'test3:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    const res = await Backend.put_individual(ticket_user1, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    const server_test_doc1 = await Backend.get_individual(ticket_user1, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    await assert.rejects(Backend.get_individual(ticket_user2, new_test_doc1_uri));

    await Backend.remove_individual(ticket_user1, new_test_doc1_uri);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc1_uri));
  });
};
