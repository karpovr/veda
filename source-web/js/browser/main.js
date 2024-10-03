// Application bootstrap

import veda from '../common/veda.js';
import appPresenter from '../browser/app_presenter.js';
import auth from '../browser/auth.js';
import 'regenerator-runtime/runtime';
import '../browser/individual_presenter.js';
import IndividualModel from '../common/individual_model.js';
import CommonUtil from '../common/util.js';
import BrowserUtil from '../browser/util.js';
import Backend from '../common/backend.js';

// Условие для исключения загрузки install_sw.js в среде CI
if (!process.env.CI) {
  import('../browser/install_sw.js');
}

veda.IndividualModel = IndividualModel;
veda.Util = {...BrowserUtil, ...CommonUtil};
veda.Backend = Backend;

export default veda;

(async () => {
  await import('jquery');
  await import('jquery-ui');
  await import('tablesortable');
  await import('bootstrap');

  const response = await fetch('./manifest');
  const manifest = await response.json();

  appPresenter(manifest);
  auth();
})();
