// Workflow engine

import prepareWorkOrder from './workflow_work_order.js';
import prepareWorkItem from './workflow_work_item.js';
import prepareDecisionForm from './workflow_decision_form.js';
import prepareProcess from './workflow_process.js';
import prepareStartForm from './workflow_start_form';

const Workflow = {};

export default Workflow;

Workflow.prepare_work_order = prepareWorkOrder;
Workflow.prepare_work_item = prepareWorkItem;
Workflow.prepare_decision_form = prepareDecisionForm;
Workflow.prepare_process = prepareProcess;
Workflow.prepare_start_form = prepareStartForm;
