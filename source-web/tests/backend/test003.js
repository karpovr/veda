export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it(`#003 Find individual 'owl:' using query: '@' == 'owl:'`, async () => {
    const ticket = await Helpers.get_user1_ticket();
    const data = await Backend.query(ticket.ticket, "'@'=='owl:'");
    assert.ok(data.result.indexOf('owl:') >= 0);
  });
};
