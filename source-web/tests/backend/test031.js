export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#031 Check rights filter`, async () => {
    const ticket_user1 = await Helpers.get_user1_ticket();
    const ticket_user2 = await Helpers.get_user2_ticket();
    const ticket_admin = await Helpers.get_admin_ticket();

    const new_test_doc1_uri = 'test31:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    let res;

    res = await Backend.put_individual(ticket_user1.ticket, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.test_success_read(ticket_user1, new_test_doc1);
    await Helpers.test_fail_read(ticket_user2, new_test_doc1);

    res = await Helpers.addRight(ticket_user1.ticket, ticket_user2.user_uri, new_test_doc1_uri, ['v-s:canRead', 'v-s:canUpdate']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.test_success_update(ticket_user1, new_test_doc1);
    await Helpers.test_success_update(ticket_user2, new_test_doc1);

    const new_permission_filter_uri = 'test31-pf:' + Util.guid();
    const new_permission_filter = {
      '@': new_permission_filter_uri,
      'rdf:type': Util.newUri('v-s:PermissionFilter'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:permissionObject': Util.newUri(new_test_doc1_uri),
      'v-s:resource': Util.newUri(new_permission_filter_uri + 'xxx'),
      'v-s:canRead': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_user1.ticket, new_permission_filter);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.test_fail_update(ticket_user1, new_test_doc1);
    await Helpers.test_fail_update(ticket_user2, new_test_doc1);
    await Helpers.test_success_read(ticket_user1, new_test_doc1);
    await Helpers.test_success_read(ticket_user2, new_test_doc1);

    let res1 = await Helpers.addRight(ticket_admin.ticket, ticket_user2.user_uri, new_test_doc1_uri, ['v-s:canUpdate'], [], new_permission_filter_uri + 'xxx');
    const new_permission1 = res1[0];

    await Helpers.test_fail_update(ticket_user1, new_test_doc1);
    await Helpers.test_success_update(ticket_user2, new_test_doc1);

    // disable permission with filter
    new_permission1['v-s:deleted'] = Util.newBool(true);
    res1 = await Backend.put_individual(ticket_admin.ticket, new_permission1);
    assert(await Backend.wait_module(Constants.m_acl, res1.op_id));

    await Helpers.test_fail_update(ticket_user2, new_test_doc1);

    // disable filter
    new_permission_filter['v-s:deleted'] = Util.newBool(true);
    const res2 = await Backend.put_individual(ticket_admin.ticket, new_permission_filter);
    assert(await Backend.wait_module(Constants.m_acl, res2.op_id));

    await Helpers.test_success_update(ticket_user2, new_test_doc1);
  });
};
