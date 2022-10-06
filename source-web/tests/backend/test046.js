import UpdateService from '../../js/browser/update_service.js';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test.skip('#046 ccus', async () => {
    const updateService = new UpdateService();
    await updateService.start();

    const ticket_user1 = (await Helpers.get_user1_ticket()).ticket;

    const new_test_doc1_uri = 'test3:' + Util.guid();
    const new_test_doc1 = {
      '@': new_test_doc1_uri,
      'rdf:type': Util.newUri('rdfs:Resource'),
      'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'v-s:created': Util.newDate(new Date()),
      'v-s:test_field': Util.newStr('test data', 'EN'),
    };

    let testUpdateCounter;
    updateService.subscribe(new_test_doc1_uri, 0, (updateCounter) => {
      testUpdateCounter = updateCounter;
    });

    await Backend.put_individual(ticket_user1, new_test_doc1);
    await timeout(1500);
    assert(testUpdateCounter === 1);

    await Backend.put_individual(ticket_user1, new_test_doc1);
    await timeout(1500);
    assert(testUpdateCounter === 2);

    updateService.unsubscribe(new_test_doc1_uri);
    updateService.stop();

    await Backend.remove_individual(ticket_user1, new_test_doc1_uri);
    await assert.rejects(Backend.get_individual(ticket_user1, new_test_doc1_uri));
  });
};
