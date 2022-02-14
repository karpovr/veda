export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#025 Check groups cycle`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();

    const new_test_doc1 = await Helpers.create_test_document1(ticket_admin);

    const group_A = 'g:group_A' + Util.guid();
    const group_B = 'g:group_B' + Util.guid();
    const group_C = 'g:group_C' + Util.guid();

    await Helpers.addToGroup(ticket_admin.ticket, group_A, group_B);

    await Helpers.addToGroup(ticket_admin.ticket, group_B, group_C);

    await Helpers.addToGroup(ticket_admin.ticket, group_C, group_A);

    await Helpers.addToGroup(ticket_admin.ticket, group_C, new_test_doc1['@']);

    const res = await Helpers.addRight(ticket_admin.ticket, group_C, new_test_doc1['@'], ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket_admin.ticket, new_test_doc1['@'], ['v-s:canRead']);

    await Backend.remove_individual(ticket_admin.ticket, new_test_doc1['@']);
    await Helpers.test_fail_read(ticket_admin, new_test_doc1);
  });
};
