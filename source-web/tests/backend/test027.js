export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#027 Check different group subtrees (2)`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();
    const ticket1 = await Helpers.get_user1_ticket();

    const new_test_doc1 = await Helpers.create_test_document1(ticket_admin);

    const group_A = 'g:group_A' + Util.guid();
    const group_B = 'g:group_B' + Util.guid();
    const group_C = 'g:group_C' + Util.guid();

    let res;

    await Helpers.addToGroup(ticket_admin.ticket, group_A, new_test_doc1['@'], ['v-s:canRead']);

    await Helpers.addToGroup(ticket_admin.ticket, group_B, group_A, ['v-s:canRead']);

    await Helpers.addToGroup(ticket_admin.ticket, group_C, new_test_doc1['@']);

    await Helpers.addToGroup(ticket_admin.ticket, group_B, group_C);

    res = await Helpers.addRight(ticket_admin.ticket, ticket1.user_uri, group_B, ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));


    await Helpers.check_rights_success(ticket1.ticket, new_test_doc1['@'], ['v-s:canRead']);

    await Helpers.check_rights_fail(ticket1.ticket, new_test_doc1['@'], ['v-s:canUpdate']);

    await Helpers.check_rights_fail(ticket1.ticket, new_test_doc1['@'], ['v-s:canDelete']);

    res = await Backend.remove_individual(ticket_admin.ticket, new_test_doc1['@']);
    await Helpers.test_fail_read(ticket_admin, new_test_doc1);
  });
};
