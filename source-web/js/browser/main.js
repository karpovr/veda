// Main

import veda from '../common/veda.js';

import appModel from '../common/app_model.js';

import appPresenter from '../browser/app_presenter.js';

import auth from '../browser/auth.js';

import '../browser/install_sw.js';

import '../browser/individual_presenter.js';

export default veda;

System.import('jquery').then(function () {
  System.import('bootstrap').then(function () {
    const xhr = new XMLHttpRequest();
    xhr.onload = function (e) {
      const loadIndicator = document.getElementById('load-indicator');
      loadIndicator.style.display = 'none';
      if (this.status == 200) {
        const manifest = JSON.parse(xhr.response);
        appModel.call(veda, manifest);
        auth();
        appPresenter();
      } else {
        console.log(e);
      }
    };
    xhr.onerror = console.log;
    xhr.ontimeout = console.log;
    xhr.open('GET', './manifest');
    xhr.send();
  });
});
