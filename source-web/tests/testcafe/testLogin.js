import Basic from './basic';
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test Login`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  test('testLogin', async t => {
    basic.login('karpovrt', '123');
    basic.logout();
  });


