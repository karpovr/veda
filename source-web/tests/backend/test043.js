export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#043 Re-authenticate user`, async () => {
    const ticket1 = await Backend.authenticate('bushenevvt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    assert(ticket1.ticket.length > 0 && ticket1.end_time > Date.now() && ticket1.user_uri === 'td:ValeriyBushenev');
    await Helpers.timeout(5000);
    const ticket2 = await Backend.get_ticket_trusted(ticket1.ticket);
    assert(ticket2.ticket.length > 0 && ticket2.end_time > Date.now() && ticket2.end_time > ticket1.end_time && ticket2.user_uri === ticket1.user_uri);
  });
};
