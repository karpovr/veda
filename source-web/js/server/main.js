// Application bootstrap

import veda from '../common/veda.js';
import Backend from '../common/backend.js';
import BPMN from '../server/bpmn.js';
import Codelet from '../server/codelet.js';
import Numerator from '../server/numerator.js';
import CommonUtil from '../common/util.js';
import ServerUtil from '../server/util.js';
import Workflow from '../server/workflow.js';
import WorkflowUtil from '../server/workflow_util.js';

veda.Backend = Backend;
veda.BPMN = BPMN;
veda.Codelet = Codelet;
veda.Numerator = Numerator;
veda.Util = {...ServerUtil, ...CommonUtil};
veda.Workflow = {...Workflow, ...WorkflowUtil};

try {
  veda.ticket = get_env_str_var('$ticket');
  veda.init('cfg:VedaSystem');
  console.log('user:', veda.user.id, '| ticket:', veda.ticket);
} catch (error) {
  console.error('Veda init failed');
}

export default veda;
