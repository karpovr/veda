export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it(`#034 Check put_individuals`, async () => {
    const ticket_user1 = await Helpers.get_user1_ticket();

    const new_test_doc1_uri_1 = 'test21_1:' + Util.guid();

    const test_data_uid = Util.guid();
    const test_data = 'testdata ' + test_data_uid;

    const new_test_doc1 = {
      '@': new_test_doc1_uri_1,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:test_field': Util.newStr(test_data, 'NONE'),
      'v-s:test_fieldA': Util.newUri('BBB' + test_data_uid),
      'v-s:test_fieldB': Util.newUri('CCC' + test_data_uid),
      'v-s:created': Util.newDate(new Date()),
    };

    const new_test_doc1_uri_2 = 'test21_2:' + Util.guid();
    const new_test_doc2 = {
      '@': new_test_doc1_uri_2,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:test_field': Util.newUri(test_data),
      'v-s:created': Util.newDate(new Date()),
    };

    const new_test_doc1_uri_3 = 'test21_3:' + Util.guid();
    const new_test_doc3 = {
      '@': new_test_doc1_uri_3,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:test_field': Util.newUri(test_data),
      'v-s:test_fieldA': Util.newUri('BBB' + test_data_uid),
      'v-s:created': Util.newDate(new Date()),
    };

    let res;

    res = await Backend.put_individuals(ticket_user1.ticket, [new_test_doc1, new_test_doc2, new_test_doc3]);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    const read_individual1 = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri_1);
    const read_individual2 = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri_2);
    const read_individual3 = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri_3);

    assert(
      Helpers.compare(new_test_doc1, read_individual1) &&
      Helpers.compare(new_test_doc2, read_individual2) &&
      Helpers.compare(new_test_doc3, read_individual3),
    );

    const ticket_user2 = await Helpers.get_user1_ticket();

    // document content author != user1
    const new_test_doc1_uri_4 = 'test21_4:' + Util.guid();
    const new_test_doc4 = {
      '@': new_test_doc1_uri_4,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:AndreyBychin-Analyst2'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newUri(test_data),
    };
    res = await Backend.put_individual(ticket_user2.ticket, new_test_doc4);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    assert.rejects(Backend.put_individuals(ticket_user1.ticket, [new_test_doc1, new_test_doc2, new_test_doc3, new_test_doc4]), {code: 472});
  });
};
