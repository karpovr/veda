import Basic from './basic';
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test DropDown`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  test('testDropDown', async t => {
    basic.login('karpovrt', '123');
    await t
      .click('#menu')
      .click('li[id="menu"] li[resource="v-s:Create"]')
      .click('veda-control.fulltext.dropdown')
      .typeText('veda-control.fulltext.dropdown', 'Класс для тестирования интерфейса')
      .click('.suggestion[resource="v-ui:TestUIClass"]')
      .click('veda-control[rel="v-s:hasTransportKind"] .dropdown')
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .select-all')
      .expect(Selector('veda-control[rel="v-s:hasTransportKind"] .suggestions .suggestion.selected').count).eql(3)
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .cancel-selection')
      .expect(Selector('veda-control[rel="v-s:hasTransportKind"] .suggestions .suggestion.selected').count).eql(0)
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .invert-selection')
      .expect(Selector('veda-control[rel="v-s:hasTransportKind"] .suggestions .suggestion.selected').count).eql(3)
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .suggestions .suggestion[resource="d:62fbbbc27f8e407c8f51de71e10d0501"]')
      .expect(Selector('veda-control[rel="v-s:hasTransportKind"] .suggestions .suggestion.selected').count).eql(2)
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .invert-selection')
      .expect(Selector('veda-control[rel="v-s:hasTransportKind"] .suggestions .suggestion.selected').count).eql(1)
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .cancel-selection')
      .expect(Selector('veda-control[rel="v-s:hasTransportKind"] .suggestions .suggestion.selected').count).eql(0)
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .suggestions .suggestion[resource="d:2078749d2bcf42e0ae80c5d8287d19d1"]')
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .close-menu')
      .expect(Selector('div[rel="v-s:hasTransportKind"] span#label').innerText).eql('Авиатранспорт')
      .click('veda-control[rel="v-s:hasTransportKind"] .dropdown')
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .cancel-selection')
      .wait(1000)
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .suggestions .suggestion[resource="d:177b4624ed3f4ce6a1c89d7a3bd4f1c1"]')
      .click('veda-control#label')
      .expect(Selector('div[rel="v-s:hasTransportKind"] span#label').innerText).eql('Железнодорожный транспорт')
      .click('veda-control[rel="v-s:hasTransportKind"] .dropdown')
      .click('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .cancel-selection')
      .wait(1000)
      .doubleClick('veda-control[rel="v-s:hasTransportKind"] .fulltext-menu .suggestions .suggestion[resource="d:62fbbbc27f8e407c8f51de71e10d0501"]')
      .expect(Selector('div[rel="v-s:hasTransportKind"] span#label').innerText).eql('Автобус')
      .click('veda-control[rel="v-s:hasTransportKindSingle"] .dropdown')
      .click('veda-control[rel="v-s:hasTransportKindSingle"] .fulltext-menu .suggestions .suggestion[resource="d:2078749d2bcf42e0ae80c5d8287d19d1"]')
      .expect(Selector('div[rel="v-s:hasTransportKindSingle"] span#label').innerText).eql('Авиатранспорт')
      //здесь проверяется закрылся ли div после выбора значения для единичного поля
      .expect(Selector('veda-control[rel="v-s:hasTransportKindSingle"] .fulltext-menu').visible).notOk();
});
