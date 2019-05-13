import Basic from './basic';
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test language`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  test('testLanguage', async t => {
    basic.login('karpovrt', '123');
    await t
      //EN
      .click('button[about="v-ui:EN"]')
      .click('button[about="v-ui:RU"]')
      .expect(Selector('#user-info').innerText).contains('Administrator2 .')
      //RU
      .click('button[about="v-ui:RU"]')
      .click('button[about="v-ui:EN"]')
      .expect(Selector('#user-info').innerText).contains('Администратор2 .');
  });


