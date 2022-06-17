export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test('#044 logout user', async () => {
    const ticket1 = await Backend.authenticate('bushenevvt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    assert(ticket1.ticket.length > 0 && ticket1.end_time > Date.now() && ticket1.user_uri === 'td:ValeriyBushenev');
    await Backend.logout(ticket1.ticket);
    assert(false === await Backend.is_ticket_valid(ticket1.ticket));
  });
};
