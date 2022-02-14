export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#008 Store, read and compare individual`, async () => {
    const ticket = await Helpers.get_user1_ticket();
    const new_test_doc1 = await Helpers.create_test_document1(ticket);

    const server_test_doc1 = await Backend.get_individual(ticket.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    await Backend.remove_individual(ticket.ticket, new_test_doc1['@']);
    await assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc1['@']));
  });
};
