import $ from 'jquery';
import {CryptoPro} from 'ruscryptojs';
import CommonUtil from '/js/common/util.js';
import IndividualModel from '/js/common/individual_model.js';

const cryptoPro = new CryptoPro();

function decorator (fn, pre, post, err) {
  return async function (...args) {
    try {
      pre && await pre.call(this, ...args);
      const result = await fn.call(this, ...args);
      post && await post.call(this, ...args);
      return result;
    } catch (error) {
      err && await err.call(this, ...args);
      throw error;
    }
  };
}

function showSpinner () {
  document.getElementById('load-indicator').style.display = '';
}

function hideSpinner () {
  document.getElementById('load-indicator').style.display = 'none';
}

function spinnerDecorator (fn) {
  return decorator(fn, showSpinner, hideSpinner, hideSpinner);
}

async function createSignatureFile (signature, name, parent) {
  const uri = CommonUtil.guid();
  const path = '/' + new Date().toISOString().substring(0, 10).split('-').join('/');
  const fileIndividual = new IndividualModel();
  fileIndividual['rdf:type'] = 'v-s:File';
  fileIndividual['v-s:fileName'] = name + '.sig';
  fileIndividual['rdfs:label'] = name + '.sig';
  fileIndividual['v-s:fileSize'] = signature.length;
  fileIndividual['v-s:fileUri'] = uri;
  fileIndividual['v-s:filePath'] = path;
  fileIndividual['v-s:parent'] = parent;
  fileIndividual['v-s:backwardTarget'] = parent;
  fileIndividual['v-s:canRead'] = true;
  fileIndividual['v-s:canUpdate'] = true;
  fileIndividual['v-s:canDelete'] = true;
  fileIndividual['v-s:backwardProperty'] = 'v-s:digitalSignature';

  try {
    await uploadSignatureFile(signature, path, uri);
    await fileIndividual.save();
  } catch (error) {
    alert(error);
  }
}

async function uploadSignatureFile (signature, path, uri) {
  const formData = new FormData();
  const blob = new Blob([signature], {type: 'plain/text'});
  formData.append('file', blob);
  formData.append('path', path);
  formData.append('uri', uri);

  const response = await fetch('/files', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Ошибка создания файла-подписи.');
  }
}

async function init () {
  try {
    const cryptoProInfo = await cryptoPro.init();
    console.log('CryptoPro initialized', cryptoProInfo);
  } catch (error) {
    if (error.message === 'Can\'t find object by id') {
      confirm('Ошибка КриптоПро Browser plugin.\nОбновите страницу.') && window.location.reload();
    }
    console.log('Initialization failed', error);
    throw error;
  }
}

async function getDataToSign (url) {
  const fileResponse = await fetch(url);
  if (!fileResponse.ok) {
    throw new Error('Network error.');
  }
  const dataToSign = btoa(new Uint8Array(await fileResponse.arrayBuffer()).reduce((data, byte) => data + String.fromCharCode(byte), ''));
  return dataToSign;
}

async function getCertificates () {
  let certificates = [];
  try {
    certificates = (await cryptoPro.listCertificates()).sort((a, b) => a.name > b.name ? 1 : -1);
  } catch (error) {
    if (error.message === 'Can\'t find object by id') {
      confirm('Ошибка КриптоПро Browser plugin.\nОбновите страницу.') && window.location.reload();
    } else {
      console.log(error);
    }
  }
  return certificates;
}

async function signData (dataToSign, thumbprint, individual) {
  const certificate = await cryptoPro.certificateInfo(thumbprint);
  const signature = await cryptoPro.signData(dataToSign, certificate.Thumbprint);
  await createSignatureFile(signature, certificate.Name, individual);
}

export const pre = async function (individual, template, container, mode, extra) {
  const $template = $(template);

  try {
    await init();
  } catch (error) {
    $('.actions', $template).remove();
    return;
  }

  $('.add-signature', $template).click(async () => {
    const dataToSign = await spinnerDecorator(getDataToSign)(`/files/${individual.id}`);
    const certificates = await spinnerDecorator(getCertificates)();
    if (certificates.length > 1) {
      const dialog = template.querySelector('.certificate-dialog');
      const select = template.querySelector('.certificate-select');
      const submit = template.querySelector('.certificate-submit');
      const cancel = template.querySelector('.certificate-cancel');
      if (!select.children.length) {
        certificates.forEach((certificate) => {
          const option = document.createElement('option');
          option.value = certificate.id;
          option.label = certificate.name;
          select.appendChild(option);
        });
        select.addEventListener('change', () => {
          submit.value = select.value;
        });
        dialog.addEventListener('close', async () => {
          const thumbprint = dialog.returnValue;
          if (!thumbprint) {
            return;
          }
          await spinnerDecorator(signData)(dataToSign, thumbprint, individual);
        });
        cancel.addEventListener('click', () => {
          submit.value = '';
          dialog.close();
        });
      }
      submit.value = select.value;
      dialog.returnValue = '';
      dialog.showModal();
    } else if (certificates.length === 1) {
      await spinnerDecorator(signData)(dataToSign, certificates[0].id, individual);
    } else {
      alert('Ошибка: Нет доступных сертификатов для подписи.');
    }
  });
};

export const post = async function (individual, template, container, mode, extra) {
  const $template = $(template);

  const fn = individual['v-s:fileName'][0];
  const img = 'jpg|jpeg|gif|png|bmp|svg';
  if (typeof fn === 'string' || fn instanceof String) {
    const idx = fn.lastIndexOf('.');
    const ext = fn.substr(idx + 1);
    $('span.icon', template).text(ext);
    if (img.indexOf(ext.toLowerCase()) < 0) {
      $('.thumbnail', template).remove();
      $('.filename', template).css('width', '100%');
    }
  }

  individual.on('v-s:digitalSignature', showSignature);
  $template.one('remove', () => individual.off('v-s:digitalSignature', showSignature));
  showSignature();

  const spinningVerifySignature = spinnerDecorator(verifySignature);
  $('.verify-signature', $template).click(spinningVerifySignature);

  // individual.on('v-s:digitalSignature', spinningVerifySignature);
  // $template.one('remove', () => individual.off('v-s:digitalSignature', spinningVerifySignature));
  // spinningVerifySignature();

  function showSignature () {
    if (!individual.hasValue('v-s:digitalSignature')) {
      $('.signatures', $template).addClass('hidden');
      $('.verify-signature', $template).addClass('hidden');
    } else {
      $('.signatures', $template).removeClass('hidden');
      $('.verify-signature', $template).removeClass('hidden');
    }
  }

  async function verifySignature () {
    if (!individual.hasValue('v-s:digitalSignature')) {
      return;
    }

    try {
      await init();
    } catch (error) {
      return;
    }

    const fileResponse = await fetch(`/files/${individual.id}`);
    if (!fileResponse.ok) {
      throw new Error('Network error.');
    }
    const dataToCheck = btoa(new Uint8Array(await fileResponse.arrayBuffer()).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    for (const signatureIndividual of individual.get('v-s:digitalSignature')) {
      if (signatureIndividual.checked) continue;
      try {
        const signatureResponse = await fetch(`/files/${signatureIndividual.id}`);
        if (!signatureResponse.ok) {
          throw new Error('Network error.');
        }
        const signature = await signatureResponse.text();
        await cryptoPro.verifySign(dataToCheck, signature);
        $(`li[resource=${signatureIndividual.id.replace(':', '\\:')}]`, $template)
          .prepend('<i class="glyphicon glyphicon-ok-circle text-success"></i>')
          .append('<span class="text-success">Подпись верна</span>');
      } catch (sigError) {
        $(`li[resource=${signatureIndividual.id.replace(':', '\\:')}]`, $template)
          .prepend('<i class="glyphicon glyphicon-remove-circle text-danger"></i>')
          .append(`<span class="text-danger" title="${sigError}">Подпись не верна</span>`);
      }
      signatureIndividual.checked = true;
    }
  }
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
          <span class="icon label label-primary"></span>
          <a href="/files/@">
            <span about="@" property="v-s:fileName"></span>
          </a>
          <br>
          <i class="view -edit -search">
            <small rel="v-s:creator" data-template="v-ui:LabelTemplate"></small>, <small property="v-s:created"></small>
          </i>
        </div>
      </div>
      <div class="signatures">
        <hr class="margin-sm"/>
        <strong about="v-s:digitalSignature" property="rdfs:label" class="view edit search"></strong>
        <div rel="v-s:digitalSignature" data-template="v-ui:FileMinTemplate" class="-view edit search"></div>
        <ol rel="v-s:digitalSignature" class="view -edit -search" style="padding-inline-start: 0em; margin-inline-start: 1em;">
          <li class="margin-sm signature">
            <a href="/files/@">
              <span about="@" property="v-s:fileName"></span>
            </a>
            <i class="view -edit -search"> <small rel="v-s:creator" data-template="v-ui:LabelTemplate"></small>, <small property="v-s:created"></small> </i>
          </li>
        </ol>
      </div>
      <dialog class="certificate-dialog" style="border: 2px solid gray; border-radius: 0.5em;">
        <form class="certificate-form" method="dialog">
          <div class="form-group">
            <label>Выберите сертификат</label>
            <select class="certificate-select form-control"></select>
          </div>
          <button type="submit" class="certificate-submit btn btn-primary">Ok</button>
          <button type="button" class="certificate-cancel btn btn-default">Cancel</button>
        </form>
      </dialog>
    </div>
    <div class="actions panel-footer">
      <button class="add-signature btn btn-success">Подписать</button>
      <button class="verify-signature btn btn-link view -edit -search">Проверить</button>
      <!--span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span-->
    </div>
  </div>
`;
