import Basic from './basic';
import config from './config';
import { Selector } from 'testcafe';

fixture `test Rights`
  .page `${config.baseUrl}`;

const basic = new Basic();

test.only('testRights', async (t) => {
  console.log('Шаг 1: Логинимся под karpovrt');
  basic.login('karpovrt', '123');

  await t.wait(1000);
  
  const timeEdwin = '' + Math.round(+new Date() / 1000);
  const timeFillips = '' + Math.round(+new Date() / 100);

  console.log(`Шаг 2: Создаём тест для атрибутивного поиска (Кинг, Стивен, timeEdwin: ${timeEdwin})`);
  basic.createTestUiForAttributiveSearch('Кинг', 'Стивен', timeEdwin, '21.09.1947');
  
  await t.click('.navbar-brand');
  
  console.log('Шаг 3: Логаутим пользователя karpovrt');
  basic.logout();
  
  console.log('Шаг 4: Логинимся под bychinat');
  basic.login('bychinat', '123');
  
  await t.wait(1000);
  
  console.log(`Шаг 5: Поиск по полному тексту (timeEdwin: ${timeEdwin})`);
  basic.fullTextSearch(timeEdwin, '0');
  
  console.log(`Шаг 6: Создаём тест для атрибутивного поиска (Лавкрафт, Говард, timeFillips: ${timeFillips})`);
  basic.createTestUiForAttributiveSearch('Лавкрафт', 'Говард', timeFillips, '20.08.1890');
  
  await t.click('.navbar-brand');
  
  console.log('Шаг 7: Логаутим пользователя bychinat');
  basic.logout();
  
  console.log('Шаг 8: Логинимся под karpovrt');
  basic.login('karpovrt', '123');
  
  await t.wait(1000);
  
  console.log(`Шаг 9: Поиск по полному тексту (timeFillips: ${timeFillips})`);
  basic.fullTextSearch(timeFillips, '1');
  
  console.log('Шаг 10: Проверяем, что пользователь имеет роль "Администратор2"');
  await t
    .expect(Selector('ul.nav.navbar-nav.navbar-right li#user-info').innerText)
    .contains('Администратор2 .');
  
  console.log('Тест завершён');
});
