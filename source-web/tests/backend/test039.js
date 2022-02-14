export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(
`#039 User1 stores individual, user1 should read individual.
       User2 should fail to remove individual.`,
  async () => {
    const ticket_user1 = await Helpers.get_user1_ticket();
    const ticket_user2 = await Helpers.get_user2_ticket();

    const new_test_doc1_uri = 'test6:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newStr('test data', 'NONE'),
    };

    const res = await Backend.put_individual(ticket_user1.ticket, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    await Helpers.test_success_read(ticket_user1, new_test_doc1);

    await assert.rejects(Backend.remove_individual(ticket_user2.ticket, new_test_doc1['@']));

    await Helpers.test_success_read(ticket_user1, new_test_doc1);
  });
};
