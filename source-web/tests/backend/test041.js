export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it(`#041 Check PermissionStatement dropCount`, async () => {
    const ticket_user = await Helpers.get_user1_ticket();
    const user = ticket_user.user_uri;
    const ticket_admin = await Helpers.get_admin_ticket();
    const doc = await Helpers.create_test_document1(ticket_admin);

    let res;

    // R - 3, U - 2, D - 2
    res = await Helpers.addRight(ticket_admin.ticket, user, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    const right1 = res[0];
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    res = await Helpers.addRight(ticket_admin.ticket, user, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    res = await Helpers.addRight(ticket_admin.ticket, user, doc['@'], ['v-s:canRead']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    // User RUD doc
    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // 3R2U2D -> 3R2U0D (забираем D)
    const test_perm1_dropCount_uri = Util.genUri();
    const test_perm1_dropCount = {
      '@': test_perm1_dropCount_uri,
      'rdf:type': Util.newUri('v-s:PermissionStatement'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:permissionObject': Util.newUri(doc['@']),
      'v-s:permissionSubject': Util.newUri(user),
      'v-s:canDelete': Util.newBool(true),
      'v-s:deleted': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_perm1_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate']);
    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canDelete']);

    // 3R2U0D -> 3R1U0D (забираем U и ставим U=1)
    const test_perm2_dropCount_uri = Util.genUri();
    let test_perm2_dropCount = {
      '@': test_perm2_dropCount_uri,
      'rdf:type': Util.newUri('v-s:PermissionStatement'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:permissionObject': Util.newUri(doc['@']),
      'v-s:permissionSubject': Util.newUri(user),
      'v-s:canUpdate': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_perm2_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate']);
    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canDelete']);

    // 3R1U0D -> 2R0U0D
    res = await Backend.remove_individual(ticket_admin.ticket, right1['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead']);
    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canUpdate', 'v-s:canDelete']);

    // В предыдущий Perm добавляем мощности и v-s:deleted=true, пытаемся обнулить
    test_perm2_dropCount = {
      '@': test_perm2_dropCount_uri,
      'rdf:type': Util.newUri('v-s:PermissionStatement'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:permissionObject': Util.newUri(doc['@']),
      'v-s:permissionSubject': Util.newUri(user),
      'v-s:canRead': Util.newBool(true),
      'v-s:canUpdate': Util.newBool(true),
      'v-s:canDelete': Util.newBool(true),
      'v-s:deleted': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_perm2_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    // (права на R должны остаться)
    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead']);

    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canUpdate', 'v-s:canDelete']);

    // 2R0U0 ->
    const test_perm3_dropCount_uri = Util.genUri();
    const test_perm3_dropCount = {
      '@': test_perm3_dropCount_uri,
      'rdf:type': Util.newUri('v-s:PermissionStatement'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:permissionObject': Util.newUri(doc['@']),
      'v-s:permissionSubject': Util.newUri(ticket_user.user_uri),
      'v-s:canRead': Util.newBool(true),
      'v-s:canUpdate': Util.newBool(true),
      'v-s:deleted': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_perm3_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
  });
};
