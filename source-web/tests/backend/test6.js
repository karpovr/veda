export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#006 Should store individual by user1 and add right [R] to user2, user2 should successfully read individual, next user1 adds forbidding right [!R] and user2 should fail to read individual', async () => {
    const ticket_user1 = await Helpers.get_user1_ticket();
    const ticket_user2 = await Helpers.get_user2_ticket();

    const new_test_doc1_uri = 'test5:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newStr('test data', 'NONE'),
    };

    let res;

    res = await Backend.put_individual(ticket_user1.ticket, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    let server_test_doc1;

    server_test_doc1 = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    assert.rejects(Backend.get_individual(ticket_user2.ticket, new_test_doc1));

    res = await Helpers.addRight(ticket_user1.ticket, ticket_user2.user_uri, new_test_doc1_uri, ['v-s:canRead']);
    const new_permission = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    server_test_doc1 = await Backend.get_individual(ticket_user2.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    new_permission['@'] = '_';
    delete new_permission['v-s:permissionObject'];
    delete new_permission['v-s:permissionSubject'];

    const right1 = await Backend.get_rights(ticket_user1.ticket, new_test_doc1_uri);
    const right2 = await Backend.get_rights(ticket_user2.ticket, new_test_doc1_uri);

    assert(Helpers.compare(new_permission, right2));

    new_permission['v-s:canUpdate'] = Util.newBool(true);
    new_permission['v-s:canDelete'] = Util.newBool(true);
    new_permission['v-s:canCreate'] = Util.newBool(true);

    assert(Helpers.compare(new_permission, right1));

    server_test_doc1 = await Backend.get_individual(ticket_user2.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    res = await Helpers.addRight(ticket_user1.ticket, ticket_user2.user_uri, new_test_doc1_uri, [], ['v-s:canRead']);
    res = await Helpers.addRight(ticket_user1.ticket, ticket_user2.user_uri, new_test_doc1_uri, ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    assert.rejects(Backend.get_individual(ticket_user2.ticket, new_test_doc1));

    new_test_doc1['v-s:updateCounter'] = Util.newInt(0);
    assert.rejects(Backend.put_individual(ticket_user2.ticket, new_test_doc1));

    res = await Backend.remove_individual(ticket_user1.ticket, new_test_doc1_uri);
    assert.rejects(Backend.get_individual(ticket_user1.ticket, new_test_doc1));
  });
};
