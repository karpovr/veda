export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test(`#032 Bad requests`, async () => {
    let ticket = await Helpers.get_user1_ticket();

    await Backend.query();
    await Backend.query(ticket.ticket);

    await Backend.query(ticket.ticket, {});
    await Backend.query(ticket.ticket, 1);
    await Backend.query(ticket.ticket, '1');
    await Backend.query(ticket.ticket, false);
    await Backend.query(ticket.ticket, []);
    await Backend.query(ticket, [{}]);

    await assert.rejects(Backend.put_individual(), {code: 400});
    await assert.rejects(Backend.put_individual(ticket.ticket), {code: 400});
    await assert.rejects(Backend.put_individual(ticket.ticket, {}), {code: 904});
    await assert.rejects(Backend.put_individual(ticket.ticket, 1), {code: 400});
    await assert.rejects(Backend.put_individual(ticket.ticket, '1'), {code: 400});
    await assert.rejects(Backend.put_individual(ticket.ticket, false), {code: 400});
    await assert.rejects(Backend.put_individual(ticket.ticket, []), {code: 400});
    await assert.rejects(Backend.put_individual(ticket.ticket, [{}]), {code: 400});

    await assert.rejects(Backend.put_individuals(), {code: 400});
    await assert.rejects(Backend.put_individuals(ticket.ticket), {code: 400});

    // THESE SHOULD FAIL!
    await Backend.put_individuals(ticket.ticket, {});
    await Backend.put_individuals(ticket.ticket, 1);
    await Backend.put_individuals(ticket.ticket, '1');
    await Backend.put_individuals(ticket.ticket, false);
    await Backend.put_individuals(ticket.ticket, []);
    await Backend.put_individuals(ticket.ticket, [{}]);
    //* await assert.rejects(Backend.put_individuals(ticket.ticket, {}), {code: 400});
    //* await assert.rejects(Backend.put_individuals(ticket.ticket, 1), {code: 400});
    //* await assert.rejects(Backend.put_individuals(ticket.ticket, '1'), {code: 400});
    //* await assert.rejects(Backend.put_individuals(ticket.ticket, false), {code: 400});
    //* await assert.rejects(Backend.put_individuals(ticket.ticket, []), {code: 400});
    //* await assert.rejects(Backend.put_individuals(ticket.ticket, [{}]), {code: 904});

    await assert.rejects(Backend.set_in_individual(), {code: 400});
    await assert.rejects(Backend.set_in_individual(ticket.ticket), {code: 400});
    await assert.rejects(Backend.set_in_individual(ticket.ticket, {}), {code: 904});
    await assert.rejects(Backend.set_in_individual(ticket.ticket, 1), {code: 400});
    await assert.rejects(Backend.set_in_individual(ticket.ticket, '1'), {code: 400});
    await assert.rejects(Backend.set_in_individual(ticket.ticket, false), {code: 400});
    await assert.rejects(Backend.set_in_individual(ticket, []), {code: 400});
    await assert.rejects(Backend.set_in_individual(ticket.ticket, [{}]), {code: 400});

    await assert.rejects(Backend.add_to_individual(), {code: 400});
    await assert.rejects(Backend.add_to_individual(ticket.ticket), {code: 400});
    await assert.rejects(Backend.add_to_individual(ticket.ticket, {}), {code: 904});
    await assert.rejects(Backend.add_to_individual(ticket.ticket, 1), {code: 400});
    await assert.rejects(Backend.add_to_individual(ticket.ticket, '1'), {code: 400});
    await assert.rejects(Backend.add_to_individual(ticket.ticket, false), {code: 400});
    await assert.rejects(Backend.add_to_individual(ticket, []), {code: 400});
    await assert.rejects(Backend.add_to_individual(ticket.ticket, [{}]), {code: 400});

    await assert.rejects(Backend.remove_from_individual(), {code: 400});
    await assert.rejects(Backend.remove_from_individual(ticket.ticket), {code: 400});
    await assert.rejects(Backend.remove_from_individual(ticket.ticket, {}), {code: 904});
    await assert.rejects(Backend.remove_from_individual(ticket.ticket, 1), {code: 400});
    await assert.rejects(Backend.remove_from_individual(ticket.ticket, '1'), {code: 400});
    await assert.rejects(Backend.remove_from_individual(ticket.ticket, false), {code: 400});
    await assert.rejects(Backend.remove_from_individual(ticket, []), {code: 400});
    await assert.rejects(Backend.remove_from_individual(ticket.ticket, [{}]), {code: 400});
  });
};
