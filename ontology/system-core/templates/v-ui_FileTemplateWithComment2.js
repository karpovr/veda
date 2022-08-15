import $ from 'jquery';
import cryptoPro from 'crypto-pro';
import CommonUtil from '/js/common/util.js';
import IndividualModel from '/js/common/individual_model.js';

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

export const pre = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!(await cryptoPro.isValidSystemSetup())) {
    $('.sys-info, .sign', template).remove();
    return;
  }

  $('.sys-info', template).click(async () => {
    console.log('Is valid setup', await cryptoPro.isValidSystemSetup());
    console.log('Crypto info', await cryptoPro.getSystemInfo());
    console.log('User certificates', await cryptoPro.getUserCertificates());
  });

  $('.sign', template).click(async () => {
    const response = await fetch(`/files/${individual.id}`);
    if (!response.ok) {
      throw new Error('Network error.');
    }
    const contents = await response.arrayBuffer();
    const hash = await cryptoPro.createHash(contents);
    console.log('hash', hash);
    const certificates = await cryptoPro.getUserCertificates();
    if (certificates.length > 1) {
      const dialog = document.getElementById('certificate-dialog');
      const select = document.getElementById('certificate-select');
      const submit = document.getElementById('certificate-submit');
      if (!select.children.length) {
        certificates.forEach((certificate) => {
          const option = document.createElement('option');
          option.value = certificate.thumbprint;
          option.label = certificate.name;
          select.appendChild(option);
        });
        submit.value = select.value;
        select.addEventListener('change', () => {
          submit.value = select.value;
        });
        dialog.addEventListener('close', async () => {
          const thumbprint = dialog.returnValue;
          const certificate = await cryptoPro.getCertificate(thumbprint);
          const signature = await cryptoPro.createDetachedSignature(certificate.thumbprint, hash);
          await createSignatureFile(signature, certificate.name, individual);
        });
      }
      dialog.showModal();
    } else if (certificates.length === 1) {
      const certificate = certificates[0];
      const signature = await cryptoPro.createDetachedSignature(certificate.thumbprint, hash);
      await createSignatureFile(signature, certificate.name, individual);
    } else {
      alert('Ошибка: Нет доступных сертификатов для подписи.');
    }
  });
};

export const post = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const fn = individual['v-s:fileName'][0];
  if (typeof fn === 'string' || fn instanceof String) {
    const idx = fn.lastIndexOf('.');
    const ext = fn.substr(idx + 1);
    $('span#icon', template).text(ext);
  }
};

export const html = `
  <div class="panel panel-default" style="word-wrap:break-word; width:400px; display: inline-block; margin:0 20px 20px 0; overflow: hidden">
    <div class="panel-body">
      <em about="rdfs:comment" property="rdfs:label" class="-view edit search"></em>
      <strong property="rdfs:comment" class="view -edit -search"></strong>
      <veda-control data-type="string" property="rdfs:comment" class="-view edit search"></veda-control>
      <hr class="margin-sm view -edit -search" />
      <div>
        <span id="icon" class="label label-primary"></span>
        <a href="/files/@">
          <span about="@" property="v-s:fileName"></span>
        </a>
      </div>
      <div class="view -edit -search" style="font-style:italic">
        <small rel="v-s:creator" data-template="v-ui:LabelTemplate"></small>, <small property="v-s:created"></small>
      </div>
      <hr class="margin-sm"/>
      <strong about="v-s:digitalSignature" property="rdfs:label" class="view edit search"></strong>
      <span about="@" rel="v-s:digitalSignature" data-template="v-ui:FileMinTemplate" class="view -edit -search"></span>
      <div rel="v-s:digitalSignature" data-template="v-ui:FileMinTemplate" class="-view edit search"></div>
    </div>
    <div class="actions panel-footer">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
      <button class="sys-info btn btn-default">Sys info</button>
      <button class="sign btn btn-default">Sign</button>
    </div>

    <dialog id="certificate-dialog">
      <form id="certificate-form" method="dialog">
        <div class="form-group">
          <label for="certificate-select">Choose certificate</label>
          <select id="certificate-select" class="form-control"></select>
        </div>
        <button id="certificate-submit" type="submit" class="btn btn-primary">Ok</button>
      </form>
    </dialog>
  </div>
`;
