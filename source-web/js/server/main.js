// Application bootstrap

import veda from '../common/veda.js';

import App from '../common/app_model.js';

import '../common/backend.js';

import '../server/codelets.js';

import '../server/docflow.js';

import '../server/docflow-util.js';

import '../server/numerator.js';

import '../server/util.js';

import '../server/bpmn.js';

try {
  veda.ticket = get_env_str_var('$ticket');

  App.call(veda);

  veda.init('cfg:VedaSystem');

  console.log('user:', veda.user.id, '| ticket:', veda.ticket);
} catch (error) {
  console.log('Veda init error', error.stack);
}

export default veda;
