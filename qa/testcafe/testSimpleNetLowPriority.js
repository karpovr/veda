import Basic from './basic'
import config from './config';
import { Selector, t } from 'testcafe';
  fixture `test Simple Net Low Priority`
    .page `${config.baseUrl}`;
  const basic = new Basic();
  test('testSimpleNetLowPriority', async t => {
    basic.login('karpovrt', '123');
    const timeStamp = ''+Math.round(+new Date()/1000);
    const red = Selector('div#workflow-canvas').find('div.state-io-condition-output[colored-to="red"]').count;
    await t
      .click('#menu')
      .click('li[id="menu"] li[resource="v-s:Create"]')
      .typeText('veda-control.fulltext.dropdown', 'Сеть')
      .click('.suggestion[resource="v-wf:Net"]')
      .click('div#schema')
      .click('div#object-container div#props-col div#props table#taskTemplateProperties tbody tr td span[about="rdfs:label"]')
      .typeText('div#object-container div#props-col div#props table#taskTemplateProperties tbody tr td veda-control#VClabel input.form-control', timeStamp)
      .dragToElement('.state-io-condition-input .ep', '.glyphicon-stop')
      .click('button#workflow-save-button')
      .wait(3000)
      .click('li[about="v-fs:MultiFunctionalSearch"]')
      .typeText('veda-control[property="*"] input.form-control', "'rdf:type'=='v-wf:StartForm' && 'rdfs:label'=='Тестовый шаблон маршрута lowPriority'")
      .click('div.input-group span.input-group-btn #custom-search-button.search-button')
      .wait(3000)
      .click('div.results a.glyphicon.glyphicon-search')
      .click('button#edit')
      .click('veda-control[rel="v-wf:forNet"] .form-control')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[rel="v-wf:forNet"] .form-control', timeStamp)
      .click(Selector('.suggestions .suggestion').withText(timeStamp))
      .click('veda-control[rel="v-wf:hasStatusWorkflow"] .form-control')
      .pressKey('ctrl+a delete')
      .typeText('veda-control[rel="v-wf:hasStatusWorkflow"] .form-control', 'Ожидает отправки')
      .click('.suggestion[resource="v-wf:ToBeSent"]')
      .click('button#save')
      .wait(3000)
      .click('div[rel="v-wf:isProcess"] a')
      .expect(red).eql(1)
});
