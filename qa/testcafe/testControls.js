import Basic from './basic';
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test div controls`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  const checkBox = Selector('veda-control[data-type="checkbox"] div.checkbox').find('label').withText('Спецификация тестового объектного свойства');
  const radioButton = Selector('veda-control[data-type="radio"] div.radio').find('label').withText('Спецификация тестового календарного свойства');
  test('testDivControls', async t => {
    basic.login('karpovrt', '123');
    await t
      .click('#menu')
      .click('li[id="menu"] li[resource="v-s:Create"]')
      .click('veda-control.fulltext.dropdown')
      .pressKey('ctrl+a delete')
      .typeText('veda-control.fulltext.dropdown', 'Класс для тестирования интерфейса')
      .click('div.suggestion[resource="v-ui:TestUIClass"]')
      .click('div.actions.actions-fixed button[type="button"] span.glyphicon.glyphicon-chevron-left')
      .typeText('veda-control.-view.edit.search[property="rdfs:label"]', 'Тест контролов')
      .wait(1000)
      .expect(Selector('div.container.sheet h3[property="rdfs:label"] span.value-holder').innerText).eql('Тест контролов')
      .typeText('veda-control#testString', 'Тестовое текстовое свойство')
      .wait(1000)
      .expect(Selector('div.container.sheet div[property="v-ui:testString"] span.value-holder').innerText).eql('Тестовое текстовое свойство')
      .typeText('veda-control[property="v-ui:testInteger"]', 'Hello Integer')
      .wait(1000)
      .expect(Selector('div.container.sheet div[property="v-ui:testInteger"]').innerText).eql('')
      .click('veda-control[property="v-ui:testInteger"]')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[property="v-ui:testInteger"]', '777')
      .wait(1000)
      .expect(Selector('div.container.sheet div[property="v-ui:testInteger"] span.value-holder').innerText).eql('777')
      .typeText('veda-control[property="v-ui:testDecimal"]', 'Hello Decimal')
      .wait(1000)
      .expect(Selector('div.container.sheet div[property="v-ui:testDecimal"]').innerText).eql('')
      .click('veda-control[property="v-ui:testDecimal"]')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[property="v-ui:testDecimal"]', '3,14159265')
      .wait(1000)
      .expect(Selector('div.container.sheet div[property="v-ui:testDecimal"] span.value-holder').innerText).eql('3.14 159 265')
      .click('veda-control#date')
      .pressKey('ctrl+a delete')
      .typeText('veda-control#date', '29051990')
      .click('veda-control[property="v-ui:testDecimal"]')
      .wait(1000)
      .expect(Selector('div.container.sheet div[property="v-ui:testDatetime"] span.value-holder').innerText).eql('29.05.1990')
      .click('veda-control[data-type="dateTime"]')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[data-type="dateTime"]', '280519891232')
      .click('veda-control[property="v-ui:testDecimal"]')
      .wait(1000)
      .expect(Selector('div.container.sheet div[property="v-ui:testDatetime"] span.value-holder').innerText).eql('28.05.1989 12:32')
      .click(checkBox)
      .wait(1000)
      .expect(Selector('div.container.sheet div[rel="v-ui:testLink"] span#label').innerText).eql('Спецификация тестового объектного свойства')
      .click(radioButton)
      .wait(1000)
      .expect(Selector('div.container.sheet div[rel="v-ui:testLink"] span#label').innerText).eql('Спецификация тестового календарного свойства');
});
