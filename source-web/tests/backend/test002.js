export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#002 Get individual 'owl:'`, async () => {
    const ticket = await Helpers.get_user1_ticket();
    const owl = await Backend.get_individual(ticket.ticket, 'owl:');
    assert(owl['@'] === 'owl:' && owl['rdf:type'][0].data === 'owl:Ontology');
  });
};
