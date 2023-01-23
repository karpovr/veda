import CommonUtil from '../common/util.js';
import ServerUtil from '../server/util.js';
import WorkflowUtil from '../server/workflow_util.js';
import Convert from "./convert.js";

/*
 *   обработка формы решения пользователя
 */
export default function PrepareDecisionForm (ticket, document, prev_state) {
    try {
        const decision_form = document;

        //* if (decision_form['sys:source']) {
        //*  return;
        //* }

        const prev_state_decision_form = prev_state;
        let f_prev_takenDecision = null;

        if (prev_state_decision_form) {
            f_prev_takenDecision = prev_state_decision_form['v-wf:takenDecision'];
        }

        const f_takenDecision = decision_form['v-wf:takenDecision'];
        if (!f_takenDecision && !f_prev_takenDecision) {
            return;
        }

        const enforce_processing = CommonUtil.hasValue(decision_form, 'v-wf:enforceProcessing', {data: true, type: 'Boolean'});
        if (f_prev_takenDecision && !enforce_processing) {
            if (!f_takenDecision) {
                ServerUtil.set_err_on_indv('attempt clear decision[' + ServerUtil.getUri(f_prev_takenDecision) + '], restore previous decision', document, 'prepare decision form');
                ServerUtil.set_field_to_document('v-wf:takenDecision', f_prev_takenDecision, decision_form['@']);
            } else if (f_takenDecision.length != f_prev_takenDecision.length || ServerUtil.getUri(f_takenDecision) != ServerUtil.getUri(f_prev_takenDecision)) {
                ServerUtil.set_err_on_indv('attempt set another decision ' + CommonUtil.toJson(f_takenDecision) + ', restore previous decision', document, 'prepare decision form');
                ServerUtil.set_field_to_document('v-wf:takenDecision', f_prev_takenDecision, decision_form['@']);
            }
            return;
        }

        if (decision_form['v-wf:isCompleted'] && decision_form['v-wf:isCompleted'][0].data === true) {
            return;
        }

        const f_onWorkOrder = document['v-wf:onWorkOrder'];
        const _work_order = get_individual(ticket, ServerUtil.getUri(f_onWorkOrder));
        if (!_work_order) {
            ServerUtil.set_err_on_indv('WorkOrder[' + ServerUtil.getUri(f_onWorkOrder) + '], not found', document, 'prepare decision form');
            return;
        }

        const f_executor = _work_order['v-wf:executor'];
        let executor;

        if (f_executor && f_executor.length > 0) {
            executor = f_executor[0];
        }

        const f_forWorkItem = _work_order['v-wf:forWorkItem'];
        const work_item = get_individual(ticket, ServerUtil.getUri(f_forWorkItem));
        if (!work_item) {
            ServerUtil.set_err_on_indv('invalid WorkOrder[' + ServerUtil.getUri(f_onWorkOrder) + '], field v-wf:forWorkItem[' + ServerUtil.getUri(f_forWorkItem) + '], not found', document, 'prepare decision form');
            return;
        }

        const wi_isCompleted = work_item['v-wf:isCompleted'];
        if (wi_isCompleted) {
            if (wi_isCompleted[0].data === true) {
                ServerUtil.set_err_on_indv('WorkItem[' + ServerUtil.getUri(f_forWorkItem) + '], already is completed, skip decision form...', document, 'prepare decision form');
                return;
            }
        }

        const forProcess = work_item['v-wf:forProcess'];
        const forProcess_uri = ServerUtil.getUri(forProcess);
        const _process = get_individual(ticket, forProcess_uri);
        if (!_process) {
            ServerUtil.set_err_on_indv('invalid WorkItem[' + ServerUtil.getUri(f_forWorkItem) + '], field v-wf:forProcess[' + ServerUtil.getUri(forProcess) + '], not found', document, 'prepare decision form');
            return;
        }

        const isStopped = _process['v-wf:isStopped'];
        if (isStopped && isStopped[0].data === true) {
            return;
        }

        const f_forNetElement = work_item['v-wf:forNetElement'];
        const net_element = get_individual(ticket, ServerUtil.getUri(f_forNetElement));
        if (!net_element) {
            ServerUtil.set_err_on_indv('invalid WorkItem[' + ServerUtil.getUri(f_forWorkItem) + '], field v-wf:forNetElement[' + ServerUtil.getUri(f_forNetElement) + '], not found', document, 'prepare decision form');
            return;
        }

        const transform_link = ServerUtil.getUri(net_element['v-wf:completeDecisionTransform']);
        if (!transform_link) {
            ServerUtil.set_err_on_indv('invalid net_element[' + ServerUtil.getUri(f_forNetElement) + '], field v-wf:completeDecisionTransform[' + transform_link + '], not found', document, 'prepare decision form');
            return;
        }

        const transform = get_individual(ticket, transform_link);
        if (!transform) {
            ServerUtil.set_err_on_indv('invalid net_element[' + ServerUtil.getUri(f_forNetElement) + '], field v-wf:completeDecisionTransform[' + transform_link + '], not found', document, 'prepare decision form');
            return;
        }

        const process_output_vars = Convert.transformation(ticket, decision_form, transform, executor, f_onWorkOrder, forProcess);

        const new_vars = WorkflowUtil.store_items_and_set_minimal_rights(ticket, process_output_vars);

        if (process_output_vars.length > 0) {
            ServerUtil.set_field_to_document('v-wf:outVars', new_vars, _work_order['@']);
            _work_order['v-wf:outVars'] = new_vars;

            ServerUtil.set_field_to_document('v-wf:isCompleted', ServerUtil.newBool(true), document['@']);

            WorkflowUtil.mapToJournal(net_element['v-wf:completedExecutorJournalMap'], ticket, _process, work_item, _work_order, null, ServerUtil.getJournalUri(_work_order['@']));
        }
    } catch (e) {
        print(e.stack);
    }
};
