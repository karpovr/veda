export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#029 Check server side script: decimal, and various attribute value formats: [{}], {}, [[{}]]`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();
    const new_test_script_uri = Util.genUri();
    const new_test_script = {
      '@': new_test_script_uri,
      'rdf:type': Util.newUri('v-s:Event'),
      'v-s:triggerByType': Util.newUri('rdfs:Resource1'),
      'v-s:script': Util.newStr(`
if (parent_script_id !== "") return;
document["v-s:created"]= veda.Util.newDate(new Date("2017-03-03"))[0];
put_individual(ticket, document, _event_id);
var document1 = {
  "@": document["@"],
  "v-s:test_Obj": veda.Util.newDate(new Date("2017-03-03"))[0]
};
set_in_individual(ticket, document1, _event_id);
var document2 = {
  "@": document["@"],
  "v-s:test_ArArObj": [veda.Util.newInt(20000001)]
};
add_to_individual(ticket, document2, _event_id);
var document3 = {
  "@": document["@"],
  "v-s:test_datetime0": veda.Util.newDate(new Date("2017-01-03"))
};
set_in_individual(ticket, document3, _event_id);
      `),
      'v-s:created': Util.newDate(new Date()),
      'v-s:author': Util.newUri(ticket_admin.user_uri),
    };

    const res = await Backend.put_individual(ticket_admin.ticket, new_test_script);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const doc = await Helpers.create_test_document2(ticket_admin);

    await Backend.remove_individual(ticket_admin.ticket, new_test_script['@']);

    doc['v-s:test_datetime0'] = Util.newDate(new Date('2017-01-03'));
    doc['v-s:test_ArArObj'] = Util.newInt(20000001);
    doc['v-s:test_Obj'] = Util.newDate(new Date('2017-03-03'));
    doc['v-s:created'] = Util.newDate(new Date('2017-03-03'));

    await Helpers.test_success_read(ticket_admin, doc);

    await Backend.remove_individual(ticket_admin.ticket, doc['@']);
    await Helpers.test_fail_read(ticket_admin, doc);
  });
};
