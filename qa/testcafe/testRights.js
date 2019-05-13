import Basic from './basic';
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test Rights`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  test('testRights', async t => {
    basic.login('karpovrt', '123');
    const timeEdwin = ''+Math.round(+new Date()/1000);
    const timeFillips = ''+Math.round(+new Date()/100);
    basic.createTestUiForAttributiveSearch('Кинг', 'Стивен', timeEdwin, '21.09.1947');
    basic.logout();
    basic.login('bychinat', '123');
    await t
      .wait(5000);
    basic.fullTextSearch(timeEdwin, '0');
    basic.createTestUiForAttributiveSearch('Лавкрафт', 'Говард', timeFillips, '20.08.1890');
    basic.logout();
    basic.login('karpovrt', '123');
    await t
      .wait(5000);
    basic.fullTextSearch(timeFillips, '1');
    await t
      .expect(Selector('ul.nav.navbar-nav.navbar-right li#user-info').innerText).contains('Администратор2 .');
  });
