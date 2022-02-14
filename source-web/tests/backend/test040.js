export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#040 Check Membership dropCount`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();
    const ticket_user = await Helpers.get_user1_ticket();
    const doc_group = 'g:doc_resource_group';
    const doc = await Helpers.create_test_document3(ticket_admin);

    let res;

    await Helpers.test_success_read(ticket_admin, doc);
    await Helpers.test_fail_read(ticket_user, doc);

    // doc добавляем в doc_gr с RUD
    await Helpers.addToGroup(ticket_admin.ticket, doc_group, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // User RUD doc_gr
    res = await Helpers.addRight(ticket_admin.ticket, ticket_user.user_uri, doc_group, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    await Helpers.check_rights_success(ticket_user.ticket, doc_group, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // doc  в doc_gr с R, UD обнуляем
    const test_memb1_dropCount_uri = Util.genUri();
    const test_memb1_dropCount = {
      '@': test_memb1_dropCount_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:resource': Util.newUri(doc['@']),
      'v-s:memberOf': Util.newUri(doc_group),
      'v-s:canUpdate': Util.newBool(true),
      'v-s:canDeleted': Util.newBool(true),
      'v-s:deleted': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_memb1_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    // У User есть RUD на doc_group
    await Helpers.check_rights_success(ticket_user.ticket, doc_group, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // У User есть R на doc
    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead']);

    // У User нет UD на doc
    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canUpdate', 'v-s:canDelete']);

    // doc  в doc_gr с RUD
    const test_memb2_dropCount_uri = Util.genUri();
    const test_memb2_dropCount = {
      '@': test_memb2_dropCount_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:resource': Util.newUri(doc['@']),
      'v-s:memberOf': Util.newUri(doc_group),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_memb2_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    // У User есть RUD на doc
    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // Обнуление всех вхождений doc в doc_gr
    const test_memb3_dropCount_uri = Util.genUri();
    const test_memb3_dropCount = {
      '@': test_memb3_dropCount_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:resource': Util.newUri(doc['@']),
      'v-s:memberOf': Util.newUri(doc_group),
      'v-s:deleted': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_memb3_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    // У User нет RUD на doc
    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // doc в doc_gr с RUD
    const test_memb4_dropCount_uri = Util.genUri();
    let test_memb4_dropCount = {
      '@': test_memb4_dropCount_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:resource': Util.newUri(doc['@']),
      'v-s:memberOf': Util.newUri(doc_group),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_memb4_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // В предыдущий membership добавляем v-s:deleted, пытаемся забрать права. Не должно срабатывать
    test_memb4_dropCount = {
      '@': test_memb4_dropCount_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:resource': Util.newUri(doc['@']),
      'v-s:memberOf': Util.newUri(doc_group),
      'v-s:deleted': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_memb4_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    // Права остались RUD
    await Helpers.check_rights_success(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);

    // Создаём новый membership всё обнуляем
    const test_memb5_dropCount_uri = Util.genUri();
    const test_memb5_dropCount = {
      '@': test_memb5_dropCount_uri,
      'rdf:type': Util.newUri('v-s:Membership'),
      'v-s:dropCount': Util.newBool(true),
      'v-s:resource': Util.newUri(doc['@']),
      'v-s:memberOf': Util.newUri(doc_group),
      'v-s:canRead': Util.newBool(true),
      'v-s:canUpdate': Util.newBool(true),
      'v-s:canDeleted': Util.newBool(true),
      'v-s:deleted': Util.newBool(true),
    };
    res = await Backend.put_individual(ticket_admin.ticket, test_memb5_dropCount);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    // Прав нет
    await Helpers.check_rights_fail(ticket_user.ticket, doc['@'], ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
  });
};
