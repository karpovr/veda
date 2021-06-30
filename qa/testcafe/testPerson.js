import Basic from './basic';
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test Person`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  const pageForNavigateFromConfig = `${config.baseUrl}#/v-ui:TestUIRegistry`;
  test('testPerson', async t => {
    basic.login('karpovrt', '123');
    const timeStamp = Math.round(Date.now() / 1000).toString();
    basic.createTestUI('Вася Пупкин', timeStamp);
    await t
      .expect(Selector('#user-info').innerText).contains('Администратор2 .')
      .navigateTo( pageForNavigateFromConfig )
      .wait(2000)
      .typeText('veda-control#comment', timeStamp)
      .click('button#search-button')
      .expect(Selector('.stats-top span[property="v-fs:authorized"]').innerText).eql('1')
});
