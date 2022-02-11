export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#008 Individual store and read, test datatype', async () => {
    const ticket = await Helpers.get_user1_ticket();
    const new_test_doc1 = await Helpers.create_test_document1(ticket);

    const server_test_doc1 = await Backend.get_individual(ticket.ticket, new_test_doc1['@']);
    assert(Helpers.compare(new_test_doc1, server_test_doc1));

    await Backend.remove_individual(ticket.ticket, new_test_doc1['@']);
    assert.rejects(Backend.get_individual(ticket.ticket, new_test_doc1['@']));
  });
};