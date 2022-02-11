export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#009 user1 stores file, user2 can not not read file, add right [R] for user2, add right [!R] for user2', async () => {
    const ticket1 = await Helpers.get_user1_ticket();
    const ticket2 = await Helpers.get_user2_ticket();

    const new_test_doc1 = await Helpers.create_test_document1(ticket1);

    let server_test_doc1;
    server_test_doc1 = await Backend.get_individual(ticket1.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    assert.rejects(Backend.get_individual(ticket2.ticket, new_test_doc1['@']));

    let res;
    res = await Helpers.addRight(ticket1.ticket, ticket2.user_uri, new_test_doc1['@'], ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    server_test_doc1 = await Backend.get_individual(ticket2.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    res = await Helpers.addRight(ticket1.ticket, ticket2.user_uri, new_test_doc1['@'], [], ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    assert.rejects(Backend.get_individual(ticket2.ticket, new_test_doc1['@']));

    await Backend.remove_individual(ticket1.ticket, new_test_doc1['@']);
    assert.rejects(Backend.get_individual(ticket1.ticket, new_test_doc1['@']));
  });
};