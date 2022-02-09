export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#011 Individual of [v-s:Membership]', async () => {
    const ticket1 = await Helpers.get_user1_ticket();
    const ticket2 = await Helpers.get_user2_ticket();

    let res;
    const new_test_doc1 = await Helpers.create_test_document1(ticket1);

    let server_test_doc1;
    server_test_doc1 = await Backend.get_individual(ticket1.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    assert.rejects(Backend.get_individual(ticket2.ticket, new_test_doc1['@']));

    const doc_group = 'g:doc_g1roup_' + Util.guid();
    const user_group = 'g:user_g1roup_' + Util.guid();

    res = await Helpers.addToGroup(ticket1.ticket, doc_group, new_test_doc1['@']);
    res = await Helpers.addToGroup(ticket1.ticket, user_group, ticket2.user_uri);

    const membersip1 = res[0];

    res = await Helpers.addRight(ticket1.ticket, user_group, doc_group, ['v-s:canRead']);
    const op_id = res[1].op_id;
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    server_test_doc1 = await Backend.get_individual(ticket2.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    res = await Helpers.removeFromGroup(ticket1.ticket, user_group, ticket2.user_uri);
    assert(await Backend.wait_module(Constants.m_acl, res[1].op_id));

    assert.rejects(Backend.get_individual(ticket2.ticket, new_test_doc1['@']));

    res = await Backend.remove_individual(ticket1.ticket, new_test_doc1['@']);
    assert.rejects(Backend.get_individual(ticket1.ticket, new_test_doc1['@']));
  });
};
