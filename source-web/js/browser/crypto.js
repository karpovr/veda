// Cryptography integration

import {CryptoPro} from 'ruscryptojs';
import CommonUtil from '../common/util.js';
import IndividualModel from '../common/individual_model.js';

const cryptoPro = new CryptoPro();

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
    throw new Error('Не удалось создать файл-подписи. Failed to create signature file.');
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

async function getValidCertificates () {
  let certificates = [];
  try {
    certificates = await cryptoPro.listCertificates();
    certificates = (await Promise.all(certificates.map(async (certificate) => {
      const certificateInfo = await cryptoPro.certificateInfo(certificate.id);
      return certificateInfo.IsValid ? certificate : undefined;
    }))).filter(Boolean).sort((a, b) => a.name > b.name ? 1 : -1);
  } catch (error) {
    if (error.message === 'Can\'t find object by id') {
      confirm('Потеряно соединение с КриптоПро browser plugin. Обновите страницу.\nLost connection to CryptoPro browser plugin. Reload page.') && window.location.reload();
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

const dialogTemplate = `
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
`;

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

export default class Crypto {
  constructor () {
    this.inited = false;
  }

  static getInstance () {
    if (!this.instance) {
      this.instance = new Crypto();
    }
    return this.instance;
  }

  async init () {
    if (this.inited) return this.inited;
    this.inited = new Promise(async (resolve, reject) => {
      try {
        const cryptoProInfo = await cryptoPro.init();
        console.log('CryptoPro initialized', cryptoProInfo);
      } catch (error) {
        if (error.message === 'Can\'t find object by id') {
          confirm('Потеряно соединение с КриптоПро browser plugin. Обновите страницу.\nLost connection to CryptoPro browser plugin. Reload page.') && window.location.reload();
        }
        console.log('Initialization failed', error);
        reject(error);
      }
      resolve();
    });
    return this.inited;
  }

  async addSignature (fileIndividual) {
    const dataToSign = await spinnerDecorator(getDataToSign)(`/files/${fileIndividual.id}`);
    const certificates = await spinnerDecorator(getValidCertificates)();
    if (certificates.length > 1) {
      const container = document.createElement('div');
      container.innerHTML = dialogTemplate;
      document.body.appendChild(container);
      const dialog = container.querySelector('.certificate-dialog');
      const select = container.querySelector('.certificate-select');
      const submit = container.querySelector('.certificate-submit');
      const cancel = container.querySelector('.certificate-cancel');
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
        await spinnerDecorator(signData)(dataToSign, thumbprint, fileIndividual);
        document.body.removeChild(container);
      });
      cancel.addEventListener('click', () => {
        submit.value = '';
        dialog.close();
      });
      submit.value = select.value;
      dialog.returnValue = '';
      dialog.showModal();
    } else if (certificates.length === 1) {
      await spinnerDecorator(signData)(dataToSign, certificates[0].id, fileIndividual);
    } else {
      alert('Ошибка: Действующие сертификаты электронной подписи не найдены.\nError: Valid signature certificates not found.');
    }
  }

  async verifySignature (fileIndividual, signatureFileIndividual) {
    return await spinnerDecorator(async () => {
      const fileIndividualResponse = await fetch(`/files/${fileIndividual.id}`);
      if (!fileIndividualResponse.ok) {
        throw new Error('Network error.');
      }
      const dataToCheck = btoa(new Uint8Array(await fileIndividualResponse.arrayBuffer()).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      const signatureFileIndividualResponse = await fetch(`/files/${signatureFileIndividual.id}`);
      if (!signatureFileIndividualResponse.ok) {
        throw new Error('Network error.');
      }
      const signature = await signatureFileIndividualResponse.text();
      return await cryptoPro.verifySign(dataToCheck, signature);
    })(fileIndividual, signatureFileIndividual);
  }
}
