import Basic from './basic';
import config from './config';
fixture `test Creating Net Interface`
  .page `${config.baseUrl}`;
const basic = new Basic();
test('testCreatingNetInterface', async (t) => {
  basic.login('karpovrt', '123');
  await t
    .setNativeDialogHandler(() => true)
    .click('#menu')
    .click('li[id="menu"] li[resource="v-s:Create"]')
    .typeText('veda-control.fulltext.dropdown', 'Сеть')
    .click('.suggestion[resource="v-wf:Net"]')
    .wait(3000)
    .click('.create-task')
    .click('.state-task')
    .click('.copy-net-element')
    .click('.delete-state')
    .click('.zoom-in')
    .click('.zoom-out')
    .click('.zoom-default')
    .click('#full-width');
});
