export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#033 Test membership isExclusive & ignoreExclusive', async () => {
    const ticket1 = await Helpers.get_user1_ticket();
    const doc_group = 'g:doc_resource_group';
    const doc_group_another = 'g:doc_resource_another_group';
    const new_test_doc3 = await Helpers.create_test_document3(ticket1);

    await Helpers.test_success_read(ticket1, new_test_doc3);
    await Helpers.addToGroup(ticket1.ticket, doc_group, new_test_doc3['@']);

    await Helpers.test_success_read(ticket1, new_test_doc3);
    const new_test_membership1 = await Helpers.create_test_membership1(ticket1, doc_group);

    await Helpers.test_success_read(ticket1, new_test_doc3);
    const new_test_doc4 = await Helpers.create_test_document4(ticket1);

    await Helpers.test_success_read(ticket1, new_test_doc4);
    await Helpers.addToGroup(ticket1.ticket, doc_group_another, new_test_doc4['@']);

    await Helpers.test_fail_read(ticket1, new_test_doc4);

    const new_test_membership2 = await Helpers.create_test_membership2(ticket1, doc_group);
    await Helpers.test_success_read(ticket1, new_test_doc4);

    await Helpers.test_success_read(ticket1, new_test_doc3);
  });
};
