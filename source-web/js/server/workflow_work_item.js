import Codelet from '../server/codelet.js';
import CommonUtil from '../common/util.js';
import ServerUtil from '../server/util.js';
import WorkflowUtil from '../server/workflow_util.js';

/*
 *   обработка элемента сети
 *      1. слияние
 *      2. вычисление количества исполнителей, подготовка для них данных, запуск.
 *      3. обработка результатов, ветвление
 */
export default function PrepareWorkItem (ticket, document) {
    const work_item = document;
    try {
        const forProcess = ServerUtil.getUri(work_item['v-wf:forProcess']);
        const _process = get_individual(ticket, forProcess);
        if (!_process) return;

        const instanceOf = ServerUtil.getUri(_process['v-wf:instanceOf']);
        const _net = get_individual(ticket, instanceOf);
        if (!_net) return;

        const forNetElement = document['v-wf:forNetElement'];
        const netElement = get_individual(ticket, ServerUtil.getUri(forNetElement));
        if (!netElement) return;

        let trace_journal_uri;

        const isCompleted = document['v-wf:isCompleted'];
        if (isCompleted) {
            if (isCompleted[0].data === true) {
                trace_journal_uri = WorkflowUtil.get_trace_journal(document, _process);
                if (trace_journal_uri) {
                    ServerUtil.traceToJournal(ticket, trace_journal_uri, 'prepare_work_item:completed, exit', work_item['@']);
                }

                WorkflowUtil.remove_empty_branches_from_journal(ServerUtil.getJournalUri(work_item['@']));

                return;
            }
        }

        trace_journal_uri = WorkflowUtil.create_new_trace_subjournal(forProcess, work_item, netElement['@'] + '\' - [' + ServerUtil.getValues(netElement['rdfs:label']) + '] - ' + work_item['@'], 'v-wf:WorkItemStarted');

        const f_join = netElement['v-wf:join'];
        if (f_join && ServerUtil.getUri(f_join) == 'v-wf:AND') {
            const in_flows = [];
            const task2flow = {};
            // найдем все flow входящие в эту задачу
            //  обойдем все элементы сети, если это flow и идет к текущей задаче, то берем
            const f_consistsOf = _net['v-wf:consistsOf'];
            if (f_consistsOf) {
                for (const el of f_consistsOf) {
                    const i_net_element = get_individual(ticket, el.data);
                    if (!i_net_element) continue;

                    if ( CommonUtil.hasValue(i_net_element, 'rdf:type', {data: 'v-wf:Flow', type: 'Uri'}) ) {
                        if (ServerUtil.getUri(i_net_element['v-wf:flowsInto']) == netElement['@']) {
                            in_flows.push(i_net_element);
                        }
                    } else if ( CommonUtil.hasValue(i_net_element, 'rdf:type', {data: 'v-wf:Task', type: 'Uri'}) ) {
                        const f_hasFlow = i_net_element['v-wf:hasFlow'];
                        if (f_hasFlow) {
                            for (const item of f_hasFlow) {
                                task2flow[item.data] = i_net_element['@'];
                            }
                        }
                    }
                }
            }

            // нужно обойти все дерево и найти незавершенные WorkItem соответсвующие текущей net_element
            const fne = WorkflowUtil.find_in_work_item_tree(ticket, _process, 'v-wf:forNetElement', ServerUtil.getUri(forNetElement));
            if (fne.length > in_flows.length) {
                print('ERR! AND join: check v-wf:consistsOf in net[' + instanceOf + '] for net element [' + ServerUtil.getUri(forNetElement) + ']');
            }

            if (fne.length != in_flows.length) {
                return;
            }

            // проверим соответствие найденных WorkItem со схемой
            let and_join_count_complete = 0;
            let isExecuted;

            for (const in_flow of in_flows) {
                const schema_out_task = task2flow[in_flow['@']];
                for (const item of fne) {
                    const found_out_task = ServerUtil.getUri(item.parent['v-wf:forNetElement']);
                    isExecuted = item.work_item['v-s:isExecuted'];
                    if (isExecuted) {
                        // встретился уже выполняемый work_item, по этой задаче, остальные отбрасываем
                        return;
                    }

                    if (schema_out_task == found_out_task) {
                        and_join_count_complete++;
                        break;
                    }
                }
            }

            if (and_join_count_complete != in_flows.length) {
                return;
            }
        }

        document['v-s:isExecuted'] = ServerUtil.newBool(true);
        put_individual(ticket, document, _event_id);

        let is_completed = false;
        const workItemList = [];

        let is_goto_to_next_task = false;
        let task_output_vars = [];

        let journal_uri;

        if ( CommonUtil.hasValue(netElement, 'rdf:type', {data: 'v-wf:Task', type: 'Uri'}) ) {
            journal_uri = WorkflowUtil.create_new_subjournal(forProcess, work_item['@'], netElement['rdfs:label'], 'v-wf:WorkItemStarted');

            if (trace_journal_uri) {
                ServerUtil.traceToJournal(ticket, trace_journal_uri, 'Is task');
            }

            //* выполнить стартовый маппинг переменных
            let work_item__inVars = [];
            if (netElement['v-wf:startingMapping']) {
                work_item__inVars = WorkflowUtil.create_and_mapping_variables(ticket, netElement['v-wf:startingMapping'], _process, document, null, null, true, trace_journal_uri, 'v-wf:startingMapping');
                if (work_item__inVars.length > 0) {
                    document['v-wf:inVars'] = work_item__inVars;
                }
            }

            //* сформировать список исполнителей
            const executor_list = [];

            const f_subNet = netElement['v-wf:subNet'];
            const f_executor = netElement['v-wf:executor'];
            if (f_executor) {
                for (const item of f_executor) {
                    const executor = get_individual(ticket, item.data);

                    if (!executor) {
                        if (trace_journal_uri) {
                            ServerUtil.traceToJournal(ticket, trace_journal_uri, 'исполнитель не найден', ' uri=[' + item.data + ']');
                        }
                    } else {
                        if ( CommonUtil.hasValue(executor, 'rdf:type', {data: 'v-wf:ExecutorDefinition', type: 'Uri'}) ) {
                            // определение исполнителей посредством скрипта

                            const expression = ServerUtil.getFirstValue(executor['v-wf:executorExpression']);
                            if (!expression) return;

                            const task = new WorkflowUtil.Context(document, ticket);
                            const process = new WorkflowUtil.Context(_process, ticket);
                            try {
                                const result = eval(expression);

                                if (trace_journal_uri) {
                                    ServerUtil.traceToJournal(ticket, trace_journal_uri, 'определение исполнителя [' + expression + ']', 'executors=' + CommonUtil.toJson(result));
                                }

                                if (result !== undefined && result.length > 0) {
                                    for (const resultItem of result) {
                                        // проверим, существует ли данный executor, если да, то добавим в список

                                        const real_executor = get_individual(ticket, resultItem.data);

                                        if (real_executor) {
                                            executor_list.push(resultItem);
                                        }
                                    }
                                }
                            } catch (e) {
                                if (trace_journal_uri) {
                                    ServerUtil.traceToJournal(ticket, trace_journal_uri, 'исполнители не были определены [' + expression + ']', e.stack);
                                }
                            }
                        } else {
                            if (trace_journal_uri) {
                                ServerUtil.traceToJournal(ticket, trace_journal_uri, 'установлен исполнитель ', 'executor=' + CommonUtil.toJson(item.data));
                            }

                            executor_list.push(item);
                        }
                    }
                }
            } else {
                if (f_subNet) {
                    executor_list.push(f_subNet[0]);
                }
            }

            //* если не найдено ни одного исполнителя, то добавим null,
            //*   как индикатор для создания проходного(пустого) задания
            if (executor_list.length == 0) {
                executor_list.push(null);
            } else {
                WorkflowUtil.mapToJournal(netElement['v-wf:startingJournalMap'], ticket, _process, document, null, netElement['rdfs:label'], journal_uri);
            }

            const work_order_list = [];
            const work_order_uri_list = [];

            //* сформировать задания для исполнителей
            for (const executor of executor_list) {
                const new_work_order_uri = CommonUtil.genUri() + '-wo';

                const new_work_order = {
                    '@': new_work_order_uri,
                    'rdf:type': [
                        {
                            data: 'v-wf:WorkOrder',
                            type: 'Uri',
                        }],
                    'v-wf:forWorkItem': [
                        {
                            data: document['@'],
                            type: 'Uri',
                        }],
                };

                if (f_subNet) {
                    new_work_order['v-wf:useSubNet'] = f_subNet;
                }

                if (trace_journal_uri) {
                    new_work_order['v-wf:isTrace'] = ServerUtil.newBool(true);
                }

                if (executor != null) {
                    new_work_order['v-wf:executor'] = executor;
                }

                work_order_list.push(new_work_order);
                work_order_uri_list.push(
                    {
                        data: new_work_order_uri,
                        type: 'Uri',
                    });
            }

            if (work_order_uri_list.length > 0) {
                document['v-wf:workOrderList'] = work_order_uri_list;
            }

            if (work_item__inVars > 0 || work_order_uri_list.length > 0) {
                put_individual(ticket, document, _event_id);
            }

            for (const work_order of work_order_list) {
                put_individual(ticket, work_order, _event_id);
            }
            // end [Task]
        } else if ( CommonUtil.hasValue(netElement, 'rdf:type', {data: 'v-wf:InputCondition', type: 'Uri'}) || CommonUtil.hasValue(netElement, 'rdf:type', {data: 'v-wf:Condition', type: 'Uri'}) ) {
            if (netElement['@'] == 's-wf:InterlayerNet_ic') {
                const set_in_document = {
                    '@': _process['v-wf:executor'][0].data,
                };
                set_in_document['v-wf:hasStatusWorkflow'] = ServerUtil.newUri('v-wf:IsSent');
                set_in_individual(ticket, set_in_document, _event_id);
            }
            is_goto_to_next_task = true;
            // end [InputCondition]
        } else if ( CommonUtil.hasValue(netElement, 'rdf:type', {data: 'v-wf:OutputCondition', type: 'Uri'}) ) {
            if (trace_journal_uri) {
                ServerUtil.traceToJournal(ticket, trace_journal_uri, 'Is output condition ', '');
            }

            if (netElement['@'] == 's-wf:InterlayerNet_oc') {
                const set_in_document = {
                    '@': _process['v-wf:executor'][0].data,
                };
                set_in_document['v-wf:hasStatusWorkflow'] = ServerUtil.newUri('v-wf:Completed');
                set_in_individual(ticket, set_in_document, _event_id);
            }

            const f_parent_work_order = _process['v-wf:parentWorkOrder'];
            if (f_parent_work_order) {
                const parent_work_order = get_individual(ticket, ServerUtil.getUri(f_parent_work_order));
                if (parent_work_order) {
                    if (!_net['v-wf:completedMapping']) {
                        task_output_vars.push(
                            {
                                data: 'v-wf:complete',
                                type: 'Uri',
                            });
                    } else {
                        // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                        task_output_vars = WorkflowUtil.create_and_mapping_variables(ticket, _net['v-wf:completedMapping'], _process, work_item, null, null, true, trace_journal_uri, 'v-wf:completedMapping');
                    }

                    if (task_output_vars.length > 0) {
                        parent_work_order['v-wf:outVars'] = task_output_vars;
                        put_individual(ticket, parent_work_order, _event_id);
                    }
                }
            }


            is_completed = true;
            document['v-wf:isCompleted'] = [
                {
                    data: is_completed,
                    type: 'Boolean',
                }];

            const completeProcess = {
                '@': forProcess,
                'v-wf:isCompleted': [
                    {
                        data: is_completed,
                        type: 'Boolean',
                    }],
            };

            Codelet.complete_process(ticket, _process, _event_id);
            set_in_individual(ticket, completeProcess, _event_id);
        } // end [OutputCondition]

        if (is_goto_to_next_task) {
            const hasFlows = netElement['v-wf:hasFlow'];
            if (hasFlows) {
                for (const hasFlow of hasFlows) {
                    const flow = get_individual(ticket, hasFlow.data);
                    if (!flow) continue;

                    const flowsInto = flow['v-wf:flowsInto'];
                    if (!flowsInto) continue;

                    let resultEval = true;
                    try {
                        const predicate = flow['v-wf:predicate'];
                        if (predicate) {
                            const expression = ServerUtil.getFirstValue(predicate);
                            const task = new WorkflowUtil.Context(work_item, ticket);
                            const process = new WorkflowUtil.Context(_process, ticket);
                            resultEval = eval(expression);
                        }
                    } catch (e) {
                        print(e.stack);
                    }

                    if (!resultEval) continue;

                    const nextNetElement = get_individual(ticket, ServerUtil.getUri(flowsInto));
                    if (!nextNetElement) continue;

                    const work_item_uri = WorkflowUtil.create_work_item(ticket, forProcess, nextNetElement['@'], document['@'], _event_id, trace_journal_uri);
                    workItemList.push(
                        {
                            data: work_item_uri,
                            type: 'Uri',
                        });

                    document['v-wf:isCompleted'] = ServerUtil.newBool(true);
                    document['v-s:isExecuted'] = ServerUtil.newBool(false);
                    document['v-s:created'] = ServerUtil.newDate(new Date());
                    is_completed = true;
                }
            }
        }

        if (workItemList.length > 0) {
            document['v-wf:workItemList'] = workItemList;
        }

        if (is_completed || workItemList.length > 0) {
            put_individual(ticket, document, _event_id);
        }
    } catch (e) {
        print(e.stack);
    }
};
