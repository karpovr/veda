export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#014 Check put_individual, add_to_individual, set_in_individual, remove_from_individual, remove_individual`, async () => {
    const ticket_user1 = await Helpers.get_user1_ticket();

    const now = Util.newDate(new Date());

    // put_individual
    const new_test_doc1_uri = 'test14:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': now,
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    let res;
    res = await Backend.put_individual(ticket_user1.ticket, new_test_doc1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    let read_individual;
    read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1, read_individual));

    // add_to_individual
    const new_test_add1 = {
      '@': new_test_doc1_uri,
      'v-s:author': [
        {
          data: 'td:ValeriyBushenev-Programmer2',
          type: 'Uri',
        },
        {
          data: 'td:test-q',
          type: 'Uri',
        }],
    };

    res = await Backend.add_to_individual(ticket_user1.ticket, new_test_add1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    const new_test_doc1_add1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': [
        {
          data: 'td:ValeriyBushenev-Programmer1',
          type: 'Uri',
        },
        {
          data: 'td:ValeriyBushenev-Programmer2',
          type: 'Uri',
        },
        {
          data: 'td:test-q',
          type: 'Uri',
        }],
      'v-s:created': now,
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1_add1, read_individual));

    // set_in_individual
    let new_test_set1 = {
      '@': new_test_doc1_uri,
      'v-s:author': Util.newUri('td:test-e1'),
    };

    await Backend.set_in_individual(ticket_user1.ticket, new_test_set1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    let new_test_doc1_set1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:test-e1'),
      'v-s:created': now,
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1_set1, read_individual));

    // add_to_individual (2)
    new_test_set1 = {
      '@': new_test_doc1_uri,
      'v-s:author': Util.newUri('td:test-e2'),
    };

    await Backend.add_to_individual(ticket_user1.ticket, new_test_set1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    new_test_doc1_set1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': [Util.newUri('td:test-e1')[0], Util.newUri('td:test-e2')[0]],
      'v-s:created': now,
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1_set1, read_individual));

    // add_to_individual (3)
    new_test_set1 = {
      '@': new_test_doc1_uri,
      'v-s:author': Util.newUri('td:test-e3'),
    };

    res = await Backend.add_to_individual(ticket_user1.ticket, new_test_set1);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    new_test_doc1_set1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': [Util.newUri('td:test-e1')[0], Util.newUri('td:test-e2')[0], Util.newUri('td:test-e3')[0]],
      'v-s:created': now,
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
    assert(Helpers.compare(new_test_doc1_set1, read_individual));


    // remove_from_individual
    const new_test_remove_from2 = {
      '@': new_test_doc1_uri,
      'v-s:author': Util.newUri('td:test-e2'),
    };

    res = await Backend.remove_from_individual(ticket_user1.ticket, new_test_remove_from2);
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));

    read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);

    const new_test_doc1_remove_from1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:created': now,
      'v-s:author': [Util.newUri('td:test-e1')[0], Util.newUri('td:test-e3')[0]],
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };
    assert(Helpers.compare(new_test_doc1_remove_from1, read_individual));

    await Backend.remove_individual(ticket_user1.ticket, new_test_doc1['@']);
    await assert.rejects(Backend.get_individual(ticket_user1.ticket, new_test_doc1['@']));
  });
};
