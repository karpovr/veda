import Basic from './basic';
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test Search Range Of Dates`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  test('testSearchRangeOfDates', async t => {
    basic.login('karpovrt', '123');
    basic.createTestUiForAttributiveSearch('Range', 'Of', 'DatesO', '01.01.2014');
    basic.createTestUiForAttributiveSearch('Range', 'Of', 'DatesO', '02.12.2015');
    basic.createTestUiForAttributiveSearch('Range', 'Of', 'DatesO', '12.07.2016');
    basic.createTestUiForAttributiveSearch('Range', 'Of', 'DatesO', '12.07.2017');
    basic.fullTextSearch('\'v-ui:testDatetime\' == [2014-01-01T00:00:00, 2014-01-01T23:59:59] && \'v-ui:testString\' == \'DatesO\'', '1');
    basic.fullTextSearch('\'v-ui:testDatetime\' == [2014-01-01T00:00:00, 2015-12-02T23:59:59] && \'v-ui:testString\' == \'DatesO\'', '2');
    basic.fullTextSearch('\'v-ui:testDatetime\' == [2014-01-01T00:00:00, 2016-07-12T23:59:59] && \'v-ui:testString\' == \'DatesO\'', '3');
    basic.fullTextSearch('\'v-ui:testDatetime\' == [2014-01-01T00:00:00, 2034-07-12T23:59:59] && \'v-ui:testString\' == \'DatesO\'', '4');
    await t
      .expect(Selector('ul.nav.navbar-nav.navbar-right li#user-info').innerText).contains('Администратор2 .');
});


