import Basic from './basic'
import config from './config';
import { Selector } from 'testcafe';

fixture `testAttachment`
    .page `${config.baseUrl}#/v-fc:CreateByType`;

test('testAttachment', async t => {
    //basic.login('karpovrt', '123');
    //basic.openCreateDocumentForm('Мероприятие');
        const {
  ClientFunction,
} = require('testcafe')

        const setCookie = ClientFunction(() => {
                document.cookie = 'ticket=a6ad7aa9-b2c5-4867-bfad-9b7c0351399a'
        })
    await t
        setCookie()
        .typeText('#login', 'karpovrt')
        .typeText('#password', '123')
        .click('#submit')
        //.click('#menu')
        //.click('li[id="menu"] li[resource="v-s:Find"]')
        //.typeText('veda-control[property="v-fs:fulltextQuery"] input.form-control', 'Персона')
        //.click('span.input-group-btn button#submit')
        //.click('p[resource="cfg:Guest"] a[about="cfg:Guest"]')
        //.click('div.text-right span.glyphicon.glyphicon-link')
        //.click('button#export-ttl.btn.btn-primary')
        //.click('#menu')
        //.click('li[id="menu"] li[resource="v-s:Create"]')
        //.typeText('input.fulltext.tt-input', 'Отчет')
        //.click('veda-control.fulltext div.tt-suggestion[about="v-s:Report"]>p')

        //следующие 2 строчки работают с обновлённым контролом
        .typeText('veda-control.fulltext.dropdown', 'Отчет')
        .click('.suggestion[about="v-s:Report"]')
        .typeText('input.form-control[lang="RU"]', 'Мероприятие')
        //.click('button.btn.btn-link.view.edit.-search.toggle-actions')
        //.click('veda-control[rel="v-s:attachment"]')
        .setFilesToUpload('veda-control[rel="v-s:attachment"] input[type="file"]', [
            './road.jpg',
            './exported_graph.ttl'
        ])
        .wait(480000)
        //.click('#save')
        //.click('veda-control[rel="v-s:attachment"]');

        //.typeText('input.form-control[lang="RU"]', 'Мероприятие')
        //.typeText('input[name="v_s_action_v_s_responsible"]', 'Администратор2')
        //.click('veda-control.fulltext div.tt-suggestion>p')
        //.click('#save')

        //.wait(2000)

});
