// Cryptography integration

import {CryptoPro} from 'ruscryptojs';
import CommonUtil from '../common/util.js';
import IndividualModel from '../common/individual_model.js';
import {spinnerDecorator} from '../browser/dom_helpers.js';

const cryptoPro = new CryptoPro();

async function createSignatureFileIndividual (signature, name, parent, thumbprint) {
  const uri = CommonUtil.guid();
  const path = '/' + new Date().toISOString().substring(0, 10).split('-').join('/');
  const fileIndividual = new IndividualModel();
  fileIndividual['rdf:type'] = ['v-s:File'];
  fileIndividual['v-s:fileName'] = [name + '.sig'];
  fileIndividual['rdfs:label'] = [name + '.sig'];
  fileIndividual['v-s:fileSize'] = [signature.length];
  fileIndividual['v-s:fileUri'] = [uri];
  fileIndividual['v-s:filePath'] = [path];
  fileIndividual['v-s:parent'] = [parent];
  fileIndividual['v-s:backwardTarget'] = [parent];
  fileIndividual['v-s:canRead'] = [true];
  fileIndividual['v-s:canUpdate'] = [true];
  fileIndividual['v-s:canDelete'] = [true];
  fileIndividual['v-s:backwardProperty'] = ['v-s:digitalSignature'];
  fileIndividual['v-s:backwardPrepend'] = [true];
  if (thumbprint != undefined) {
    fileIndividual['v-s:signatureStamp'] = [thumbprint];
  }
  try {
    await uploadSignatureFile(signature, path, uri);
    await fileIndividual.save();
    return fileIndividual;
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

async function readDataToSign (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = function (e) {
      const dataToSign = btoa(new Uint8Array(e.target.result).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      resolve(dataToSign);
    };
    reader.onerror = reject;
  });
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
  const signatureFileIndividual = await createSignatureFileIndividual(signature, certificate.Name, individual, thumbprint);
  // using backwardPrepend
  individual['v-s:digitalSignature'] = [signatureFileIndividual].concat(individual['v-s:digitalSignature']);
  return true;
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

  genUUID () {
    return crypto.randomUUID();
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

  async chooseYourStamp () {
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
      return new Promise((resolve, reject) => {
        dialog.addEventListener('close', async () => {
          const thumbprint = dialog.returnValue;
          if (!thumbprint) {
            return reject(undefined);
          }
          document.body.removeChild(container);
          resolve(thumbprint);
        });
        cancel.addEventListener('click', () => {
          submit.value = '';
          dialog.close();
          reject(undefined);
        });
        submit.value = select.value;
        dialog.returnValue = '';
        dialog.showModal();
      });
    } else if (certificates.length === 1) {
      return certificates[0].id;
    } else {
      alert('Ошибка: Действующие сертификаты электронной подписи не найдены.\nError: Valid signature certificates not found.');
    }
  }

  async addSignature (fileIndividual) {
    let dataToSign;
    if (fileIndividual.file) {
      dataToSign = await spinnerDecorator(readDataToSign)(fileIndividual.file);
    } else {
      dataToSign = await spinnerDecorator(getDataToSign)(`/files/${fileIndividual.id}`);
    }
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
      return new Promise((resolve, reject) => {
        dialog.addEventListener('close', async () => {
          const thumbprint = dialog.returnValue;
          if (!thumbprint) {
            return resolve(undefined);
          }
          document.body.removeChild(container);
          await spinnerDecorator(signData)(dataToSign, thumbprint, fileIndividual);
          resolve(thumbprint);
        });
        cancel.addEventListener('click', () => {
          submit.value = '';
          dialog.close();
          resolve(undefined);
        });
        submit.value = select.value;
        dialog.returnValue = '';
        dialog.showModal();
      });
    } else if (certificates.length === 1) {
      await spinnerDecorator(signData)(dataToSign, certificates[0].id, fileIndividual);
    } else {
      alert('Ошибка: Действующие сертификаты электронной подписи не найдены.\nError: Valid signature certificates not found.');
    }
  }

  async addBatchSignature (fileIndividuals) {
    const dataArray = await fileIndividuals.reduce(async (acc, fileIndividual) => {
      acc = await acc;
      let dataToSign;
      if (fileIndividual.file) {
        dataToSign = await spinnerDecorator(readDataToSign)(fileIndividual.file);
      } else {
        dataToSign = await spinnerDecorator(getDataToSign)(`/files/${fileIndividual.id}`);
      }
      acc.push(dataToSign);
      return acc;
    }, Promise.resolve([]));
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
      return new Promise((resolve, reject) => {
        dialog.addEventListener('close', async () => {
          const thumbprint = dialog.returnValue;
          if (!thumbprint) {
            return resolve(undefined);
          }
          document.body.removeChild(container);
          await dataArray.reduce(async (acc, dataToSign, i) => {
            await acc;
            await spinnerDecorator(signData)(dataToSign, thumbprint, fileIndividuals[i]);
            return true;
          }, Promise.resolve());
          resolve(thumbprint);
        });
        cancel.addEventListener('click', () => {
          submit.value = '';
          dialog.close();
          resolve(undefined);
        });
        submit.value = select.value;
        dialog.returnValue = '';
        dialog.showModal();
      });
    } else if (certificates.length === 1) {
      await dataArray.reduce(async (acc, dataToSign, i) => {
        await acc;
        await spinnerDecorator(signData)(dataToSign, certificates[0].id, fileIndividuals[i]);
        return true;
      }, Promise.resolve());
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
