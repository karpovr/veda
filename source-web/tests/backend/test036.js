export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it(`#036 Check rights counter`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();

    const ticket1 = await Helpers.get_user1_ticket();

    const user1 = ticket1.user_uri;

    const doc1 = (await Helpers.create_test_document1(ticket_admin))['@'];

    // Right1 = R
    let res = await Helpers.addRight(ticket_admin.ticket, user1, doc1, ['v-s:canRead']);
    const right1 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    // Right2 = RU
    res = await Helpers.addRight(ticket_admin.ticket, user1, doc1, ['v-s:canRead', 'v-s:canUpdate']);
    const right2 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    // Right3 = RUD
    res = await Helpers.addRight(ticket_admin.ticket, user1, doc1, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    const right3 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canUpdate']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canDelete']);

    res = await Backend.remove_individual(ticket_admin.ticket, right1['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canUpdate']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canDelete']);

    res = await Backend.remove_individual(ticket_admin.ticket, right2['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canUpdate']);
    await Helpers.check_rights_success(ticket1.ticket, doc1, ['v-s:canDelete']);

    res = await Backend.remove_individual(ticket_admin.ticket, right3['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canUpdate']);
    await Helpers.check_rights_fail(ticket1.ticket, doc1, ['v-s:canDelete']);

    // Check multiple permission update & remove
    const doc2 = (await Helpers.create_test_document2(ticket_admin))['@'];

    res = await Helpers.addRight(ticket_admin.ticket, user1, doc2, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    const right4 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    res = await Backend.put_individual(ticket_admin.ticket, right4);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    res = await Backend.put_individual(ticket_admin.ticket, right4);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc2, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc2, ['v-s:canUpdate']);
    await Helpers.check_rights_success(ticket1.ticket, doc2, ['v-s:canDelete']);

    res = await Backend.remove_individual(ticket_admin.ticket, right4['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_fail(ticket1.ticket, doc2, ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket1.ticket, doc2, ['v-s:canUpdate']);
    await Helpers.check_rights_fail(ticket1.ticket, doc2, ['v-s:canDelete']);

    // Check change permission rights
    res = await Helpers.addRight(ticket_admin.ticket, user1, doc2, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    const right5 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc2, ['v-s:canRead']);
    await Helpers.check_rights_success(ticket1.ticket, doc2, ['v-s:canUpdate']);
    await Helpers.check_rights_success(ticket1.ticket, doc2, ['v-s:canDelete']);

    delete right5['v-s:canUpdate'];
    delete right5['v-s:canDelete'];

    res = await Backend.put_individual(ticket_admin.ticket, right5);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket1.ticket, doc2, ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket1.ticket, doc2, ['v-s:canUpdate']);
    await Helpers.check_rights_fail(ticket1.ticket, doc2, ['v-s:canDelete']);
  });
};
