// Main

import veda from '../common/veda.js';

import appModel from '../common/app_model.js';

import appPresenter from '../browser/app_presenter.js';

import auth from '../browser/auth.js';

import '../browser/install_sw.js';

import '../browser/individual_presenter.js';

import 'regenerator-runtime/runtime';

export default veda;

(async () => {
  await System.import('jquery');
  await System.import('bootstrap');
  const manifest = await fetch('./manifest');
  appModel.call(veda, manifest);
  auth();
  appPresenter();
})();
