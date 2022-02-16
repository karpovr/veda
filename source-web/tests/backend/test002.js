export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#002 Get individual 'owl:'`, async () => {
    const ticket = await Helpers.get_user1_ticket();
    console.log(ticket);
    let owl;
    try {
      owl = await Backend.get_individual(ticket.ticket, 'owl:');
      console.log('1:', owl['@']);
    } catch (error) {
      console.log('2:', error, error.stack);
    }
    assert(owl['@'] === 'owl:');
    assert(owl['rdf:type'][0].data === 'owl:Ontology');
  });
};
