export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#018 Nested groups with restrictions (2)', async () => {
    const ticket1 = await Helpers.get_user1_ticket();
    const ticket2 = await Helpers.get_user2_ticket();

    let res;
    const doc1 = await Helpers.create_test_document1(ticket1, 'doc1_');
    const doc2 = await Helpers.create_test_document1(ticket1, 'doc2_');
    const doc3 = await Helpers.create_test_document1(ticket1, 'doc3_');
    const doc_group1_uri = 'g:doc_g1roup1_' + Util.guid();
    const doc_group2_uri = 'g:doc_g1roup2_' + Util.guid();
    const doc_group3_uri = 'g:doc_g1roup3_' + Util.guid();

    await Helpers.test_success_read(ticket1, doc1);

    await Helpers.test_fail_read(ticket2, doc1);

    await Helpers.test_success_read(ticket1, doc2);

    await Helpers.test_fail_read(ticket2, doc2);

    await Helpers.test_success_read(ticket1, doc3);

    await Helpers.test_fail_read(ticket2, doc3);

    await Helpers.addToGroup(ticket1.ticket, doc_group1_uri, doc3['@']);
    await Helpers.addToGroup(ticket1.ticket, doc_group2_uri, doc3['@']);
    await Helpers.addToGroup(ticket1.ticket, doc_group1_uri, doc1['@']);
    await Helpers.addToGroup(ticket1.ticket, doc_group2_uri, doc1['@']);
    await Helpers.addToGroup(ticket1.ticket, doc1['@'], doc2['@']);
    await Helpers.addToGroup(ticket1.ticket, doc1['@'], doc3['@'], ['v-s:canRead']);
    await Helpers.addToGroup(ticket1.ticket, doc_group3_uri, doc_group1_uri);
    await Helpers.addToGroup(ticket1.ticket, doc_group3_uri, doc_group2_uri);

    res = await Helpers.addRight(ticket1.ticket, ticket2.user_uri, doc_group3_uri, ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    res = await Helpers.addRight(ticket1.ticket, ticket2.user_uri, doc_group2_uri, ['v-s:canUpdate']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    res = await Helpers.addRight(ticket1.ticket, ticket2.user_uri, doc_group1_uri, ['v-s:canDelete']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket2.ticket, doc1['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    await Helpers.check_rights_success(ticket2.ticket, doc3['@'], ['v-s:canRead']);

    await Helpers.check_rights_success(ticket2.ticket, doc3['@'], ['v-s:canUpdate']);

    await Helpers.check_rights_success(ticket2.ticket, doc3['@'], ['v-s:canDelete']);

    await Backend.remove_individual(ticket1.ticket, doc1['@']);
    await Helpers.test_fail_read(ticket1, doc1);

    await Backend.remove_individual(ticket1.ticket, doc2['@']);
    await Helpers.test_fail_read(ticket1, doc2);

    await Backend.remove_individual(ticket1.ticket, doc3['@']);
    await Helpers.test_fail_read(ticket1, doc3);
  });
};
