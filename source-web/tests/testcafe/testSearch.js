import Basic from './basic';
import config from './config';
import {Selector} from 'testcafe';
fixture `test search`
  .page `${config.baseUrl}`;
const basic = new Basic();
const pageForNavigateFromConfig = `${config.baseUrl}`+'#/v-ui:TestUIRegistry';
test('testSearch', async (t) => {
  basic.login('karpovrt', '123');
  await t
    .expect(Selector('#user-info').innerText).contains('Администратор2 .')
    .navigateTo( pageForNavigateFromConfig )
    .click('button#search-button');
  const search = Selector('div.results div.search-result.table-responsive.noSwipe tbody.result-container tr[typeof="v-ui:TestUIClass"]');
  const count = await search.count;
  await t
    .expect(Selector('.stats-top span[property="v-fs:authorized"]').innerText).eql(''+count);
});
