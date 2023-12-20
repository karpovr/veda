import $ from 'jquery';
import Crypto from '/js/browser/crypto.js';

export const pre = async function (individual, template, container, mode, extra) {
  const $template = $(template);
  const $container = $(container);

  const fn = individual['v-s:fileName'][0];
  const img = 'jpg|jpeg|gif|png|bmp|svg';
  if (typeof fn === 'string' || fn instanceof String) {
    const idx = fn.lastIndexOf('.');
    const ext = fn.substr(idx + 1);
    if (img.indexOf(ext.toLowerCase()) < 0) {
      $('.thumbnail', $template).remove();
      $('.filename', $template).css('width', '100%');
    }
  }
};

export const post = async function (individual, template, container, mode, extra) {
  const $template = $(template);
  const $container = $(container);

  individual.on('v-s:digitalSignature', showSignature);
  $template.one('remove', () => individual.off('v-s:digitalSignature', showSignature));
  showSignature();

  async function showSignature () {
    if (!individual.hasValue('v-s:digitalSignature')) {
      $('.signatures', $template).addClass('hidden');
      $('.verify-signature', $template).addClass('hidden');
    } else {
      $('.signatures', $template).removeClass('hidden');
      $('.verify-signature', $template).removeClass('hidden');
      for (let i=0; individual['v-s:digitalSignature'].length; i++) {
        const signFile = await individual['v-s:digitalSignature'][i].load();
        if (signFile.hasValue('v-s:creator',veda.appointment.id)) {
          $('.add-signature', $template).addClass('hidden');
          break;
        }
      }
    }
  }

  setTimeout(async () => {
    const crypto = Crypto.getInstance();
    try {
      await crypto.init();
      // await crypto.init.bind(crypto);
    } catch (error) {
      console.log(error);
      $('.actions', $template).remove();
      return;
    }

    $('.add-signature', $template).click(async () => {
      if (!individual.hasValue('v-s:uid')) {
        individual['v-s:uid'] = [crypto.genUUID()];
        console.log(individual['v-s:uid']);
        await individual.save();
      }
      await crypto.addSignature(individual);
    });

    $('.verify-signature', $template).click(async () => {
      for (const signatureIndividual of individual.get('v-s:digitalSignature')) {
        const signatureView = $(`li[resource=${signatureIndividual.id.replace(':', '\\:')}]`, $template).not('.signature-checked');
        if (!signatureView.length) continue;
        try {
          await crypto.verifySignature(individual, signatureIndividual);
          signatureView
            .prepend('<i class="glyphicon glyphicon-ok-circle text-success"></i>')
            .append('<strong><small><i class="text-success">Подпись верна</i></small></strong>');
        } catch (error) {
          signatureView
            .prepend('<i class="glyphicon glyphicon-remove-circle text-danger"></i>')
            .append(`<strong><small><i class="text-danger" title="${error}">Подпись не верна</i></small></strong>`);
        }
        signatureView.addClass('signature-checked');
      }
    });

    if ($container.data('with-btn') == 'false' || $container.data('with-btn') == false) {
      $('.actions', $template).remove();
    }
  });
};

export const html = `
  <div class="panel panel-default" style="word-wrap:break-word; width:350px; display: inline-block; margin:0 20px 20px 0; overflow: hidden;">
    <div class="panel-body">
      <em about="rdfs:comment" property="rdfs:label" class="-view edit search"></em>
      <strong property="rdfs:comment" class="view -edit -search"></strong>
      <veda-control data-type="string" property="rdfs:comment" class="-view edit search"></veda-control>
      <div class="clearfix margin-sm">
        <div class="thumbnail pull-left" style="width:20%;display:inline-block;margin:0 3% 0 0;" about="@" data-template="v-ui:ModalImageTemplate"></div>
        <div class="filename pull-left" style="width:77%;display:inline-block;">
          <div about="@" data-template="v-ui:FileMinTemplate"></div>
          <i class="view -edit -search">
            <small about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></small> <small about="@" property="v-s:created"></small>
          </i>
        </div>
      </div>
      <div class="signatures">
        <hr class="margin-sm"/>
        <strong about="v-s:digitalSignature" property="rdfs:label" class="view edit search"></strong>
        <div about="@" rel="v-s:digitalSignature" data-template="v-ui:FileMinTemplate" class="-view edit search"></div>
        <ol rel="v-s:digitalSignature" class="view -edit -search" style="padding-inline-start: 0em; margin-inline-start: 1em;">
          <li class="margin-sm signature">
            <a href="/files/@">
              <span about="@" property="v-s:fileName"></span>
            </a>
            <i class="view -edit -search"> <small about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></small> <small about="@" property="v-s:created"></small> </i>
          </li>
        </ol>
      </div>
    </div>
    <div class="actions panel-footer" hidden>
      <button class="add-signature btn btn-success">Подписать</button>
      <button class="verify-signature btn btn-link view -edit -search">Проверить</button>
    </div>
  </div>
`;
