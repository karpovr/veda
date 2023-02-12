export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#047 Check v-s:deleted on individual removal`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();

    const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const script = {
      '@': 'd:test047_script',
      'rdf:type': Util.newUri('v-s:Event'),
      'v-s:triggerByType': Util.newUri('rdfs:Resource1'),
      'v-s:script': Util.newStr(`
const output = get_individual(ticket, 'd:test047_output');
if (veda.Util.hasValue(document, 'v-s:deleted', {data: true, type: 'Boolean'})) {
  output['rdfs:label'] = veda.Util.newStr('DELETED');
} else {
  output['rdfs:label'] = veda.Util.newStr('NOT DELETED');
}
output['test:isFullState'] = document['test:isFullState'];
put_individual(ticket, output);
      `),
      'v-s:created': Util.newDate(new Date()),
      'v-s:author': Util.newUri(ticket_admin.user_uri),
    };

    const output = {
      '@': 'd:test047_output',
      'rdf:type': Util.newUri('rdfs:Resource2'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:author': Util.newUri(ticket_admin.user_uri),
    }

    const individual = {
      '@': 'd:test047_individual',
      'rdf:type': Util.newUri('rdfs:Resource1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:author': Util.newUri(ticket_admin.user_uri),
      'test:isFullState': Util.newBool(true),
    }

    let res = await Backend.put_individual(ticket_admin.ticket, script);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    res = await Backend.put_individual(ticket_admin.ticket, output);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    res = await Backend.put_individual(ticket_admin.ticket, individual);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const output1 = await Backend.get_individual(ticket_admin.ticket, output['@']);
    assert(Util.hasValue(output1, 'rdfs:label', {data: 'NOT DELETED', type: 'String'}));
    assert(Util.hasValue(output1, 'test:isFullState', {data: true, type: 'Boolean'}));

    individual['v-s:deleted'] = Util.newBool(true);
    res = await Backend.put_individual(ticket_admin.ticket, individual);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const output2 = await Backend.get_individual(ticket_admin.ticket, output['@']);
    assert(Util.hasValue(output2, 'rdfs:label', {data: 'DELETED', type: 'String'}));
    assert(Util.hasValue(output2, 'test:isFullState', {data: true, type: 'Boolean'}));

    delete individual['v-s:deleted'];
    res = await Backend.put_individual(ticket_admin.ticket, individual);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const output3 = await Backend.get_individual(ticket_admin.ticket, output['@']);
    assert(Util.hasValue(output3, 'rdfs:label', {data: 'NOT DELETED', type: 'String'}));
    assert(Util.hasValue(output3, 'test:isFullState', {data: true, type: 'Boolean'}));

    res = await Backend.remove_individual(ticket_admin.ticket, individual['@']);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const output4 = await Backend.get_individual(ticket_admin.ticket, output['@']);
    assert(Util.hasValue(output4, 'rdfs:label', {data: 'DELETED', type: 'String'}));
    assert(Util.hasValue(output4, 'test:isFullState', {data: true, type: 'Boolean'}));

    // Clean up
    await Backend.remove_individual(ticket_admin.ticket, script['@']);
    await Backend.remove_individual(ticket_admin.ticket, output['@']);
    await Backend.remove_individual(ticket_admin.ticket, individual['@']);
  });
};
