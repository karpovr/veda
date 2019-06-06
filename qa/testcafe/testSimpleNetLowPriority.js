import Basic from './basic'
import { Selector, t } from 'testcafe';
  fixture `test Simple Net Low Priority`
    .page `http://localhost:8080/`;
  const basic = new Basic();
  test('testSimpleNetLowPriority', async t => {
    basic.login('karpovrt', '123');
    const timeStamp = ''+Math.round(+new Date()/1000);
    const red = Selector('div#workflow-canvas').find('div.state-io-condition-output[colored-to="red"]').count;
    await t
      .click('#menu')
      .click('li[id="menu"] li[resource="v-s:Create"]')
      .typeText('veda-control.fulltext.dropdown', 'Сеть')
      .click('div.suggestion[resource="v-wf:Net"]')
      .click('div#schema')
      .click('div#object-container div#props-col div#props table#taskTemplateProperties tbody tr td span[about="rdfs:label"]')
      .typeText('div#object-container div#props-col div#props table#taskTemplateProperties tbody tr td veda-control#VClabel input.form-control', timeStamp)
      .dragToElement('.state-io-condition-input .ep', '.glyphicon-stop')
      .click('button#workflow-save-button')
      .click('li[about="v-fs:FulltextSearch"]')
      .typeText('veda-control[property="*"] input.form-control', 'Тестовый шаблон маршурута lowPriority')
      .click('small[about="v-fs:AdvancedSearchBundle"]')
      .click('span[about="v-s:UserThing"] button.btn.btn-default.button-delete')
      .click('div.input-group span.input-group-btn #custom-search-button.search-button')
      .wait(5000)
      .click('div.results a.glyphicon.glyphicon-search')
      .wait(2000)
      .click('button#edit')
      .click('veda-control[rel="v-wf:forNet"] .form-control')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[rel="v-wf:forNet"] .form-control', timeStamp)
      .click(Selector('div.suggestions div.suggestion').withText(timeStamp))
      .click('veda-control[rel="v-wf:hasStatusWorkflow"] .form-control')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[rel="v-wf:hasStatusWorkflow"] .form-control', 'Ожидает отправки')
      .wait(2000)
      .click('div.suggestion[resource="v-wf:ToBeSent"]')
      .click('button#save')
      .wait(2000)
      .click('button.btn.btn-link.view.edit.-search.toggle-actions')
      .click('div[rel="v-wf:isProcess"] span#label')
      .expect(red).eql(1)
});
