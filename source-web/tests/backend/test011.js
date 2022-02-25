export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(
`#011 User1 stores individual, user2 should fail to read individual.
       User1 adds individual to object group, user1 adds user2 to subject group.
       User1 adds right [R] for subject group to object group, user2 should read individual.
       User1 removes user2 from subject group, user2 should fail to read individual.
       User1 removes individual, user1 should fail to read individual.`,
  async () => {
    const ticket1 = await Helpers.get_user1_ticket();
    const ticket2 = await Helpers.get_user2_ticket();

    let res;
    const new_test_doc1 = await Helpers.create_test_document1(ticket1);

    let server_test_doc1;
    server_test_doc1 = await Backend.get_individual(ticket1.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    await assert.rejects(Backend.get_individual(ticket2.ticket, new_test_doc1['@']));

    const doc_group = 'g:doc_g1roup_' + Util.guid();
    const user_group = 'g:user_g1roup_' + Util.guid();

    await Helpers.addToGroup(ticket1.ticket, doc_group, new_test_doc1['@']);
    await Helpers.addToGroup(ticket1.ticket, user_group, ticket2.user_uri);

    res = await Helpers.addRight(ticket1.ticket, user_group, doc_group, ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    server_test_doc1 = await Backend.get_individual(ticket2.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    res = await Helpers.removeFromGroup(ticket1.ticket, user_group, ticket2.user_uri);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await assert.rejects(Backend.get_individual(ticket2.ticket, new_test_doc1['@']));

    await Backend.remove_individual(ticket1.ticket, new_test_doc1['@']);
    await assert.rejects(Backend.get_individual(ticket1.ticket, new_test_doc1['@']));
  });
};
