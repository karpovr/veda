// Application bootstrap

import veda from '../common/veda.js';

import appModel from '../common/app_model.js';

import appPresenter from '../browser/app_presenter.js';

import auth from '../browser/auth.js';

import '../browser/install_sw.js';

import 'regenerator-runtime/runtime';

import '../browser/individual_presenter.js';

export default veda;

(async () => {
  await import('jquery');
  await import('jquery-ui');
  await import('tablesortable');
  await import('bootstrap');
  const response = await fetch('./manifest');
  const manifest = await response.json();
  appModel.call(veda, manifest);
  appPresenter(veda);
  auth();
})();
