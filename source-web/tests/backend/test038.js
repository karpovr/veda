export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it(`#038 Check single right delete & restore`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();

    const ticket1 = await Helpers.get_user1_ticket();

    const user1 = ticket1.user_uri;

    const doc1 = (await Helpers.create_test_document1(ticket_admin))['@'];

    let res;

    // Right1 = R
    res = await Helpers.addRight(ticket_admin.ticket, user1, doc1, ['v-s:canRead']);
    const right1 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canUpdate']);

    // Right2 = U
    res = await Helpers.addRight(ticket_admin.ticket, user1, doc1, ['v-s:canUpdate']);
    const right2 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canUpdate']);

    // Delete Right1
    right1['v-s:deleted'] = Util.newBool(true);
    res = await Backend.put_individual(ticket_admin.ticket, right1);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canUpdate']);

    // Delete Right2
    right2['v-s:deleted'] = Util.newBool(true);
    res = await Backend.put_individual(ticket_admin.ticket, right2);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canUpdate']);

    // Restore Right1
    delete right1['v-s:deleted'];
    res = await Backend.put_individual(ticket_admin.ticket, right1);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canUpdate']);

    // Restore Right2
    delete right2['v-s:deleted'];
    res = await Backend.put_individual(ticket_admin.ticket, right2);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canUpdate']);

    // Remove Right1
    res = await Backend.remove_individual(ticket_admin.ticket, right1['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canUpdate']);

    // Remove Right2
    res = await Backend.remove_individual(ticket_admin.ticket, right2['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canUpdate']);
  });
};
