export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#002 Should get individual \'owl:\'', async () => {
    const ticket = await Helpers.get_user1_ticket();
    const owl = await Backend.get_individual(ticket.ticket, 'owl:');
    assert.ok(owl['@'] === 'owl:');
    assert.ok(owl['rdf:type'][0].data === 'owl:Ontology');
  });
};
