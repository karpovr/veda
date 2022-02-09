export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#015 Document as a group', async () => {
    const ticket1 = await Helpers.get_user1_ticket();
    const ticket2 = await Helpers.get_user2_ticket();

    let res;
    const doc1 = await Helpers.create_test_document1(ticket1);
    const doc2 = await Helpers.create_test_document1(ticket1);

    await Helpers.test_success_read(ticket1, doc1);

    await Helpers.test_fail_read(ticket2, doc1);

    await Helpers.test_success_read(ticket1, doc2);

    await Helpers.test_fail_read(ticket2, doc2);

    res = await Helpers.addToGroup(ticket1.ticket, doc1['@'], doc2['@']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    res = await Helpers.addRight(ticket1.ticket, ticket2.user_uri, doc1['@'], ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.test_success_read(ticket2, doc1);
    await Helpers.test_success_read(ticket2, doc2);

    res = await Helpers.removeFromGroup(ticket1.ticket, doc1['@'], doc2['@']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.test_success_read(ticket2, doc1);

    await Helpers.test_fail_read(ticket2, doc2);

    await Backend.remove_individual(ticket1.ticket, doc1['@']);

    await Helpers.test_fail_read(ticket1, doc1);

    await Backend.remove_individual(ticket1.ticket, doc2['@']);

    await Helpers.test_fail_read(ticket1, doc2);
  });
};
