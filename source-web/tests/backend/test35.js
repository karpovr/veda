export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#035 test restrictions in subject groups', async () => {
    const ticket_admin = await Helpers.get_admin_ticket();

    const ticket1 = await Helpers.get_user1_ticket();
    const ticket2 = await Helpers.get_user2_ticket();

    const user1 = ticket1.user_uri;
    const user2 = ticket2.user_uri;

    const doc1 = (await Helpers.create_test_document1(ticket_admin))['@'];

    const group_Doc = 'g:group_A' + Util.guid();
    const group_User = 'g:group_B' + Util.guid();

    await Helpers.addToGroup(ticket_admin.ticket, group_Doc, doc1);

    await Helpers.addToGroup(ticket_admin.ticket, group_User, user1, ['v-s:canRead']);

    await Helpers.addToGroup(ticket_admin.ticket, group_User, user2);

    const res = await Helpers.addRight(ticket_admin.ticket, group_User, group_Doc, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canUpdate']);

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canDelete']);

    await Helpers.check_rights_success(ticket2.ticket, doc1, ['v-s:canRead']);

    await Helpers.check_rights_success(ticket2.ticket, doc1, ['v-s:canUpdate']);

    await Helpers.check_rights_success(ticket2.ticket, doc1, ['v-s:canDelete']);
  });
};
