import Basic from './basic'
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test Drafts`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  test('testDrafts', async t => {
    basic.login('karpovrt', '123');
    await t
      .click('#menu')
      .click('li[id="menu"] li[resource="v-s:Create"]')
      .typeText('veda-control.fulltext.dropdown', 'Входящее письмо')
      .click('.suggestion[resource="v-s:IncomingLetter"]')
      .typeText('div[rel="v-s:sender"] veda-control[rel="v-s:correspondentOrganization"]', 'Веда')
      .click('.suggestion[resource="cfg:org_Veda"]')
      .typeText('div[rel="v-s:recipient"] veda-control[rel="v-s:correspondentOrganization"]', 'Веда')
      .click('div[rel="v-s:recipient"] .suggestion[resource="cfg:org_Veda"]')
      .click('div.navbar-header')
      .expect(Selector('li[about="v-s:Drafts"] span.label.label-default').innerText).eql('5')
      .click('li[about="v-s:Drafts"]')
      .click('ol#drafts-list span[typeof="v-s:IncomingLetter"]')
      .click('button#save')
      .wait(2000)
      .click('div.navbar-header')
      .expect(Selector('li[about="v-s:Drafts"] span.label.label-default').innerText).eql('0')
});
