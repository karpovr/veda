import Basic from './basic';
import config from './config';
import {Selector} from 'testcafe';
fixture `test Journal`
  .page `${config.baseUrl}`;
const basic = new Basic();
test('testJournal', async (t) => {
  basic.login('karpovrt', '123');
  const documentCreated = Selector('div#records').find('div.journal-record[typeof="v-s:DocumentCreated"]').count;
  const documentUpdated = Selector('div#records').find('div.journal-record[typeof="v-s:DocumentUpdated"]').count;
  const journal = Selector('div#records').find('div.journal-record').count;
  const timeStamp = ''+Math.round(+new Date()/1000);
  await t
    .click('#menu')
    .click('li[id="menu"] li[resource="v-s:Create"]')
    .typeText('veda-control.fulltext.dropdown', 'Мероприятие')
    .click('.suggestion[resource="v-s:Action"]')
    .typeText('veda-control[property="rdfs:label"] input.form-control[lang="RU"]', timeStamp)
    .typeText('veda-control[rel="v-s:responsible"] textarea[name="v_s_action_v_s_responsible"]', 'Администратор2')
    .wait(5000)
    .click('.suggestions .suggestion[resource="td:RomanKarpov-Analyst1"]')
    .typeText('veda-control[property="v-s:shortLabel"] textarea.form-control[lang="RU"]', 'shortLabel')
    .click('button#save')
    .wait(5000)
    .click('button#journal')
    // Проверяем количество записей в журнале
    .wait(1000)
    .click('li[role="presentation"] span[about="v-ui:JournalTemplate"]')
    .wait(5000)
    .expect(documentCreated).eql(1)
    .expect(journal).eql(1)
    // Изменяем shortLabel -> Проверяем количество записей в журнале
    .click('div.pull-left span[about="v-s:Action"]')
    .click('button#edit')
    .typeText('veda-control[property="v-s:shortLabel"] textarea.form-control[lang="RU"]', '123')
    .click('button#save')
    .click('button#journal')
    .wait(1000)
    .click('li[role="presentation"] span[about="v-ui:JournalTemplate"]')
    .wait(5000)
    .expect(documentUpdated).eql(1)
    .expect(journal).eql(2)
    // Не изменяем shortlabel -> Проверяем количество записей в журнале
    .click('div.pull-left span[about="v-s:Action"]')
    .click('button#edit')
    .click('button#save')
    .click('button#journal')
    .wait(1000)
    .click('li[role="presentation"] span[about="v-ui:JournalTemplate"]')
    .wait(5000)
    .expect(documentUpdated).eql(2)
    .expect(journal).eql(3)
    // Изменяем shortLabel -> Проверяем количество записей в журнале
    .click('div.pull-left span[about="v-s:Action"]')
    .click('button#edit')
    .typeText('veda-control[property="v-s:shortLabel"] textarea.form-control[lang="RU"]', '321')
    .click('button#save')
    .click('button#journal')
    .wait(1000)
    .click('li[role="presentation"] span[about="v-ui:JournalTemplate"]')
    .wait(5000)
    .expect(documentUpdated).eql(3)
    .expect(journal).eql(4);
});
