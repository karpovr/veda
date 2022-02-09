export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#010 Should store 3 and read 3 individuals of type "v-s:NoPermissionStatement"', async () => {
    const ticket = await Helpers.get_user1_ticket();

    const permissionSubject = 'test9:' + Util.guid();
    const permissionObject = 'test9:' + Util.guid();

    const new_test_doc1_uri = 'test9:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('v-s:NoPermissionStatement'),
      'v-s:canDelete': Util.newBool(true),
      'v-s:canRead': Util.newBool(true),
      'v-s:canUpdate': Util.newBool(true),
      'v-s:permissionObject': Util.newUri(permissionObject),
      'v-s:permissionSubject': Util.newUri(permissionSubject),
      'v-s:created': Util.newDate(new Date()),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
    };

    let res;
    res = await Backend.put_individual(ticket.ticket, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_subject, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const server_test_doc1 = await Backend.get_individual(ticket.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    res = await Backend.remove_individual(ticket.ticket, new_test_doc1['@']);
    assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc1['@']));

    const new_test_doc2 = new_test_doc1;
    const new_test_doc2_uri = 'test9:' + Util.guid();
    new_test_doc2['@'] = new_test_doc2_uri;
    new_test_doc2['v-s:canRead'] = Util.newBool(false);

    res = await Backend.put_individual(ticket.ticket, new_test_doc2);
    assert(await Backend.wait_module(Constants.m_subject, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const server_test_doc2 = await Backend.get_individual(ticket.ticket, new_test_doc2_uri);
    assert(Helpers.compare(new_test_doc2, server_test_doc2));

    res = await Backend.remove_individual(ticket.ticket, new_test_doc2['@']);
    assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc2['@']));

    const new_test_doc3 = new_test_doc2;
    const new_test_doc3_uri = 'test9:' + Util.guid();
    new_test_doc3['@'] = new_test_doc3_uri;
    new_test_doc3['v-s:canRead'] = Util.newBool(true);

    res = await Backend.put_individual(ticket.ticket, new_test_doc3);
    Backend.wait_module(Constants.m_subject, res.op_id);
    Backend.wait_module(Constants.m_acl, res.op_id);
    Backend.wait_module(Constants.m_scripts, res.op_id);

    const server_test_doc3 = await Backend.get_individual(ticket.ticket, new_test_doc3_uri);
    assert(Helpers.compare(new_test_doc3, server_test_doc3));

    res = await Backend.remove_individual(ticket.ticket, new_test_doc3['@']);
    assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc3['@']));
  });
};
