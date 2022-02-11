export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it(`#021 User1 stores 3 individuals, user1 should read individuals using get_individuals`, async () => {
    const ticket = await Helpers.get_user1_ticket();

    const A = await Helpers.create_test_document1(ticket);
    const B = await Helpers.create_test_document1(ticket);
    const C = await Helpers.create_test_document1(ticket);

    const new_idividuals = [A, B, C];

    const res = await Backend.get_individuals(ticket.ticket, [A['@'], B['@'], C['@']]);
    assert(res.length == 3);

    for (let idx = 0; idx < 3; idx++) {
      for (let idx2 = 0; idx2 < 3; idx2++) {
        if (res[idx]['@'] == new_idividuals[idx2]['@']) {
          assert(Helpers.compare(res[idx], new_idividuals[idx2]));
        }
      }
    }

    await Backend.remove_individual(ticket.ticket, A['@']);
    await Helpers.test_fail_read(ticket, A);

    await Backend.remove_individual(ticket.ticket, B['@']);
    await Helpers.test_fail_read(ticket, B);

    await Backend.remove_individual(ticket.ticket, C['@']);
    await Helpers.test_fail_read(ticket, C);
  });
};
