import CommonUtil from '../common/util.js';
import WorkflowUtil from "./workflow_util.js";
import ServerUtil from "./util.js";

/*
 *  обработка процесса
 */

export default function PrepareProcess (ticket, document) {
    const deleted = CommonUtil.hasValue(document, 'v-s:deleted');
    const completed = CommonUtil.hasValue(document, 'v-wf:isCompleted');
    if (completed || deleted) {
        return;
    }

    const _process = document;
    const trace_journal_uri = WorkflowUtil.get_trace_journal(document, _process);

    if (trace_journal_uri) {
        ServerUtil.traceToJournal(ticket, trace_journal_uri, 'prepare_process', document['@']);
    }

    const inVars = _process['v-wf:inVars'] || [];

    const instanceOf = ServerUtil.getUri( document['v-wf:instanceOf'] );
    const net = get_individual(ticket, instanceOf);
    if (!net) {
        return;
    }

    // создадим переменные с областью видимости данного процесса (v-wf:varDefineScope = v-wf:Net)
    const variables = net['v-wf:localVariable'];
    if (variables) {
        for (const variable of variables) {
            const def_variable = get_individual(ticket, variable.data);
            if (!def_variable) {
                continue;
            }

            const variable_scope = ServerUtil.getUri(def_variable['v-wf:varDefineScope']);
            if (!variable_scope) {
                continue;
            }

            if (variable_scope === 'v-wf:Net') {
                const new_variable = WorkflowUtil.generate_variable(ticket, def_variable, null, document, null, null);
                if (new_variable) {
                    put_individual(ticket, new_variable, _event_id);
                    inVars.push(
                        {
                            data: new_variable['@'],
                            type: 'Uri',
                        });
                }
            }
        }
    }

    const workItemList = [];

    const f_consistsOf = net['v-wf:consistsOf'];
    if (f_consistsOf) {
        for (const el of f_consistsOf) {
            const element_uri = el.data;
            const element = get_individual(ticket, element_uri);
            if (!element) {
                print('NET ELEMENT UNDFINED:', element_uri);
                continue;
            }

            if ( CommonUtil.hasValue(element, 'rdf:type', {data: 'v-wf:InputCondition', type: 'Uri'}) ) {
                const work_item_uri = WorkflowUtil.create_work_item(ticket, document['@'], element_uri, null, _event_id, trace_journal_uri);

                workItemList.push({
                    data: work_item_uri,
                    type: 'Uri',
                });

                break;
            }
        }
    }

    if (inVars.length > 0) {
        document['v-wf:inVars'] = inVars;
    }

    if (workItemList.length > 0) {
        document['v-wf:workItemList'] = workItemList;
    }

    document['v-wf:isCompleted'] = ServerUtil.newBool(false);

    if (inVars.length > 0 || workItemList.length > 0) {
        put_individual(ticket, document, _event_id);
    }
};
