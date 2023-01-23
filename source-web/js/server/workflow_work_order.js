import CommonUtil from '../common/util.js';
import ServerUtil from '../server/util.js';
import WorkflowUtil from '../server/workflow_util.js';
import Convert from "./convert.js";

/*
 *   обработка рабочего задания
 */
export default function PrepareWorkOrder (ticket, document) {
    try {
        const _work_order = document;

        const f_executor = document['v-wf:executor'];
        const executor = get_individual(ticket, ServerUtil.getUri(f_executor));
        if (f_executor && !executor) return;

        const f_forWorkItem = ServerUtil.getUri(document['v-wf:forWorkItem']);
        const work_item = get_individual(ticket, f_forWorkItem);
        if (!work_item) return;

        const forProcess = work_item['v-wf:forProcess'];
        const forProcess_uri = ServerUtil.getUri(forProcess);
        const _process = get_individual(ticket, forProcess_uri);
        if (!_process) return;

        const isStopped = _process['v-wf:isStopped'];
        if (isStopped && isStopped[0].data === true) {
            return;
        }

        const trace_journal_uri = WorkflowUtil.create_new_trace_subjournal(f_forWorkItem, _work_order, 'prepare_work_order:' + _work_order['@'], 'v-wf:WorkOrderStarted');
        if (trace_journal_uri) {
            ServerUtil.traceToJournal(ticket, trace_journal_uri, 'обработка рабочего задания', CommonUtil.toJson(document));
        }

        let journal_uri;

        let f_inVars = work_item['v-wf:inVars'];
        if (!f_inVars) {
            f_inVars = [];
        }

        const forNetElement = work_item['v-wf:forNetElement'];
        const net_element = get_individual(ticket, ServerUtil.getUri(forNetElement));
        if (!net_element) return;

        const f_local_outVars = document['v-wf:outVars'];
        let task_output_vars = [];

        const f_useSubNet = document['v-wf:useSubNet'];

        if (!f_local_outVars) {
            journal_uri = WorkflowUtil.create_new_subjournal(f_forWorkItem, _work_order['@'], net_element['rdfs:label'], 'v-wf:WorkOrderStarted');

            if (!executor) {
                WorkflowUtil.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');
            }

            // берем только необработанные рабочие задания
            if (!executor) {
                if (!net_element['v-wf:completedMapping']) {
                    task_output_vars.push(
                        {
                            data: 'v-wf:complete',
                            type: 'Uri',
                        });
                } else {
                    // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                    task_output_vars = WorkflowUtil.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, null, true, trace_journal_uri, 'v-wf:completedMapping');
                }

                if (task_output_vars.length == 0) {
                    task_output_vars.push(
                        {
                            data: 'v-wf:complete',
                            type: 'Uri',
                        });
                }

                if (task_output_vars.length > 0) {
                    document['v-wf:outVars'] = task_output_vars;
                    put_individual(ticket, document, _event_id);
                }
            } else {
                const is_appointment = CommonUtil.hasValue(executor, 'rdf:type', {data: 'v-s:Appointment', type: 'Uri'});
                const is_position = CommonUtil.hasValue(executor, 'rdf:type', {data: 'v-s:Position', type: 'Uri'});
                const is_codelet = CommonUtil.hasValue(executor, 'rdf:type', {data: 'v-s:Codelet', type: 'Uri'});
                const is_person = CommonUtil.hasValue(executor, 'rdf:type', {data: 'v-s:Person', type: 'Uri'});

                if (is_codelet) {
                    WorkflowUtil.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');

                    const expression = ServerUtil.getFirstValue(executor['v-s:script']);
                    if (!expression) return;

                    const task = new WorkflowUtil.Context(work_item, ticket);
                    const process = new WorkflowUtil.Context(_process, ticket);
                    const codelet_output_vars = eval(expression);
                    if (codelet_output_vars && codelet_output_vars.length > 0) {
                        const localVariablesUri = WorkflowUtil.store_items_and_set_minimal_rights(ticket, codelet_output_vars);
                        _work_order['v-wf:outVars'] = localVariablesUri;
                        put_individual(ticket, _work_order, _event_id);
                    }
                    // end [is codelet]
                } else if ((is_appointment || is_position || is_person) && !f_useSubNet) {
                    const work_item_inVars = [];
                    for (const f_inVar of f_inVars) {
                        const indv = get_individual(ticket, f_inVar.data);
                        work_item_inVars.push(indv);
                    }

                    let prev_task;
                    let i_work_item = work_item;

                    while (!prev_task) {
                        const previousWorkItem_uri = ServerUtil.getUri(i_work_item['v-wf:previousWorkItem']);
                        if (!previousWorkItem_uri) {
                            break;
                        }

                        const previous_work_item = get_individual(ticket, previousWorkItem_uri);
                        if (!previous_work_item) {
                            break;
                        }

                        const prev_forNetElement_uri = ServerUtil.getUri(previous_work_item['v-wf:forNetElement']);
                        if (!prev_forNetElement_uri) {
                            break;
                        }

                        const prev_forNetElement = get_individual(ticket, prev_forNetElement_uri);
                        if (!prev_forNetElement) {
                            break;
                        }

                        if (prev_forNetElement['rdf:type'][0].data == 'v-wf:Task') {
                            prev_task = previous_work_item['v-wf:forNetElement'];
                            break;
                        }
                        i_work_item = previous_work_item;
                    }

                    // ? или сделать curTask и prevTask только для трансформации ?
                    // ++ work_item_inVars: cur task id
                    let var_ctid = {
                        '@': '-',
                        'rdf:type': [
                            {
                                data: 'v-wf:Variable',
                                type: 'Uri',
                            }],
                        'v-wf:variableName': [
                            {
                                data: 'curTask',
                                type: 'String',
                            }],
                        'v-wf:variableValue': forNetElement,
                    };
                    work_item_inVars.push(var_ctid);

                    if (prev_task) {
                        // ++ work_item_inVars: prev task id
                        var_ctid = {
                            '@': '-',
                            'rdf:type': [
                                {
                                    data: 'v-wf:Variable',
                                    type: 'Uri',
                                }],
                            'v-wf:variableName': [
                                {
                                    data: 'prevTask',
                                    type: 'String',
                                }],
                            'v-wf:variableValue': prev_task,
                        };
                        work_item_inVars.push(var_ctid);
                    }

                    WorkflowUtil.mapToJournal(net_element['v-wf:startingExecutorJournalMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingExecutorJournalMap');

                    const transform_link = ServerUtil.getUri(net_element['v-wf:startDecisionTransform']);
                    if (!transform_link) return;
                    const transform = get_individual(ticket, transform_link);
                    if (!transform) return;

                    const transform_result = Convert.transformation(ticket, work_item_inVars, transform, f_executor, ServerUtil.newUri(document['@']), forProcess);

                    if (trace_journal_uri) {
                        ServerUtil.traceToJournal(ticket, trace_journal_uri, 'v-wf:startDecisionTransform', 'transform_result=' + CommonUtil.toJson(transform_result));
                    }

                    //print ('transform_result=' + CommonUtil.toJson(transform_result))

                    const decisionFormList = [];

                    if (transform_result) {
                        for (const result of transform_result) {
                            if (result['v-s:created'] == undefined) {
                                result['v-s:created'] = ServerUtil.newDate(new Date());
                            } else {
                                result['v-s:edited'] = ServerUtil.newDate(new Date());
                            }

                            if (result['v-s:creator'] == undefined) {
                                result['v-s:creator'] = ServerUtil.newUri('cfg:VedaSystem');
                            }

                            put_individual(ticket, result, _event_id);
                            decisionFormList.push(
                                {
                                    data: result['@'],
                                    type: 'Uri',
                                });

                            // выдадим права отвечающему на эту форму
                            if (is_appointment) {
                                const employee = executor['v-s:employee'];
                                if (employee) {
                                    ServerUtil.addRight(ticket, employee[0].data, result['@'], ['v-s:canRead', 'v-s:canUpdate']);
                                }
                                const position = executor['v-s:occupation'];
                                if (position) {
                                    ServerUtil.addRight(ticket, position[0].data, result['@'], ['v-s:canRead', 'v-s:canUpdate']);
                                }
                            }
                            if (is_position || is_person) {
                                ServerUtil.addRight(ticket, executor['@'], result['@'], ['v-s:canRead', 'v-s:canUpdate']);
                            }

                            // включим задачу в группу документа
                            if (CommonUtil.hasValue(result, 'v-wf:onDocument')) {
                                const docId = ServerUtil.getUri(result['v-wf:onDocument']);
                                ServerUtil.addToGroup(ticket, docId, result['@'], ['v-s:canRead'], undefined, 'd:membership_' + result['@'].split(':').join('_') + '_' + docId.split(':').join('_'));
                            }
                        }
                    }

                    const add_to_document = {
                        '@': document['@'],
                        'v-wf:decisionFormList': decisionFormList,
                    };
                    add_to_individual(ticket, add_to_document, _event_id);
                    _work_order['v-wf:decisionFormList'] = decisionFormList;

                    WorkflowUtil.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');
                }

                if ( (CommonUtil.hasValue(executor, 'rdf:type', {data: 'v-wf:Net', type: 'Uri'}) || f_useSubNet) && !is_codelet ) {
                    WorkflowUtil.create_new_subprocess(ticket, f_useSubNet, f_executor, net_element, f_inVars, document, trace_journal_uri);
                }
            }
        }

        let is_goto_to_next_task = false;
        let is_have_enforce_order = false;
        // begin //////////////// скрипт сборки результатов (WorkOrder) ///////////////////////////////////////////
        const work_item_result = [];

        // найдем маппинг множественных результатов
        const wosResultsMapping = net_element['v-wf:wosResultsMapping'];

        const workOrderList = work_item['v-wf:workOrderList'];
        // проверяем есть ли результаты рабочих заданий
        if (workOrderList) {
            for (const item of workOrderList) {
                let workOrder;
                if (item.data != document['@']) {
                    workOrder = get_individual(ticket, item.data);
                } else {
                    workOrder = document;
                }
                is_have_enforce_order = is_have_enforce_order || CommonUtil.hasValue(workOrder, 'v-wf:enforceProcessing', {data: true, type: 'Boolean'});

                const outVars = workOrder['v-wf:outVars'];
                if (outVars) {
                    const el = {};
                    el['workOrder'] = workOrder['@'];

                    let f_set = false;
                    for (const outVar of outVars) {
                        const _result = get_individual(ticket, outVar.data);
                        if (_result) {
                            if (wosResultsMapping) {
                                // wosResultsMapping указан
                            } else {
                                // складываем все результаты в локальную переменную
                                let key;
                                let val;
                                const varName = _result['v-wf:variableName'];
                                if (varName) {
                                    key = varName[0].data;
                                }

                                const varValue = _result['v-wf:variableValue'];
                                if (varValue) {
                                    val = varValue;
                                }

                                if ( /* val !== undefined &&*/ key !== undefined) {
                                    el[key] = val;
                                    f_set = true;
                                }
                            }
                        }
                    }
                    if (f_set) work_item_result.push(el);
                }
            }
        }
        if (work_item_result.length == workOrderList.length) {
            is_goto_to_next_task = true;
        } else {
            if (trace_journal_uri) {
                ServerUtil.traceToJournal(ticket, trace_journal_uri, '[WO4.0] не все задания выполнены', 'stop. work_item_result' + CommonUtil.toJson(work_item_result) + ', workOrderList=', CommonUtil.toJson(workOrderList));
            }
        }

        // end //////////////// скрипт сборки результатов
        if (trace_journal_uri) {
            ServerUtil.traceToJournal(ticket, trace_journal_uri, '[WO4] work_item_result', CommonUtil.toJson(work_item_result));
        }

        const workItemList = [];

        if (is_goto_to_next_task) {
            // правка прекращает дублирование задач при автозакрытии, и оставляет рабочей кнопку #repeat-workOrder
            if (!is_have_enforce_order && work_item['v-wf:isCompleted'] && work_item['v-wf:isCompleted'][0].data === true) {
                ServerUtil.traceToJournal(ticket, trace_journal_uri, '[WO4] work_item already is completed, stop. ', CommonUtil.toJson(work_item));
            } else {
                journal_uri = ServerUtil.getJournalUri(_work_order['@']);


                // переход к новой задаче  prepare[[wo][wo][wo]] ----> new [wi]

                if (work_item_result.length > 0) {
                    if (work_item_result[0]['complete']) {
                        // если было пустое задание, то не журналируем
                    } else {
                        WorkflowUtil.mapToJournal(net_element['v-wf:completedJournalMap'], ticket, _process, work_item, null, net_element['rdfs:label'], journal_uri);
                    }
                }

                if (net_element['v-wf:completedMapping']) {
                    // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                    task_output_vars = WorkflowUtil.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, work_item_result, true, trace_journal_uri, 'v-wf:completedMapping');
                }

                // определим переход на следующие задачи в зависимости от результата
                // res должен быть использован при eval каждого из предикатов
                const hasFlows = net_element['v-wf:hasFlow'];
                if (hasFlows) {
                    const split = ServerUtil.getUri(net_element['v-wf:split']);

                    for (const item of hasFlows) {
                        const flow = get_individual(ticket, item.data);
                        if (!flow) continue;

                        const flowsInto = flow['v-wf:flowsInto'];
                        if (!flowsInto) continue;

                        const predicate = flow['v-wf:predicate'];
                        if (predicate) {
                            const expression = ServerUtil.getFirstValue(predicate);
                            if (expression) {
                                try {
                                    const task_result = new WorkflowUtil.WorkItemResult(work_item_result);
                                    const task = new WorkflowUtil.Context(work_item, ticket);
                                    const process = new WorkflowUtil.Context(_process, ticket);
                                    const res1 = eval(expression);

                                    if (trace_journal_uri) {
                                        ServerUtil.traceToJournal(ticket, trace_journal_uri, 'in flow expression', CommonUtil.toJson(expression) + ', res =' + CommonUtil.toJson(res1));
                                    }

                                    if (res1 === true) {
                                        // выполним переход по XOR условию
                                        const nextNetElement = get_individual(ticket, ServerUtil.getUri(flowsInto));

                                        if (nextNetElement) {
                                            const work_item_uri = WorkflowUtil.create_work_item(ticket, forProcess_uri, nextNetElement['@'], work_item['@'], _event_id, trace_journal_uri);
                                            workItemList.push(
                                                {
                                                    data: work_item_uri,
                                                    type: 'Uri',
                                                });
                                        }

                                        if (split == 'v-wf:XOR') {
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    if (trace_journal_uri) {
                                        ServerUtil.traceToJournal(ticket, trace_journal_uri, 'in flow expression', CommonUtil.toJson(expression) + ', ', CommonUtil.toJson(e.stack));
                                    }

                                    print(e.stack);
                                }
                            }
                        } else {
                            if (!split || split == 'v-wf:None') {
                                // условия нет, выполним переход
                                const nextNetElement = get_individual(ticket, ServerUtil.getUri(flowsInto));

                                if (nextNetElement) {
                                    const work_item_uri = WorkflowUtil.create_work_item(ticket, forProcess_uri, nextNetElement['@'], work_item['@'], _event_id, trace_journal_uri);
                                    workItemList.push(
                                        {
                                            data: work_item_uri,
                                            type: 'Uri',
                                        });
                                }
                            }
                        }
                    }
                }

                work_item['v-wf:isCompleted'] = [
                    {
                        data: true,
                        type: 'Boolean',
                    }];

                if (workItemList.length > 0) {
                    work_item['v-wf:workItemList'] = workItemList;
                }

                if (task_output_vars.length > 0) {
                    work_item['v-wf:outVars'] = task_output_vars;
                }

                put_individual(ticket, work_item, _event_id);

                WorkflowUtil.remove_empty_branches_from_journal(journal_uri);
            }
        }
    } catch (e) {
        print(e.stack);
    }
};
