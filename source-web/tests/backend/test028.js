export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#028 Check different group subtrees (3)`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();
    const ticket1 = await Helpers.get_user1_ticket();

    const doc1 = (await Helpers.create_test_document1(ticket_admin))['@'];
    const doc2 = (await Helpers.create_test_document1(ticket_admin))['@'];
    const group_A = 'g:group_A' + Util.guid();
    const group_B = 'g:group_B' + Util.guid();

    await Helpers.addToGroup(ticket_admin.ticket, doc2, doc1, ['v-s:canRead']);

    await Helpers.addToGroup(ticket_admin.ticket, group_A, doc2, ['v-s:canRead']);

    await Helpers.addToGroup(ticket_admin.ticket, group_B, group_A, ['v-s:canRead']);

    await Helpers.addToGroup(ticket_admin.ticket, group_B, doc2);

    const res = await Helpers.addRight(ticket_admin.ticket, ticket1.user_uri, group_B, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canUpdate']);

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canDelete']);
  });
};
