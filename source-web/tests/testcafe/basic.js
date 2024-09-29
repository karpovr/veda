import {Selector, t} from 'testcafe';

export default class Basic {
  async login (login, password) {
    await t
      .click('#login')
      .pressKey('ctrl+a delete')
      .typeText('#login', login)
      .click('#password')
      .pressKey('ctrl+a delete')
      .typeText('#password', password)
      .click('#submit-login-password')
      .wait(1000);
  }

  async logout () {
    await t
      .click('#logout');
  }

  async createPerson (last, first, middle, birthDate) {
    await t
      .click('#menu')
      .click('li[id="menu"] li[resource="v-s:Create"]')
      .click('veda-control.fulltext.dropdown')
      .pressKey('ctrl+a delete')
      .typeText('veda-control.fulltext.dropdown', 'Персона')
      .click('.suggestion[resource="v-s:Person"]')
      .typeText('veda-control.-view.edit.search[property="v-s:lastName"]', last)
      .typeText('veda-control.-view.edit.search.has-error[property="v-s:firstName"]', first)
      .typeText('veda-control.-view.edit.search[property="v-s:middleName"]', middle)
      .click('div.input-group.date input.form-control[name="v_s_person_v_s_birthday"]')
      .pressKey('ctrl+a delete')
      .typeText('div.input-group.date input.form-control[name="v_s_person_v_s_birthday"]', birthDate)
      .click('span[data-template="v-ui:StandardButtonsTemplate"] span[typeof="v-s:Person"] button#save')
      .wait(1000);
  }

  async fullTextSearch (query, eql) {
    await t
      .click('ul.nav.navbar-nav.navbar-right li[about="v-fs:MultiFunctionalSearch"]')
      .click('veda-control[property="*"] input[type="text"]')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[property="*"] input[type="text"]', query)
      .click('span.input-group-btn button[about="v-fs:Find"]')
      .expect(Selector('small.stats-top.pull-right span.badge[property="v-fs:authorized"]').innerText).eql(eql);
  }

  async createTestUI (label, timeStamp) {
    const number = Selector('veda-control[property="v-ui:testInteger"] select.form-control').find('option').withText('2');
    const checkbox = Selector('veda-control[rel="v-ui:testLink"] div.checkbox').find('label').withText('Спецификация тестового объектного свойства');
    await t
      .click('#menu')
      .click('li[id="menu"] li[resource="v-s:Create"]')
      .click('veda-control.fulltext.dropdown')
      .pressKey('ctrl+a delete')
      .typeText('veda-control.fulltext.dropdown', 'Класс для тестирования интерфейса')
      .click('.suggestion[resource="v-ui:TestUIClass"]')
      .typeText('veda-control[property="rdfs:label"]', label)
      .wait(1000)
      .typeText('veda-control[property="rdfs:comment"]', timeStamp)
      .wait(1000)
      .typeText('veda-control[property="v-ui:testString"]', 'Предопределенное значение 1')
      .wait(1000)
      .click('veda-control[data-type="select"][property="v-ui:testInteger"]')
      .click(number)
      .wait(1000)
      .click(checkbox)
      .wait(1000)
      .click('button#save')
      .wait(1000);
  }

async createTestUiForAttributiveSearch(label, comment, testString, date) {
  const menuButton = Selector('#menu');
  const createMenuItem = Selector('li[id="menu"] li[resource="v-s:Create"]');
  const number = Selector('veda-control[property="v-ui:testInteger"] select.form-control').find('option').withText('2');
  const checkbox = Selector('veda-control[rel="v-ui:testLink"] div.checkbox').find('label').withText('Спецификация тестового объектного свойства');

  try {
    await t
      .click(menuButton)
      .expect(createMenuItem.visible).ok({ timeout: 5000 })
      .click(createMenuItem)
      .expect(Selector('veda-control.fulltext.dropdown').visible).ok({ timeout: 5000 })
      .click('veda-control.fulltext.dropdown')
      .pressKey('ctrl+a delete')
      .typeText('veda-control.fulltext.dropdown', 'Класс для тестирования интерфейса')
      .expect(Selector('.suggestion[resource="v-ui:TestUIClass"]').visible).ok({ timeout: 5000 })
      .click('.suggestion[resource="v-ui:TestUIClass"]')
      .typeText('veda-control.-view.edit.search[property="rdfs:label"]', label)
      .wait(1000)
      .typeText('veda-control.-view.edit.search[property="rdfs:comment"]', comment)
      .wait(1000)
      .typeText('veda-control[property="v-ui:testString"]', testString)
      .wait(1000)
      .click('veda-control[data-type="select"][property="v-ui:testInteger"]')
      .click(number)
      .click(checkbox)
      .click('veda-control#date')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[property="v-ui:testDatetime"]#date', date)
      .click('button#save')
      .wait(1000);

    // Log success
    console.log('Test UI for attributive search created successfully');
  } catch (error) {
    console.error('Error in createTestUiForAttributiveSearch:', error);
    
    // Take a screenshot on error
    await t.takeScreenshot('error-createTestUiForAttributiveSearch.png');
    
    // Re-throw the error to fail the test
    throw error;
  }
}
}
