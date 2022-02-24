// Workflow engine

import Codelet from '../server/codelet.js';

import CommonUtil from '../common/util.js';

import ServerUtil from '../server/util.js';

import WorkflowUtil from '../server/workflow_util.js';

const Workflow = {};

export default Workflow;

/*
 *   обработка формы решения пользователя
 */
Workflow.prepare_decision_form = function (ticket, document, prev_state) {
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

    const process_output_vars = ServerUtil.transformation(ticket, decision_form, transform, executor, f_onWorkOrder, forProcess);

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

/*
 *   обработка рабочего задания
 */
Workflow.prepare_work_order = function (ticket, document) {
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
        } else if ((is_appointment || is_position) && !f_useSubNet) {
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

          const transform_result = ServerUtil.transformation(ticket, work_item_inVars, transform, f_executor, ServerUtil.newUri(document['@']), forProcess);

          if (trace_journal_uri) {
            ServerUtil.traceToJournal(ticket, trace_journal_uri, 'v-wf:startDecisionTransform', 'transform_result=' + CommonUtil.toJson(transform_result));
          }

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
              if (is_position) {
                ServerUtil.addRight(ticket, executor['@'], result['@'], ['v-s:canRead', 'v-s:canUpdate']);
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
          workOrder = get_individual(ticket, workOrder.data);
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

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 *   обработка элемента сети
 *      1. слияние
 *      2. вычисление количества исполнителей, подготовка для них данных, запуск.
 *      3. обработка результатов, ветвление
 */
Workflow.prepare_work_item = function (ticket, document) {
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

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 *  обработка процесса
 */
Workflow.prepare_process = function (ticket, document) {
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

/*
 *  Обработка стартовой формы и создание экземпляра процесса.
 *  Условие запуска процесса: в стартовой форме не должно быть поля v-wf:isProcess.
 *  создается экземпляр v-wf:Process с заполненными переменными из текущей формы
 *  и экземпляр v-wf:WorkItem относящийся к v-wf:InputCondition
 */
Workflow.prepare_start_form = function (ticket, document) {
  // Если задача выдана из другой задачи, то заменить значение v-wf:processedDocument на значение v-wf:onDocument из исходной задачи
  let processedDocumentId;
  let processedDocumentValue;
  if ( document['v-wf:processedDocument'] ) {
    processedDocumentId = document['v-wf:processedDocument'][0].data;
    processedDocumentValue = document['v-wf:processedDocument'];
    const processedDocument = get_individual(ticket, processedDocumentId);
    if ( CommonUtil.hasValue(processedDocument, 'rdf:type', {data: 'v-wf:DecisionForm', type: 'Uri'} ) ) {
      processedDocumentId = processedDocument['v-wf:onDocument'] ? processedDocument['v-wf:onDocument'][0].data : processedDocument['@'];
      processedDocumentValue = processedDocument['v-wf:onDocument'] || [{data: document['@'], type: 'Uri'}];
      document['v-wf:processedDocument'] = processedDocumentValue;
      document['v-wf:hasParentTask'] = [{data: processedDocument['@'], type: 'Uri'}];
      processedDocument['v-wf:hasChildTask'] = (processedDocument['v-wf:hasChildTask'] || []).concat( ServerUtil.newUri(document['@']) );
      put_individual(ticket, processedDocument, _event_id);
    }
  } else {
    processedDocumentId = document['@'];
    processedDocumentValue = [{data: document['@'], type: 'Uri'}];
  }

  let isTrace = document['v-wf:isTrace'];
  if (isTrace && ServerUtil.getFirstValue(isTrace) === true) {
    isTrace = true;
  } else {
    isTrace = false;
  }

  const cur_doc = get_individual(ticket, document['@']);

  const hasStatusWorkflowif = cur_doc['v-wf:hasStatusWorkflow'];
  if (hasStatusWorkflowif) {
    if (ServerUtil.getUri(hasStatusWorkflowif) != 'v-wf:ToBeSent') {
      print('[WORKFLOW]:prepare_start_form, not ready to start.');
      return;
    }
  } else {
    return;
  }

  if (cur_doc['v-wf:isProcess']) {
    print('[WORKFLOW]:prepare_start_form, already started.');
    return;
  }

  // Include start form to processed document group
  if ( CommonUtil.hasValue(document, 'v-wf:processedDocument') ) {
    ServerUtil.addToGroup(ticket, ServerUtil.getUri(document['v-wf:processedDocument']), document['@'], ['v-s:canRead']);
  }

  const new_process_uri = CommonUtil.genUri() + '-prs';

  const creator_f = document['v-s:creator'];

  let author_uri;
  if ( CommonUtil.hasValue(document, 'v-s:creator') ) {
    const creator_uri = document['v-s:creator'][0].data;
    const creator = get_individual(ticket, creator_uri);
    if ( CommonUtil.hasValue(creator, 'v-s:employee') ) {
      author_uri = creator['v-s:employee'][0].data;
    }
  }

  const forNet = document['v-wf:forNet'];
  const _net = get_individual(ticket, ServerUtil.getUri(forNet));
  if (!_net) return;

  const new_vars = [];
  const transform_link = ServerUtil.getUri(document['v-wf:useTransformation']);

  print('@js transform_link=', transform_link);

  if (transform_link) {
    const transform = get_individual(ticket, transform_link);
    if (!transform) return;

    // формируем входящие переменные для нового процесса
    const process_inVars = ServerUtil.transformation(ticket, document, transform, null, null, ServerUtil.newUri(new_process_uri));
    for (const process_inVar of process_inVars) {
      put_individual(ticket, process_inVar, _event_id);
      new_vars.push(
        {
          data: process_inVar['@'],
          type: 'Uri',
        });
    }
  }

  const new_process = {
    '@': new_process_uri,
    'rdf:type': ServerUtil.newUri('v-wf:Process'),
    'v-wf:instanceOf': forNet,
  };
  new_process['rdfs:label'] = [
    {
      data: 'экземпляр маршрута :' + ServerUtil.getFirstValue(_net['rdfs:label']),
      type: 'String',
    }];

  if (isTrace) {
    new_process['v-wf:isTrace'] = ServerUtil.newBool(true);
  }

  if (new_vars.length > 0) {
    new_process['v-wf:inVars'] = new_vars;
  }

  new_process['v-wf:hasStartForm'] = ServerUtil.newUri(document['@']);

  let trace_journal_uri;

  if (isTrace) {
    trace_journal_uri = WorkflowUtil.create_new_journal(ticket, ServerUtil.getTraceJournalUri(new_process_uri), ServerUtil.getJournalUri(processedDocumentId), _net['rdfs:label'], true);

    if (trace_journal_uri) {
      ServerUtil.traceToJournal(ticket, trace_journal_uri, 'started new process', CommonUtil.toJson(new_process));
      new_process['v-wf:traceJournal'] = ServerUtil.newUri(trace_journal_uri);
    }
  }

  put_individual(ticket, new_process, _event_id);

  const jrn_processed_doc_uri = ServerUtil.getJournalUri(processedDocumentId);

  if (!get_individual(ticket, jrn_processed_doc_uri)) {
    const jrn_processed_doc = {
      '@': jrn_processed_doc_uri,
      'rdf:type': ServerUtil.newUri('v-s:Journal'),
      'v-s:onDocument': processedDocumentValue,
      'v-s:created': [
        {
          data: new Date(),
          type: 'Datetime',
        }],
    };
    put_individual(ticket, jrn_processed_doc, _event_id);
  }

  WorkflowUtil.create_new_journal(ticket, ServerUtil.getJournalUri(new_process_uri), jrn_processed_doc_uri, _net['rdfs:label']);

  const jrId = CommonUtil.genUri() + '-psr';
  const journalRecord = {
    '@': jrId,
    'rdf:type': ServerUtil.newUri('v-s:ProcessStarted'),
    'v-s:processJournal': ServerUtil.newUri(ServerUtil.getJournalUri(new_process_uri)),
    'v-wf:onProcess': ServerUtil.newUri(new_process_uri),
    'v-s:onDocument': processedDocumentValue,
    'v-s:created': [
      {
        data: new Date(),
        type: 'Datetime',
      }],
  };

  if (creator_f) {
    journalRecord['v-s:actor'] = creator_f;
  }

  put_individual(ticket, journalRecord, _event_id);

  const membership = {
    '@': CommonUtil.genUri() + '-mbh',
    'rdf:type': ServerUtil.newUri('v-s:Membership'),
    'v-s:resource': ServerUtil.newUri(new_process_uri),
    'v-s:memberOf': processedDocumentValue,
    'rdfs:comment': ServerUtil.newStr('Process is in document group'),
  };
  put_individual(ticket, membership, _event_id);

  add_to_individual(ticket,
    {
      '@': processedDocumentId + 'j',
      'v-s:childRecord': ServerUtil.newUri(jrId),
    }, _event_id);

  document['v-wf:hasStatusWorkflow'] = ServerUtil.newUri('v-wf:IsSent');
  document['v-wf:hasStartForm'] = ServerUtil.newUri(document['@']);
  document['v-wf:isProcess'] = (document['v-wf:isProcess'] || []).concat( ServerUtil.newUri(new_process_uri) );
  put_individual(ticket, document, _event_id);

  // возьмем автора формы и выдадим ему полные права на процесс
  if (author_uri) {
    ServerUtil.addRight(ticket, author_uri, new_process_uri, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
  }

  ServerUtil.addRight(ticket, 'v-wf:WorkflowReadUser', new_process_uri, ['v-s:canRead']);
};
