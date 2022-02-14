export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#001 Authenticate user`, async () => {
    const ticket = await Backend.authenticate('bushenevvt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    assert(ticket.ticket.length > 0 && ticket.end_time > Date.now());
  });
};
