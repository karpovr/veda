export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#007 User1 stores individual, admin should read individual`, async () => {
    const ticket_user1 = (await Helpers.get_user1_ticket()).ticket;
    const admin_ticket = (await Helpers.get_admin_ticket()).ticket;

    const new_test_doc1_uri = 'test6:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newStr('test data', 'NONE'),
    };

    let res = await Backend.put_individual(ticket_user1, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    let server_test_doc1;
    server_test_doc1 = await Backend.get_individual(ticket_user1, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    server_test_doc1 = await Backend.get_individual(admin_ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    res = await Backend.remove_individual(ticket_user1, new_test_doc1['@']);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc1_uri));
  });
};
