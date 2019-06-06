// Workflow engine

veda.Module(function (veda) { "use strict";

  veda.Workflow = veda.Workflow || {};

  /*
   *   обработка формы решения пользователя
   */
  veda.Workflow.prepare_decision_form = function (ticket, document, prev_state)
  {
      try
      {
          var decision_form = document;
          var prev_state_decision_form = prev_state;
          var f_prev_takenDecision = null;

          if (prev_state_decision_form)
        f_prev_takenDecision = prev_state_decision_form['v-wf:takenDecision'];

          var f_takenDecision = decision_form['v-wf:takenDecision'];

          if (!f_takenDecision && !f_prev_takenDecision)
              return;

      var enforce_processing = veda.Util.hasValue(decision_form, 'v-wf:enforceProcessing', {data: true, type: "Boolean"});
      if (f_prev_takenDecision && !enforce_processing)
      {
        if (!f_takenDecision)
        {
          veda.Util.set_err_on_indv("attempt clear decision[" + veda.Util.getUri(f_prev_takenDecision) + "], restore previous decision", document, "prepare decision form");
                veda.Util.set_field_to_document ('v-wf:takenDecision', f_prev_takenDecision, decision_form['@']);
        }
        else if (f_takenDecision.length != f_prev_takenDecision.length || veda.Util.getUri(f_takenDecision) != veda.Util.getUri(f_prev_takenDecision))
        {
          veda.Util.set_err_on_indv("attempt set another decision " + veda.Util.toJson (f_takenDecision) + ", restore previous decision", document, "prepare decision form");
                veda.Util.set_field_to_document ('v-wf:takenDecision', f_prev_takenDecision, decision_form['@']);
        }
        return;
      }

          if (decision_form['v-wf:isCompleted'] && decision_form['v-wf:isCompleted'][0].data == true)
              return;

          var f_onWorkOrder = document['v-wf:onWorkOrder'];
          var _work_order = get_individual(ticket, veda.Util.getUri(f_onWorkOrder));
          if (!_work_order)
          {
              veda.Util.set_err_on_indv("WorkOrder[" + veda.Util.getUri(f_onWorkOrder) + "], not found", document, "prepare decision form");
              return;
          }

          var f_executor = _work_order['v-wf:executor'];
          var executor;

          if (f_executor && f_executor.length > 0)
              executor = f_executor[0];

          //print ("@@@executor=", veda.Util.toJson (executor));
          //print("[WORKFLOW][DF1].1");

          var f_forWorkItem = _work_order['v-wf:forWorkItem'];
          var work_item = get_individual(ticket, veda.Util.getUri(f_forWorkItem));
          if (!work_item)
          {
              veda.Util.set_err_on_indv("invalid WorkOrder[" + veda.Util.getUri(f_onWorkOrder) + "], field v-wf:forWorkItem[" + veda.Util.getUri(f_forWorkItem) + "], not found", document, "prepare decision form");
              return;
          }

          var wi_isCompleted = work_item['v-wf:isCompleted'];
          if (wi_isCompleted)
          {
              if (wi_isCompleted[0].data === true)
              {
                  veda.Util.set_err_on_indv("WorkItem[" + veda.Util.getUri(f_forWorkItem) + "], already is completed, skip decision form...", document, "prepare decision form");
                  return;
              }
          }

          var forProcess = work_item['v-wf:forProcess'];
          var forProcess_uri = veda.Util.getUri(forProcess);
          var _process = get_individual(ticket, forProcess_uri);
          if (!_process)
          {
              veda.Util.set_err_on_indv("invalid WorkItem[" + veda.Util.getUri(f_forWorkItem) + "], field v-wf:forProcess[" + veda.Util.getUri(forProcess) + "], not found", document, "prepare decision form");
              return;
          }

          var isStopped = _process['v-wf:isStopped'];
          if (isStopped && isStopped[0].data === true)
              return;

          var trace_journal_uri = veda.Workflow.create_new_trace_subjournal(forProcess_uri, work_item, "prepare_decision_form:" + decision_form['@'], 'v-wf:DecisionFormStarted')

          //print("[WORKFLOW][DF1].2");

          var f_forNetElement = work_item['v-wf:forNetElement'];
          var net_element = get_individual(ticket, veda.Util.getUri(f_forNetElement));
          if (!net_element)
          {
              veda.Util.set_err_on_indv("invalid WorkItem[" + veda.Util.getUri(f_forWorkItem) + "], field v-wf:forNetElement[" + veda.Util.getUri(f_forNetElement) + "], not found", document, "prepare decision form");
              return;
          }

          //print("[WORKFLOW][DF1].3");

          var transform_link = veda.Util.getUri(net_element['v-wf:completeDecisionTransform']);
          if (!transform_link)
          {
              veda.Util.set_err_on_indv("invalid net_element[" + veda.Util.getUri(f_forNetElement) + "], field v-wf:completeDecisionTransform[" + transform_link + "], not found", document, "prepare decision form");
              return;
          }

          var transform = get_individual(ticket, transform_link);
          if (!transform)
          {
              veda.Util.set_err_on_indv("invalid net_element[" + veda.Util.getUri(f_forNetElement) + "], field v-wf:completeDecisionTransform[" + transform_link + "], not found", document, "prepare decision form");
              return;
          }

          //print("[WORKFLOW][DF1].4 document=", veda.Util.toJson(document));
          //print("[WORKFLOW][DF1].4 transform=", veda.Util.toJson(transform));
          //print("[WORKFLOW][DF1].4 _work_order=", veda.Util.toJson(_work_order));

          var process_output_vars = veda.Util.transformation(ticket, decision_form, transform, executor, f_onWorkOrder, forProcess);

          //print("[WORKFLOW][DF1].5 transform_result=", veda.Util.toJson(process_output_vars));
          var new_vars = veda.Workflow.store_items_and_set_minimal_rights(ticket, process_output_vars);

          if (process_output_vars.length > 0)
          {
              veda.Util.set_field_to_document ('v-wf:outVars', new_vars, _work_order['@']);
              _work_order['v-wf:outVars'] = new_vars;

              veda.Util.set_field_to_document ('v-wf:isCompleted', veda.Util.newBool(true), document['@']);

              //print("[WORKFLOW][DF1].5 completedExecutorJournalMap");
              veda.Workflow.mapToJournal(net_element['v-wf:completedExecutorJournalMap'], ticket, _process, work_item, _work_order, null, veda.Util.getJournalUri(_work_order['@']));
              //print("[WORKFLOW][DF1].6 completedExecutorJournalMap");
          }
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  /*
   *   обработка рабочего задания
   */
  veda.Workflow.prepare_work_order = function (ticket, document)
  {
      try
      {
          var _work_order = document;

          var f_executor = document['v-wf:executor'];
          var executor = get_individual(ticket, veda.Util.getUri(f_executor));
          if (f_executor && !executor) return;

          var f_forWorkItem = veda.Util.getUri(document['v-wf:forWorkItem']);
          var work_item = get_individual(ticket, f_forWorkItem);
          if (!work_item) return;

          var forProcess = work_item['v-wf:forProcess'];
          var forProcess_uri = veda.Util.getUri(forProcess);
          var _process = get_individual(ticket, forProcess_uri);
          if (!_process) return;

          var isStopped = _process['v-wf:isStopped'];
          if (isStopped && isStopped[0].data === true)
              return;

          var trace_journal_uri = veda.Workflow.create_new_trace_subjournal(f_forWorkItem, _work_order, "prepare_work_order:" + _work_order['@'], 'v-wf:WorkOrderStarted')
          if (trace_journal_uri)
              veda.Util.traceToJournal(ticket, trace_journal_uri, "обработка рабочего задания", veda.Util.toJson(document));

          var journal_uri;

          var f_inVars = work_item['v-wf:inVars'];
          if (!f_inVars)
              f_inVars = [];

          var f_process_inVars = _process['v-wf:inVars'];

          var forNetElement = work_item['v-wf:forNetElement'];
          var net_element = get_individual(ticket, veda.Util.getUri(forNetElement));
          if (!net_element) return;

          //    print ("[WORKFLOW] #1 net_element.uri=", net_element['@'], ", work_order=", veda.Util.toJson (_work_order));

          var f_local_outVars = document['v-wf:outVars'];
          var task_output_vars = [];

          var f_useSubNet = document['v-wf:useSubNet'];

          if (!f_local_outVars)
          {
              //      print ("[WORKFLOW] #2 net_element.uri=", net_element['@']);
              journal_uri = veda.Workflow.create_new_subjournal(f_forWorkItem, _work_order['@'], net_element['rdfs:label'], 'v-wf:WorkOrderStarted');

              if (!executor)
              {
                  veda.Workflow.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');
              }

              // берем только необработанные рабочие задания
              if (!executor)
              {
                  //print("[WORKFLOW][WO.2] executor not defined");

                  if (!net_element['v-wf:completedMapping'])
                  {
                      //print("[WORKFLOW][WO W6] v-wf:completedMapping not defined=", net_element['@']);
                      task_output_vars.push(
                      {
                          data: 'v-wf:complete',
                          type: "Uri"
                      });
                  }
                  else
                  {
                      // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                      task_output_vars = veda.Workflow.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, null, true, trace_journal_uri, 'v-wf:completedMapping');
                      //print("[PWO].completedMapping1, task_output_vars=", veda.Util.toJson(task_output_vars));
                  }

                  if (task_output_vars.length == 0)
                  {
                      task_output_vars.push(
                      {
                          data: 'v-wf:complete',
                          type: "Uri"
                      });
                  }
                  else
                  {
                      //veda.Workflow.mapToJournal(net_element['v-wf:completedJournalMap'], ticket, _process, work_item);
                  }

                  if (task_output_vars.length > 0)
                  {
                      document['v-wf:outVars'] = task_output_vars;
                      put_individual(ticket, document, _event_id);
                  }
              }
              else
              {
                  var is_appointment = veda.Util.hasValue(executor, "rdf:type", {data: "v-s:Appointment", type: "Uri"});
                  var is_position = veda.Util.hasValue(executor, "rdf:type", {data: "v-s:Position", type: "Uri"});
                  var is_codelet = veda.Util.hasValue(executor, "rdf:type", {data: "v-s:Codelet", type: "Uri"});

                  if (is_codelet)
                  {
                      veda.Workflow.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');

                      //print("[WORKFLOW][WO1.2] executor=" + veda.Util.getUri(f_executor) + ", is codelet");

                      var expression = veda.Util.getFirstValue(executor['v-s:script']);
                      if (!expression) return;

                      //print("[WORKFLOW][WO1.3] expression=" + expression);

                      var task = new veda.Workflow.Context(work_item, ticket);
                      var process = new veda.Workflow.Context(_process, ticket);
                      var codelet_output_vars = eval(expression);
                      if (codelet_output_vars && codelet_output_vars.length > 0)
                      {
                          var localVariablesUri = veda.Workflow.store_items_and_set_minimal_rights(ticket, codelet_output_vars);
                          _work_order['v-wf:outVars'] = localVariablesUri;
                          put_individual(ticket, _work_order, _event_id);
                      }
                      /*
                                     //print("[WORKFLOW][WO1.4] task: eval result=", veda.Util.toJson(result0));
                                      //print ("#2");
                                      //veda.Workflow.mapToJournal (net_element['v-wf:completedJournalMap'], ticket, _process, work_item);

                                      if (!net_element['v-wf:completedMapping'])
                                      {
                                         //print("[WORKFLOW][WO W6] v-wf:completedMapping not defined=", net_element['@']);
                                          task_output_vars.push(
                                          {
                                              data: 'v-wf:complete',
                                              type: "Uri"
                                          });
                                      }
                                      else
                                      {
                                     veda.Util.getValues(netElement['rdfs:label'])     // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                                          task_output_vars = veda.Workflow.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, result0, true, trace_journal_uri, 'v-wf:completedMapping');
                                          print("[PWO]completedMapping2, task_output_vars=", veda.Util.toJson(task_output_vars));
                                      }

                                      if (task_output_vars.length > 0)
                                      {
                                          document['v-wf:outVars'] = task_output_vars;
                                          put_individual(ticket, document, _event_id);
                                      }
                      */

                  } // end [is codelet]
                  else if ((is_appointment || is_position) && !f_useSubNet)
                  {
                      //print("[WORKFLOW][WO2] is USER, executor=" + veda.Util.getUri(f_executor));
                      //           //print("work_item.inVars=", veda.Util.toJson(f_inVars));
                      //           //print("process.inVars=", veda.Util.toJson(f_process_inVars));

                      var work_item_inVars = [];
                      for (var i = 0; i < f_inVars.length; i++)
                      {
                          var indv = get_individual(ticket, f_inVars[i].data);
                          work_item_inVars.push(indv);
                      }

                      var prev_task;
                      var i_work_item = work_item;

                      while (!prev_task)
                      {
                          var previousWorkItem_uri = veda.Util.getUri(i_work_item['v-wf:previousWorkItem']);
                          if (!previousWorkItem_uri)
                              break;

                          var previous_work_item = get_individual(ticket, previousWorkItem_uri);
                          if (!previous_work_item)
                              break;

                          var prev_forNetElement_uri = veda.Util.getUri(previous_work_item['v-wf:forNetElement']);
                          if (!prev_forNetElement_uri)
                              break;

                          var prev_forNetElement = get_individual(ticket, prev_forNetElement_uri);
                          if (!prev_forNetElement)
                              break;

                          if (prev_forNetElement['rdf:type'][0].data == 'v-wf:Task')
                          {
                              prev_task = previous_work_item['v-wf:forNetElement'];
                              break;
                          }
                          i_work_item = previous_work_item;
                      }

                      // ? или сделать curTask и prevTask только для трансформации ?
                      // ++ work_item_inVars: cur task id
                      var var_ctid = {
                          '@': '-',
                          'rdf:type': [
                          {
                              data: 'v-wf:Variable',
                              type: "Uri"
                          }],
                          'v-wf:variableName': [
                          {
                              data: "curTask",
                              type: "String"
                          }],
                          'v-wf:variableValue': forNetElement
                      };
                      work_item_inVars.push(var_ctid);

                      if (prev_task)
                      {
                          // ++ work_item_inVars: prev task id
                          var_ctid = {
                              '@': '-',
                              'rdf:type': [
                              {
                                  data: 'v-wf:Variable',
                                  type: "Uri"
                              }],
                              'v-wf:variableName': [
                              {
                                  data: "prevTask",
                                  type: "String"
                              }],
                              'v-wf:variableValue': prev_task
                          };
                          work_item_inVars.push(var_ctid);
                      }

                      //print("[WORKFLOW][WO2.0] transform_link=" + veda.Util.toJson(net_element['v-wf:startDecisionTransform']));
                      //print("[WORKFLOW][WO2.1] work_item_inVars=" + veda.Util.toJson(work_item_inVars));
                      //print ("@@@1 net_element['v-wf:startingExecutorJournalMap']=", veda.Util.toJson (net_element['v-wf:startingExecutorJournalMap']), ", @=", net_element['@']));
                      veda.Workflow.mapToJournal(net_element['v-wf:startingExecutorJournalMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingExecutorJournalMap');

                      var transform_link = veda.Util.getUri(net_element['v-wf:startDecisionTransform']);
                      if (!transform_link) return;
                      var transform = get_individual(ticket, transform_link);
                      if (!transform) return;

                      var transform_result = veda.Util.transformation(ticket, work_item_inVars, transform, f_executor, veda.Util.newUri(document['@']), forProcess);

                      if (trace_journal_uri)
                          veda.Util.traceToJournal(ticket, trace_journal_uri, "v-wf:startDecisionTransform", "transform_result=" + veda.Util.toJson(transform_result));

                      var decisionFormList = [];

                      if (transform_result)
                      {
                          for (var i = 0; i < transform_result.length; i++)
                          {
                              if (transform_result[i]['v-s:created'] == undefined)
                                  transform_result[i]['v-s:created'] = veda.Util.newDate(new Date());
                              else
                                  transform_result[i]['v-s:edited'] = veda.Util.newDate(new Date());

                              if (transform_result[i]['v-s:creator'] == undefined)
                                  transform_result[i]['v-s:creator'] = veda.Util.newUri('cfg:VedaSystem');

                              put_individual(ticket, transform_result[i], _event_id);
                              decisionFormList.push(
                              {
                                  data: transform_result[i]['@'],
                                  type: "Uri"
                              });

                              // выдадим права отвечающему на эту форму
                              if (is_appointment)
                              {
                                  //print("[WORKFLOW][WO2.2] appointment=" + veda.Util.toJson(executor));
                                  var employee = executor['v-s:employee'];
                                  if (employee)
                                  {
                                      //print("[WORKFLOW][WO2.2] employee=" + veda.Util.toJson(employee));
                                      veda.Util.addRight(ticket, employee[0].data, transform_result[i]['@'], ["v-s:canRead", "v-s:canUpdate"]);
                                  }
                                  var position = executor['v-s:occupation'];
                                  if (position)
                                  {
                                      //print("[WORKFLOW][WO2.2] position=" + veda.Util.toJson(position));
                                      veda.Util.addRight(ticket, position[0].data, transform_result[i]['@'], ["v-s:canRead", "v-s:canUpdate"]);
                                  }
                              }
                              if (is_position)
                              {
                                  veda.Util.addRight(ticket, executor['@'], transform_result[i]['@'], ["v-s:canRead", "v-s:canUpdate"]);
                              }
                          }
                      }

                      var add_to_document = {
                          '@': document['@'],
                          'v-wf:decisionFormList': decisionFormList
                      };
                      add_to_individual(ticket, add_to_document, _event_id);
                      _work_order['v-wf:decisionFormList'] = decisionFormList;

                      veda.Workflow.mapToMessage(net_element['v-wf:startingMessageMap'], ticket, _process, work_item, _work_order, null, journal_uri, trace_journal_uri, 'v-wf:startingMessageMap');
                  }

                  if ( (veda.Util.hasValue(executor, "rdf:type", {data: "v-wf:Net", type: "Uri"}) || f_useSubNet) && !is_codelet )
                  {
                      veda.Workflow.create_new_subprocess(ticket, f_useSubNet, f_executor, net_element, f_inVars, document, trace_journal_uri);

                      //print("[WORKFLOW][WO21-1]");
                  }
              }
          }

          var is_goto_to_next_task = false;

          // begin //////////////// скрипт сборки результатов (WorkOrder) ///////////////////////////////////////////
          var work_item_result = [];

          // найдем маппинг множественных результатов
          var wosResultsMapping = net_element['v-wf:wosResultsMapping'];

          var workOrderList = work_item['v-wf:workOrderList'];
          // проверяем есть ли результаты рабочих заданий
          if (workOrderList)
          {
              for (var i = 0; i < workOrderList.length; i++)
              {
                  //print("[WORKFLOW][WO3.0] workOrder=" + veda.Util.toJson(workOrderList[i]) + "");
                  var workOrder;
                  if (workOrderList[i].data != document['@'])
                      workOrder = get_individual(ticket, workOrderList[i].data);
                  else
                      workOrder = document;

                  //print("[WORKFLOW][WO3.1] workOrder=" + veda.Util.toJson(workOrder) + "");

                  var outVars = workOrder['v-wf:outVars'];
                  if (outVars)
                  {
                      var el = {};
                      el['workOrder'] = workOrder['@'];

                      var f_set = false;
                      for (var i1 = 0; i1 < outVars.length; i1++)
                      {
                          var _result = get_individual(ticket, outVars[i1].data);
                          //print("[WORKFLOW][WO3.2] _result=" + veda.Util.toJson(_result) + "");
                          if (_result)
                          {
                              if (wosResultsMapping)
                              {
                                  // wosResultsMapping указан
                              }
                              else
                              {
                                  // складываем все результаты в локальную переменную
                                  var key, val;
                                  var varName = _result["v-wf:variableName"];
                                  if (varName)
                                      key = varName[0].data;

                                  var varValue = _result["v-wf:variableValue"];
                                  if (varValue)
                                      val = varValue;

                                  if ( /*val !== undefined &&*/ key !== undefined)
                                  {
                                      el[key] = val;
                                      f_set = true;
                                  }
                                  //print("[WORKFLOW][WO3.3] el=" + veda.Util.toJson(el) + "");
                              }
                          }
                      }
                      if (f_set) work_item_result.push(el);

                  }

              }
          }
          if (work_item_result.length == workOrderList.length)
              is_goto_to_next_task = true;
          else
          {
              if (trace_journal_uri)
                  veda.Util.traceToJournal(ticket, trace_journal_uri, "[WO4.0] не все задания выполнены", "stop. work_item_result" + veda.Util.toJson(work_item_result) + ", workOrderList=", veda.Util.toJson(workOrderList));
          }

          // end //////////////// скрипт сборки результатов
          if (trace_journal_uri)
              veda.Util.traceToJournal(ticket, trace_journal_uri, "[WO4] work_item_result", veda.Util.toJson(work_item_result));

          var workItemList = [];

          if (is_goto_to_next_task)
          {
              journal_uri = veda.Util.getJournalUri(_work_order['@']);


              // переход к новой задаче  prepare[[wo][wo][wo]] ----> new [wi]

              if (work_item_result.length > 0)
              {
                  if (work_item_result[0]['complete'])
                  {
                      // если было пустое задание, то не журналируем
                  }
                  else
                  {
                      //print("[WORKFLOW][WO4.0.0] completedJournalMap");
                      veda.Workflow.mapToJournal(net_element['v-wf:completedJournalMap'], ticket, _process, work_item, null, net_element['rdfs:label'], journal_uri);
                  }
              }

              //print("[WORKFLOW][WO4.1] is_goto_to_next_task == true");
              if (net_element['v-wf:completedMapping'])
              {
                  // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                  task_output_vars = veda.Workflow.create_and_mapping_variables(ticket, net_element['v-wf:completedMapping'], _process, work_item, null, work_item_result, true, trace_journal_uri, 'v-wf:completedMapping');
              }

              //            if (task_output_vars.length > 0)
              //            {
              //                document['v-wf:outVars'] = task_output_vars;
              //                put_individual(ticket, document, _event_id);
              //            }

              // определим переход на следующие задачи в зависимости от результата
              // res должен быть использован при eval каждого из предикатов
              var hasFlows = net_element['v-wf:hasFlow'];
              if (hasFlows)
              {
                  //print("[WORKFLOW][WO4.4]");
                  var split = veda.Util.getUri(net_element['v-wf:split']);

                  for (var i = 0; i < hasFlows.length; i++)
                  {
                      var flow = get_individual(ticket, hasFlows[i].data);
                      if (!flow) continue;

                      //print("[WORKFLOW][WO6]:Flow: " + flow['@']);

                      var flowsInto = flow['v-wf:flowsInto'];
                      if (!flowsInto) continue;

                      var predicate = flow['v-wf:predicate'];
                      if (predicate)
                      {
                          //print("[WORKFLOW][WO8] predicate=" + veda.Util.toJson(predicate));
                          expression = veda.Util.getFirstValue(predicate);
                          //print("[WORKFLOW][WO8.1] work_item_result=" + veda.Util.toJson(work_item_result));
                          //print("[WORKFLOW][WO9] expression=" + veda.Util.toJson(expression));
                          if (expression)
                          {
                              try
                              {
                                  var task_result = new veda.Workflow.WorkItemResult(work_item_result);
                                  var task = new veda.Workflow.Context(work_item, ticket);
                                  var process = new veda.Workflow.Context(_process, ticket);
                                  var res1 = eval(expression);

                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "in flow expression", veda.Util.toJson(expression) + ", res =" + veda.Util.toJson(res1));

                                  if (res1 === true)
                                  {
                                      // выполним переход по XOR условию
                                      var nextNetElement = get_individual(ticket, veda.Util.getUri(flowsInto));

                                      if (nextNetElement)
                                      {
                                          //print("[WORKFLOW][WO10] create next work item for =" + nextNetElement['@']);
                                          var work_item_uri = veda.Workflow.create_work_item(ticket, forProcess_uri, nextNetElement['@'], work_item['@'], _event_id, trace_journal_uri);
                                          workItemList.push(
                                          {
                                              data: work_item_uri,
                                              type: "Uri"
                                          });
                                      }

                                      if (split == 'v-wf:XOR')
                                          break;
                                  }
                              }
                              catch (e)
                              {
                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "in flow expression", veda.Util.toJson(expression) + ", ", veda.Util.toJson(e.stack));

                                  print(e.stack);
                              }
                          }
                      }
                      else
                      {
                          if (!split || split == 'v-wf:None')
                          {
                              // условия нет, выполним переход
                              var nextNetElement = get_individual(ticket, veda.Util.getUri(flowsInto));

                              if (nextNetElement)
                              {
                                  //print("[WORKFLOW][WO11] create next work item for =" + nextNetElement['@']);
                                  var work_item_uri = veda.Workflow.create_work_item(ticket, forProcess_uri, nextNetElement['@'], work_item['@'], _event_id, trace_journal_uri);
                                  workItemList.push(
                                  {
                                      data: work_item_uri,
                                      type: "Uri"
                                  });
                              }
                          }


                      }

                  }
                  // }
              }

              work_item['v-wf:isCompleted'] = [
              {
                  data: true,
                  type: "Boolean"
              }];

              if (workItemList.length > 0)
                  work_item['v-wf:workItemList'] = workItemList;

              if (task_output_vars.length > 0)
                  work_item['v-wf:outVars'] = task_output_vars;

              put_individual(ticket, work_item, _event_id);
              //print("[WORKFLOW][WOe] update work_item=", veda.Util.toJson(work_item));

              veda.Workflow.remove_empty_branches_from_journal(journal_uri);
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /*
   *   обработка элемента сети
   *      1. слияние
   *      2. вычисление количества исполнителей, подготовка для них данных, запуск.
   *      3. обработка результатов, ветвление
   */
  veda.Workflow.prepare_work_item = function (ticket, document)
  {
      var work_item = document;

      try
      {
          var forProcess = veda.Util.getUri(work_item['v-wf:forProcess']);
          var _process = get_individual(ticket, forProcess);
          if (!_process) return;

          var instanceOf = veda.Util.getUri(_process['v-wf:instanceOf']);
          var _net = get_individual(ticket, instanceOf);
          if (!_net) return;

          var forNetElement = document['v-wf:forNetElement'];
          var netElement = get_individual(ticket, veda.Util.getUri(forNetElement));
          if (!netElement) return;

          var trace_journal_uri;

          var isCompleted = document['v-wf:isCompleted'];
          if (isCompleted)
          {
              if (isCompleted[0].data === true)
              {
                trace_journal_uri = veda.Workflow.get_trace_journal(document, _process)
                  if (trace_journal_uri)
                      veda.Util.traceToJournal(ticket, trace_journal_uri, "prepare_work_item:completed, exit", work_item['@']);

                  veda.Workflow.remove_empty_branches_from_journal(veda.Util.getJournalUri(work_item['@']));

                  return;
              }
          }

          trace_journal_uri = veda.Workflow.create_new_trace_subjournal(forProcess, work_item, netElement['@'] + "' - [" + veda.Util.getValues(netElement['rdfs:label']) + "] - " + work_item['@'], 'v-wf:WorkItemStarted')

          var f_join = netElement['v-wf:join'];
          if (f_join && veda.Util.getUri(f_join) == "v-wf:AND")
          {
              var in_flows = [];
              var task2flow = {};
              // найдем все flow входящие в эту задачу
              //  обойдем все элементы сети, если это flow и идет к текущей задаче, то берем
              var f_consistsOf = _net['v-wf:consistsOf'];
              if (f_consistsOf)
              {
                  for (var i = 0; i < f_consistsOf.length; i++)
                  {
                      var i_net_element = get_individual(ticket, f_consistsOf[i].data);
                      if (!i_net_element) continue;

                      if ( veda.Util.hasValue(i_net_element, "rdf:type", {data: "v-wf:Flow", type: "Uri"}) )
                      {
                          if (veda.Util.getUri(i_net_element["v-wf:flowsInto"]) == netElement['@'])
                          {
                              in_flows.push(i_net_element);
                              //print("[WORKFLOW][PW00.2] flow=", veda.Util.toJson (i_net_element));
                          }
                      }
                      else if ( veda.Util.hasValue(i_net_element, "rdf:type", {data: "v-wf:Task", type: "Uri"}) )
                      {
                          var f_hasFlow = i_net_element['v-wf:hasFlow'];
                          if (f_hasFlow)
                          {
                              for (var idx1 = 0; idx1 < f_hasFlow.length; idx1++)
                              {
                                  task2flow[f_hasFlow[idx1].data] = i_net_element['@'];
                              }
                          }
                      }
                  }
              }

              // нужно обойти все дерево и найти незавершенные WorkItem соответсвующие текущей net_element
              var fne = veda.Workflow.find_in_work_item_tree(ticket, _process, 'v-wf:forNetElement', veda.Util.getUri(forNetElement));
              if (fne.length > in_flows.length)
              {
                  print('ERR! AND join: check v-wf:consistsOf in net[' + instanceOf + '] for net element [' + veda.Util.getUri(forNetElement) + ']');
              }

              if (fne.length != in_flows.length)
                  return;

              // проверим соответствие найденных WorkItem со схемой
              var and_join_count_complete = 0;
              var isExecuted;

              for (var idx = 0; idx < in_flows.length; idx++)
              {
                  var shema_out_task = task2flow[in_flows[idx]['@']];
                  for (var idx1 = 0; idx1 < fne.length; idx1++)
                  {
                      var found_out_task = veda.Util.getUri(fne[idx1].parent['v-wf:forNetElement']);
                      isExecuted = fne[idx1].work_item['v-s:isExecuted']
                      //print ("[WORKFLOW] found_out_task=", veda.Util.toJson (fne[idx1].work_item));
                      if (isExecuted)
                      {
                          // встретился уже выполняемый work_item, по этой задаче, остальные отбрасываем
                          return;
                      }

                      if (shema_out_task == found_out_task)
                      {
                          and_join_count_complete++;
                          break;
                      }
                  }
              }

              //print ("[WORKFLOW] and_join_count_complete=", and_join_count_complete, ", in_flows.length=", in_flows.length);

              if (and_join_count_complete != in_flows.length)
                  return;

              //print ("[WORKFLOW] prepare_work_item uri=", document['@']);
              //print ("[WORKFLOW] and join is complete and_join_count_complete=", and_join_count_complete);
          }

          document['v-s:isExecuted'] = veda.Util.newBool(true);
          put_individual(ticket, document, _event_id);
          //print ("[WORKFLOW] UPDATE document=", veda.Util.toJson (document));

          var is_completed = false;
          var workItemList = [];

          var is_goto_to_next_task = false;
          var task_output_vars = [];

          var journal_uri;

          if ( veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:Task", type: "Uri"}) )
          {
              journal_uri = veda.Workflow.create_new_subjournal(forProcess, work_item['@'], netElement['rdfs:label'], 'v-wf:WorkItemStarted');

              if (trace_journal_uri)
                  veda.Util.traceToJournal(ticket, trace_journal_uri, "Is task");

              //* выполнить стартовый маппинг переменных
              var work_item__inVars = [];
              if (netElement['v-wf:startingMapping'])
              {
                  work_item__inVars = veda.Workflow.create_and_mapping_variables(ticket, netElement['v-wf:startingMapping'], _process, document, null, null, true, trace_journal_uri, 'v-wf:startingMapping');
                  if (work_item__inVars.length > 0)
                      document['v-wf:inVars'] = work_item__inVars;

                  //var ctx = new veda.Workflow.Context(document, ticket);
                  //ctx.print_variables('v-wf:inVars');
              }

              //* сформировать список исполнителей
              var executor_list = [];

              var f_subNet = netElement['v-wf:subNet'];
              var f_executor = netElement['v-wf:executor'];
              if (f_executor)
              {
                  for (var i = 0; i < f_executor.length; i++)
                  {
                      var executor = get_individual(ticket, f_executor[i].data);

                      if (!executor)
                      {
                          if (trace_journal_uri)
                              veda.Util.traceToJournal(ticket, trace_journal_uri, "исполнитель не найден", " uri=[" + f_executor[i].data + "]");
                      }
                      else
                      {
                          if ( veda.Util.hasValue(executor, "rdf:type", {data: "v-wf:ExecutorDefinition", type: "Uri"}) )
                          {
                              // определение исполнителей посредством скрипта

                              var expression = veda.Util.getFirstValue(executor['v-wf:executorExpression']);
                              if (!expression) return;

                              var task = new veda.Workflow.Context(document, ticket);
                              var process = new veda.Workflow.Context(_process, ticket);

                              try
                              {
                                  var result = eval(expression);

                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "определение исполнителя [" + expression + "]", "executors=" + veda.Util.toJson(result));

                                  if (result !== undefined && result.length > 0)
                                  {
                                      for (var i3 = 0; i3 < result.length; i3++)
                                      {
                                          // проверим, существует ли данный executor, если да, то добавим в список

                                          var real_executor = get_individual(ticket, result[i3].data);

                                          if (real_executor)
                                              executor_list.push(result[i3]);
                                      }
                                  }
                              }
                              catch (e)
                              {
                                  if (trace_journal_uri)
                                      veda.Util.traceToJournal(ticket, trace_journal_uri, "исполнители не были определены [" + expression + "]", e.stack);
                              }

                          }
                          else
                          {
                              if (trace_journal_uri)
                                  veda.Util.traceToJournal(ticket, trace_journal_uri, "установлен исполнитель ", "executor=" + veda.Util.toJson(f_executor[i].data));

                              executor_list.push(f_executor[i]);
                          }
                      }
                  }
              }
              else
              {
                  if (f_subNet)
                      executor_list.push(f_subNet[0]);
              }

              //* если не найдено ни одного исполнителя, то добавим null,
              //*   как индикатор для создания проходного(пустого) задания
              if (executor_list.length == 0)
                  executor_list.push(null);
              else
              {
                  veda.Workflow.mapToJournal(netElement['v-wf:startingJournalMap'], ticket, _process, document, null, netElement['rdfs:label'], journal_uri);
              }

              var work_order_list = [];
              var work_order_uri_list = [];

              //* сформировать задания для исполнителей
              for (var i = 0; i < executor_list.length; i++)
              {
                  var new_work_order_uri = veda.Util.genUri() + "-wo";

                  var new_work_order = {
                      '@': new_work_order_uri,
                      'rdf:type': [
                      {
                          data: 'v-wf:WorkOrder',
                          type: "Uri"
                      }],
                      'v-wf:forWorkItem': [
                      {
                          data: document['@'],
                          type: "Uri"
                      }]
                  };

                  if (f_subNet)
                      new_work_order['v-wf:useSubNet'] = f_subNet;

                  if (trace_journal_uri)
                      new_work_order['v-wf:isTrace'] = veda.Util.newBool(true);

                  if (executor_list[i] != null)
                      new_work_order['v-wf:executor'] = executor_list[i];

                  //print("[PWI02-1] new order =" + veda.Util.toJson(new_work_order));

                  work_order_list.push(new_work_order);
                  work_order_uri_list.push(
                  {
                      data: new_work_order_uri,
                      type: "Uri"
                  });

              }

              if (work_order_uri_list.length > 0)
                  document['v-wf:workOrderList'] = work_order_uri_list;

              if (work_item__inVars > 0 || work_order_uri_list.length > 0)
                  put_individual(ticket, document, _event_id);

              for (var i = 0; i < work_order_list.length; i++)
              {
                  put_individual(ticket, work_order_list[i], _event_id);
                  //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", work_order_list[i]['@'], ["v-s:canRead"]);
              }

          } // end [Task]
          else if ( veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:InputCondition", type: "Uri"}) || veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:Condition", type: "Uri"}) )
          {
              if (netElement['@'] == 's-wf:InterlayerNet_ic') {
                  var set_in_document = {
                      '@': _process['v-wf:executor'][0].data
                  };
                  set_in_document['v-wf:hasStatusWorkflow'] = veda.Util.newUri('v-wf:IsSent');
                  set_in_individual(ticket, set_in_document, _event_id);
              };
              is_goto_to_next_task = true;
          } // end [InputCondition]
          else if ( veda.Util.hasValue(netElement, "rdf:type", {data: "v-wf:OutputCondition", type: "Uri"}) )
          {
              if (trace_journal_uri)
                  veda.Util.traceToJournal(ticket, trace_journal_uri, "Is output condition ", "");

              //var process = new veda.Workflow.Context(_process, ticket);
              //process.print_variables('v-wf:inVars');
              //process.print_variables('v-wf:outVars');

              if (netElement['@'] == 's-wf:InterlayerNet_oc') {
                  var set_in_document = {
                      '@': _process['v-wf:executor'][0].data
                  };
                  set_in_document['v-wf:hasStatusWorkflow'] = veda.Util.newUri('v-wf:Completed');
                  set_in_individual(ticket, set_in_document, _event_id);
              };

              var f_parent_work_order = _process['v-wf:parentWorkOrder'];
              if (f_parent_work_order)
              {
                  var parent_work_order = get_individual(ticket, veda.Util.getUri(f_parent_work_order));
                  if (parent_work_order)
                  {
                      if (!_net['v-wf:completedMapping'])
                      {
                          task_output_vars.push(
                          {
                              data: 'v-wf:complete',
                              type: "Uri"
                          });
                      }
                      else
                      {
                          // сохраняем результаты в v-wf:outVars в обрабатываемом рабочем задании
                          task_output_vars = veda.Workflow.create_and_mapping_variables(ticket, _net['v-wf:completedMapping'], _process, work_item, null, null, true, trace_journal_uri, 'v-wf:completedMapping');
                      }

                      if (task_output_vars.length > 0)
                      {
                          parent_work_order['v-wf:outVars'] = task_output_vars;
                          put_individual(ticket, parent_work_order, _event_id);
                      }
                  }
              }


              is_completed = true;
              document['v-wf:isCompleted'] = [
              {
                  data: is_completed,
                  type: "Boolean"
              }];

              var completeProcess = {
                  '@': forProcess,
                  'v-wf:isCompleted': [
                  {
                      data: is_completed,
                      type: "Boolean"
                  }]
              };

              veda.Codelet.complete_process(ticket, _process, _event_id);
              set_in_individual(ticket, completeProcess, _event_id);

          } // end [OutputCondition]

          if (is_goto_to_next_task == true)
          {
              //print(":Is inputCondition or Condition");
              var hasFlows = netElement['v-wf:hasFlow'];
              if (hasFlows)
              {
                  for (var i = 0; i < hasFlows.length; i++)
                  {
                      var flow = get_individual(ticket, hasFlows[i].data);
                      if (!flow) continue;

                      ////print(":Flow: " + flow['@']);

                      var flowsInto = flow['v-wf:flowsInto'];
                      if (!flowsInto) continue;


                      var resultEval = true;
                      try {
                          var predicate = flow['v-wf:predicate'];
        if (predicate) {
                            var expression = veda.Util.getFirstValue(predicate);
                            //var task_result = new veda.Workflow.WorkItemResult(work_item_result);
                            var task = new veda.Workflow.Context(work_item, ticket);
                            var process = new veda.Workflow.Context(_process, ticket);
                            resultEval = eval(expression);
        }
                      } catch (e) {
                          print(e.stack);
                      }

                      if (!resultEval) continue;

                      var nextNetElement = get_individual(ticket, veda.Util.getUri(flowsInto));
                      if (!nextNetElement) continue;

                      var work_item_uri = veda.Workflow.create_work_item(ticket, forProcess, nextNetElement['@'], document['@'], _event_id, trace_journal_uri);
                      workItemList.push(
                      {
                          data: work_item_uri,
                          type: "Uri"
                      });

                      document['v-wf:isCompleted'] = veda.Util.newBool(true);
                      document['v-s:isExecuted'] = veda.Util.newBool(false);
                      document['v-s:created'] = veda.Util.newDate(new Date());
                      is_completed = true;
                      ////print("[WO12] document=", veda.Util.toJson(document));
                  }
              }
          }

          if (workItemList.length > 0)
              document['v-wf:workItemList'] = workItemList;

          if (is_completed == true || workItemList.length > 0)
          {
              put_individual(ticket, document, _event_id);
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /*
   *  обработка процесса
   */
  veda.Workflow.prepare_process = function (ticket, document)
  {
    var deleted = veda.Util.hasValue(document, 'v-s:deleted');
    var completed = veda.Util.hasValue(document, 'v-wf:isCompleted');
    if (completed || deleted) { return; }

    var _process = document;
    var trace_journal_uri = veda.Workflow.get_trace_journal(document, _process);

    if (trace_journal_uri) {
      veda.Util.traceToJournal(ticket, trace_journal_uri, "prepare_process", document['@']);
    }

    var inVars = _process['v-wf:inVars'] || [];

    var instanceOf = veda.Util.getUri( document['v-wf:instanceOf'] );
    var net = get_individual(ticket, instanceOf);
    if (!net) { return; }

    // создадим переменные с областью видимости данного процесса (v-wf:varDefineScope = v-wf:Net)
    var variables = net['v-wf:localVariable'];
    if (variables)
    {
      for (var i = 0; i < variables.length; i++)
      {
        var def_variable = get_individual(ticket, variables[i].data);
        if (!def_variable) { continue; }

        var variable_scope = veda.Util.getUri(def_variable['v-wf:varDefineScope']);
        if (!variable_scope) { continue; }

        if (variable_scope === 'v-wf:Net')
        {
          var new_variable = veda.Workflow.generate_variable(ticket, def_variable, null, document, null, null);
          if (new_variable)
          {
            put_individual(ticket, new_variable, _event_id);
            inVars.push(
            {
              data: new_variable['@'],
              type: "Uri"
            });
            //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_variable['@'], ["v-s:canRead"]);
          }
        }
      }
    }

    var workItemList = [];

    var f_consistsOf = net['v-wf:consistsOf'];
    if (f_consistsOf)
    {
      ////print("[PP05.0]");
      for (var i = 0; i < f_consistsOf.length; i++)
      {
        var element_uri = f_consistsOf[i].data;
        var element = get_individual(ticket, element_uri);
        if (!element) {
          print("NET ELEMENT UNDFINED:", element_uri);
          continue;
        }

        ////print("[PP05.1] net_consistsOf=", veda.Util.toJson(net_consistsOf));

        if ( veda.Util.hasValue(element, "rdf:type", {data: "v-wf:InputCondition", type: "Uri"}) )
        {
          var work_item_uri = veda.Workflow.create_work_item(ticket, document['@'], element_uri, null, _event_id, trace_journal_uri);

          ////print("[PP05.2]");

          workItemList.push({
            data: work_item_uri,
            type: "Uri"
          });

          break;
        }
      }
    }

    if (inVars.length > 0) {
      document['v-wf:inVars'] = inVars;
    }

    //var process = new veda.Workflow.Context(_process, ticket);
    //process.print_variables('v-wf:inVars');

    if (workItemList.length > 0) {
      document['v-wf:workItemList'] = workItemList;
    }

    document['v-wf:isCompleted'] = veda.Util.newBool(false);

    if (inVars.length > 0 || workItemList.length > 0) {
      put_individual(ticket, document, _event_id);
    }

    ////print("[PP0E]");
  };

  /*
   *  Обработка стартовой формы и создание экземпляра процесса.
   *  Условие запуска процесса: в стартовой форме не должно быть поля v-wf:isProcess.
   *  создается экземпляр v-wf:Process с заполненными переменными из текущей формы
   *  и экземпляр v-wf:WorkItem относящийся к v-wf:InputCondition
   */
  veda.Workflow.prepare_start_form = function (ticket, document)
  {
      // Если задача выдана из другой задачи, то заменить значение v-wf:processedDocument на значение v-wf:onDocument из исходной задачи
      var processedDocumentId;
      var processedDocumentValue;
      if ( document['v-wf:processedDocument'] ) {
        processedDocumentId = document['v-wf:processedDocument'][0].data;
        processedDocumentValue = document['v-wf:processedDocument'];
        var processedDocument = get_individual(ticket, processedDocumentId);
        if ( veda.Util.hasValue(processedDocument, "rdf:type", { data: "v-wf:DecisionForm", type: "Uri" } ) ) {
          processedDocumentId = processedDocument["v-wf:onDocument"] ? processedDocument["v-wf:onDocument"][0].data : processedDocument['@'];
          processedDocumentValue = processedDocument["v-wf:onDocument"] || [{ data: document['@'], type: "Uri" }];
          document['v-wf:processedDocument'] = processedDocumentValue;
          document["v-wf:hasParentTask"] = [{ data: processedDocument['@'], type: "Uri" }];
          processedDocument["v-wf:hasChildTask"] = (processedDocument["v-wf:hasChildTask"] || []).concat( veda.Util.newUri(document['@']) );
          put_individual(ticket, processedDocument, _event_id);
        }
      } else {
        processedDocumentId = document['@'];
        processedDocumentValue = [{ data: document['@'], type: "Uri" }];
      }

      var isTrace = document['v-wf:isTrace'];
      if (isTrace && veda.Util.getFirstValue(isTrace) == true)
          isTrace = true;
      else
          isTrace = false;

      var hasStatusWorkflowif = document['v-wf:hasStatusWorkflow'];
      if (hasStatusWorkflowif)
      {
          if (veda.Util.getUri(hasStatusWorkflowif) != 'v-wf:ToBeSent')
          {
              print("[WORKFLOW]:prepare_start_form, not ready to start.");
              return;
          }
      }
      else
          return;

      if (document['v-wf:isProcess'])
      {
          print("[WORKFLOW]:prepare_start_form, already started.");
          return;
      }

      // Include start form to processed document group
      if ( veda.Util.hasValue(document, "v-wf:processedDocument") ) {
        veda.Util.addToGroup(ticket, veda.Util.getUri(document["v-wf:processedDocument"]), document["@"], ["v-s:canRead"]);
      }

      var new_process_uri = veda.Util.genUri() + "-prs";

      var creator_f = document['v-s:creator'];

      var author_uri;
      if ( veda.Util.hasValue(document, "v-s:creator") ) {
        var creator_uri = document["v-s:creator"][0].data;
        var creator = get_individual(ticket, creator_uri);
        if ( veda.Util.hasValue(creator, "v-s:employee") ) {
          author_uri = creator["v-s:employee"][0].data;
        }
      }

      var forNet = document['v-wf:forNet'];
      var _net = get_individual(ticket, veda.Util.getUri(forNet));
      if (!_net) return;

      var new_vars = [];
      var transform_link = veda.Util.getUri(document['v-wf:useTransformation']);

      print('@js transform_link=', transform_link);

      if (transform_link)
      {
          var transform = get_individual(ticket, transform_link);
          if (!transform) return;

          // формируем входящие переменные для нового процесса
          var process_inVars = veda.Util.transformation(ticket, document, transform, null, null, veda.Util.newUri(new_process_uri));
          for (var i = 0; i < process_inVars.length; i++)
          {
              put_individual(ticket, process_inVars[i], _event_id);
              new_vars.push(
              {
                  data: process_inVars[i]['@'],
                  type: "Uri"
              });

              //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", process_inVars[i]['@'], ["v-s:canRead"]);
          }
      }

      var new_process = {
          '@': new_process_uri,
          'rdf:type': veda.Util.newUri('v-wf:Process'),
          'v-wf:instanceOf': forNet
      };
      new_process['rdfs:label'] = [
      {
          data: "экземпляр маршрута :" + veda.Util.getFirstValue(_net['rdfs:label']),
          type: "String"
      }];

      if (isTrace)
          new_process['v-wf:isTrace'] = veda.Util.newBool(true);

      if (new_vars.length > 0)
          new_process['v-wf:inVars'] = new_vars;

      new_process['v-wf:hasStartForm'] = veda.Util.newUri(document["@"]);

      var trace_journal_uri;

      if (isTrace)
      {
          trace_journal_uri = veda.Workflow.create_new_journal(ticket, veda.Util.getTraceJournalUri(new_process_uri), veda.Util.getJournalUri(processedDocumentId), _net['rdfs:label'], true);

          if (trace_journal_uri)
          {
              veda.Util.traceToJournal(ticket, trace_journal_uri, "started new process", veda.Util.toJson(new_process));
              new_process['v-wf:traceJournal'] = veda.Util.newUri(trace_journal_uri);
          }
      }

      put_individual(ticket, new_process, _event_id);

      var jrn_processed_doc_uri = veda.Util.getJournalUri(processedDocumentId)

      if (!get_individual(ticket, jrn_processed_doc_uri))
      {
        var jrn_processed_doc = {
          '@': jrn_processed_doc_uri,
          'rdf:type': veda.Util.newUri('v-s:Journal'),
          'v-s:onDocument': processedDocumentValue,
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
        };
        put_individual(ticket, jrn_processed_doc, _event_id);
      }

      veda.Workflow.create_new_journal(ticket, veda.Util.getJournalUri(new_process_uri), jrn_processed_doc_uri, _net['rdfs:label']);

      var jrId = veda.Util.genUri() + "-psr";
      var journalRecord = {
          '@': jrId,
          'rdf:type': veda.Util.newUri('v-s:ProcessStarted'),
          'v-s:processJournal': veda.Util.newUri(veda.Util.getJournalUri(new_process_uri)),
          'v-wf:onProcess': veda.Util.newUri(new_process_uri),
          'v-s:onDocument': processedDocumentValue,
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
         };

      //    var user = get_individual(ticket, author_uri);
      //    if (user['v-s:hasAppointment'])
      //    {
      if (creator_f)
          journalRecord['v-s:actor'] = creator_f;
      //    }

      put_individual(ticket, journalRecord, _event_id);

      var membership = {
          '@': veda.Util.genUri() + "-mbh",
          'rdf:type': veda.Util.newUri('v-s:Membership'),
          'v-s:resource': veda.Util.newUri(new_process_uri),
          'v-s:memberOf': processedDocumentValue,
          'rdfs:comment': veda.Util.newStr('Process is in document group')
      };
      put_individual(ticket, membership, _event_id);

      add_to_individual(ticket,
      {
          '@': processedDocumentId + 'j',
          'v-s:childRecord': veda.Util.newUri(jrId)
      }, _event_id);

      document['v-wf:hasStatusWorkflow'] = veda.Util.newUri('v-wf:IsSent');
      document['v-wf:hasStartForm'] = veda.Util.newUri(document["@"]);
      document['v-wf:isProcess'] = (document['v-wf:isProcess'] || []).concat( veda.Util.newUri(new_process_uri) );
      put_individual(ticket, document, _event_id);

      // возьмем автора формы и выдадим ему полные права на процесс
      if (author_uri)
          veda.Util.addRight(ticket, author_uri, new_process_uri, ["v-s:canRead", "v-s:canUpdate", "v-s:canDelete"]);

      veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_process_uri, ["v-s:canRead"]);
  };

});
