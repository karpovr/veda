export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#022 Search with invalid query`, async () => {
    const ticket = await Helpers.get_user1_ticket();

    const A = await Helpers.create_test_document1(ticket);

    const params_q1 = {
      ticket: ticket.ticket,
      query: "(('rdf:type' == 'v-s:Department')) && ('*' == '.;u*')",
      sort: '',
      top: 3,
      from: 0,
    };

    const res = await Backend.query(params_q1);
    assert(res.result.length === 0);

    await Backend.remove_individual(ticket.ticket, A['@']);
    await Helpers.test_fail_read(ticket, A);
  });
};
