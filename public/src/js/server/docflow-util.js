// Workflow engine utilities

veda.Module(function (veda) { "use strict";

  veda.Workflow = veda.Workflow || {};

  veda.Workflow.create_work_item = function (ticket, process_uri, net_element_uri, parent_uri, _event_id, isTrace)
  {
      try
      {
          var new_uri = veda.Util.genUri() + "-wit";
          var new_work_item = {
              '@': new_uri,
              'rdf:type': [
              {
                  data: 'v-wf:WorkItem',
                  type: "Uri"
              }],
              'v-wf:forProcess': [
              {
                  data: process_uri,
                  type: "Uri"
              }],
              'v-wf:forNetElement': [
              {
                  data: net_element_uri,
                  type: "Uri"
              }],
            'v-s:created': [
            {
            data: new Date(),
            type: "Datetime"
              }],
            'v-s:creator': [
            {
            data: 'cfg:VedaSystem',
            type: "Uri"
              }]
          };

          if (isTrace)
              new_work_item['v-wf:isTrace'] = veda.Util.newBool(true);

          if (parent_uri !== null)
          {
              new_work_item['v-wf:previousWorkItem'] = [
              {
                  data: parent_uri,
                  type: "Uri"
              }];
          }

          //print("[WORKFLOW]:create work item:" + new_uri);

          put_individual(ticket, new_work_item, _event_id);

          //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_uri, ["v-s:canRead"]);

          return new_uri;
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  veda.Workflow.WorkItemResult = function (_work_item_result)
  {
      this.work_item_result = _work_item_result;

      /////////////////////////// functions prepare work_item_result
      this.getValue = function(var_name)
      {
          for (var i in this.work_item_result)
          {
              return this.work_item_result[i][var_name];
          }
      };

      this.compare = function(var_name, value)
      {
          if (!value || value.length < 1)
              return false;

          //print ("@@@compareTaskResult this.work_item_result=", veda.Util.toJson (this.work_item_result));
          //print ("@@@compareTaskResult value=", veda.Util.toJson (value));
          //print ("@@@compareTaskResult var_name=", veda.Util.toJson (var_name));
          if (!this.work_item_result || this.work_item_result.length == 0)
              return false;

          //  print ("@@@compareTaskResult 1");
          var true_count = 0;
          for (var i in this.work_item_result)
          {
              //  print ("@@@compareTaskResult 2");
              var wirv = this.work_item_result[i][var_name];
              if (wirv && wirv.length == value.length)
              {
                  //  print ("@@@compareTaskResult 3");
                  for (var j in wirv)
                  {
                      //  print ("@@@compareTaskResult 4");
                      for (var k in value)
                      {
                          if (wirv[j].data == value[k].data && wirv[j].type == value[k].type)
                              true_count++;

                      }
                      if (true_count == value.length)
                          return true;
                  }
              }
          }

          return false;
      };

      this.is_exists_result = function()
      {
          if (!this.work_item_result || this.work_item_result.length < 1)
              return false;

          for (var i = 0; i < this.work_item_result.length; i++)
          {
              if (this.work_item_result[i].result)
                  return true;
          }

          return false;
      }

      this.is_all_executors_taken_decision = function(var_name, value)
      {
          //print('BLABLABLA > '+veda.Util.toJson(this));
          if (!value || value.length < 1)
              return false;

          var count_agreed = 0;
          for (var i = 0; i < this.work_item_result.length; i++)
          {
              var wirv = this.work_item_result[i][var_name];

              //print("@@@is_all_executors_taken_decision: wiri=" + veda.Util.toJson(wirv), ", value=", veda.Util.toJson(value));

              if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type)
                  count_agreed++;
          }

          if (count_agreed == this.work_item_result.length)
          {
              //print("@@@is_some_executor_taken_decision: TRUE");
              return true;
          }
          else
              return false;

      };

      this.is_some_executor_taken_decision = function(var_name, value)
      {
          if (!value || value.length < 1)
              return false;

          for (var i = 0; i < this.work_item_result.length; i++)
          {
              var wirv = this.work_item_result[i][var_name];

              //print("@@@is_some_executor_taken_decision: wiri=" + veda.Util.toJson(wirv), ", value=", veda.Util.toJson(value));

              if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type)
              {
                  //print("@@@is_some_executor_taken_decision: TRUE");
                  return true;
              }
          }

          return false;
      }


  };

  veda.Workflow.is_some_content_value = function (src, b)
  {
      for (var i = 0; i < src.length; i++)
      {
          for (var j = 0; j < b.length; j++)
          {
              if (src[i].type == b[j].type && src[i].data == b[j].data)
              {
                  //          print("@@@is_some_content_value: TRUE");
                  return true;
              }
          }
      }

      //          print("@@@is_some_content_value: FALSE");
      return false;
  };


  veda.Workflow.Context = function (_src_data, _ticket)
  {
      this.src_data = _src_data;
      this.ticket = _ticket;

    this.getDecisionForms = function()
    {
          return this.src_data['v-wf:decisionFormList'];
    };

      this.getExecutor = function()
      {
          return this.src_data['v-wf:executor'];
      };

      this.getLabel = function()
      {
          return this.src_data['rdfs:label'];
      };

      this.get_results = function()
      {
          return this.src_data;
      };

      this.if_all_executors_taken_decision = function(true_decision, false_decision)
      {
          try
          {
              var count_agreed = 0;
              for (var i = 0; i < this.src_data.length; i++)
              {
                  //     print ("data[i].result=", data[i].result);
                  if (this.src_data[i].result == true_decision)
                  {
                      count_agreed++;
                  }
              }

              if (count_agreed == this.src_data.length)
              {
                  return [
                  {
                      'data': true_decision,
                      'type': "Uri"
                  }];
              }
              else
              {
                  return [
                  {
                      'data': false_decision,
                      'type': "Uri"
                  }];
              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

      };

      this.getInputVariable = function(var_name)
      {
          return this.getVariableValueIO(var_name, 'v-wf:inVars');
      }

      this.getLocalVariable = function(var_name)
      {
          return this.getVariableValueIO(var_name, 'v-wf:localVars');
      }

      this.getOutVariable = function(var_name)
      {
          return this.getVariableValueIO(var_name, 'v-wf:outVars');
      }

      this.getVariableValueIO = function(var_name, io)
      {
          try
          {
              //          print ("CONTEXT::getVariableValueIO src_data=" + veda.Util.toJson (this.src_data));
              var variables = this.src_data[io];

              if (variables)
              {
                  for (var i = 0; i < variables.length; i++)
                  {
                      var variable = get_individual(this.ticket, variables[i].data);
                      if (!variable) continue;
                      //print ("CONTEXT::getVariableValueIO var=" + veda.Util.toJson (variable));

                      var variable_name = veda.Util.getFirstValue(variable['v-wf:variableName']);

                      //print("[WORKFLOW]:getVariableIO #0: work_item=" + this.src_data['@'] + ", var_name=" + variable_name + ", val=" + veda.Util.toJson(variable['v-wf:variableValue']));

                      if (variable_name == var_name)
                      {
                          var val = variable['v-wf:variableValue'];

                          //print("[WORKFLOW]:getVariableValue #1: work_item=" + this.src_data['@'] + ", var_name=" + var_name + ", val=" + veda.Util.toJson(val)); // + ", variable=" + veda.Util.toJson (variable));
                          return val;
                      }
                  }

              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

          //print("[WORKFLOW]:getVariableValue: work_item=" + this.src_data['@'] + ", var_name=" + var_name + ", val=undefined");
      };

      this.print_variables = function(io)
      {
          try
          {
              var variables = this.src_data[io];

              if (variables)
              {
                  for (var i = 0; i < variables.length; i++)
                  {
                      var variable = get_individual(this.ticket, variables[i].data);
                      if (!variable) continue;

                      var variable_name = veda.Util.getFirstValue(variable['v-wf:variableName']);

                      //print("[WORKFLOW]:print_variable: work_item=" + this.src_data['@'] + ", var_name=" + variable_name + ", val=" + veda.Util.toJson(variable['v-wf:variableValue']));
                  }

              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

      };

      this.get_result_value = function(field1, type1)
      {
          try
          {
              if (this.src_data && this.src_data.length > 0)
              {
                  var rr = this.src_data[0][field1];
                  if (rr)
                      return [
                      {
                          'data': rr,
                          'type': type1
                      }];
                  else
                      return null;
              }
          }
          catch (e)
          {
              print(e.stack);
              return false;
          }

      };
  };

  veda.Workflow.get_new_variable = function (variable_name, value) {
    try {
      var new_uri = veda.Util.genUri() + "-var";
      var new_variable = {
        '@': new_uri,
        'rdf:type': [{
          data: 'v-wf:Variable',
          type: "Uri"
        }],
        'v-wf:variableName': [{
          data: variable_name,
          type: "String"
        }],
        'v-s:created': [{
          data: new Date(),
          type: "Datetime"
        }]
      };
      if (value) { new_variable['v-wf:variableValue'] = value; }
      return new_variable;

    } catch (e) {
      print(e.stack);
      throw e;
    }
  };

  veda.Workflow.store_items_and_set_minimal_rights = function (ticket, data)
  {
      try
      {
          var ids = [];
          for (var i = 0; i < data.length; i++)
          {
              if (data[i]['v-s:created'] == undefined)
                  data[i]['v-s:created'] = veda.Util.newDate(new Date());
              else
                  data[i]['v-s:edited'] = veda.Util.newDate(new Date());

              if (data[i]['v-s:creator'] == undefined)
                  data[i]['v-s:creator'] = veda.Util.newUri('cfg:VedaSystem');

              put_individual(ticket, data[i], _event_id);

              ids.push(
              {
                  data: data[i]['@'],
                  type: "Uri"
              });

              veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", data[i]['@'], ["v-s:canRead"]);
          }
          return ids;
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  veda.Workflow.generate_variable = function (ticket, def_variable, value, _process, _task, _task_result)
  {
      try
      {
          var variable_name = veda.Util.getFirstValue(def_variable['v-wf:varDefineName']);

          //print("[WORKFLOW][generate_variable]: variable_define_name=" + variable_name);
          var new_variable = veda.Workflow.get_new_variable(variable_name, value)

          var variable_scope = veda.Util.getUri(def_variable['v-wf:varDefineScope']);
          if (variable_scope)
          {
              var scope;
              if (variable_scope == 'v-wf:Net')
                  scope = _process['@'];

              if (scope)
              {
                  new_variable['v-wf:variableScope'] = [
                  {
                      data: scope,
                      type: "Uri"
                  }];

                  var local_vars = _process['v-wf:localVars'];
                  var find_local_var;
                  if (local_vars)
                  {
                      //print("[WORKFLOW][generate_variable]: ищем переменную [", variable_name, "] среди локальных процесса:" + _process['@'] + ", local_vars=", veda.Util.toJson (local_vars));

                      // найдем среди локальных переменных процесса, такую переменную
                      // если нашли, то новая переменная должна перезаписать переменную процесса
                      for (var i = 0; i < local_vars.length; i++)
                      {
                          //print ("@@ local_var_uri=", veda.Util.toJson (local_vars[i]));
                          var local_var = get_individual(ticket, local_vars[i].data);
                          if (!local_var) continue;

                          //print ("@@ local_var=", veda.Util.toJson (local_var));

                          var var_name = veda.Util.getFirstValue(local_var['v-wf:variableName']);
                          if (!var_name) continue;

                          if (var_name == variable_name)
                          {
                              find_local_var = local_var;
                              break;
                          }
                      }

                      if (find_local_var)
                      {
                          // нашли, обновим значение в локальной переменной
                          find_local_var['v-wf:variableValue'] = value;
                          //            print ("find_local_var=", veda.Util.toJson (find_local_var));
                          put_individual(ticket, find_local_var, _event_id);

                          //                        new_variable['@'] = find_local_var['@'];
                      }
                  }
                  else
                      local_vars = [];

                  if (!find_local_var)
                  {
                      //print("[WORKFLOW][generate_variable]: переменная [", variable_name, "] не, найдена, привязать новую к процессу:" + _process['@']);

                      // если не нашли то сделать копию и привязать ее переменную к процессу
                      var new_variable_for_local = veda.Workflow.get_new_variable(variable_name, value)
                      put_individual(ticket, new_variable_for_local, _event_id);

                      var add_to_document = {
                          '@': _process['@'],
                          'v-wf:localVars': [
                          {
                              data: new_variable_for_local['@'],
                              type: "Uri"
                          }]
                      };
                      add_to_individual(ticket, add_to_document, _event_id);

                      local_vars.push(veda.Util.newUri(new_variable_for_local['@'])[0]);
                      _process['v-wf:localVars'] = local_vars;

                      //print("[WORKFLOW][generate_variable]: _process= ", veda.Util.toJson (_process['v-wf:localVars']));
                  }

              }
          }

          //print("[WORKFLOW][generate_variable]: new variable: " + veda.Util.toJson(new_variable));

          return new_variable;
      }
      catch (e)
      {
          print(e.stack);
          throw e;
      }

  };

  veda.Workflow.create_and_mapping_variables = function (ticket, mapping, _process, _task, _order, _task_result, f_store, trace_journal_uri, trace_comment)
  {
      try
      {
          var _trace_info = [];

          var new_vars = [];
          if (!mapping) return [];

          var process;
          var task;
          var order;
          var task_result;

          if (_process)
              process = new veda.Workflow.Context(_process, ticket);

          if (_task)
              task = new veda.Workflow.Context(_task, ticket);

          if (_order)
              order = new veda.Workflow.Context(_order, ticket);

          if (_task_result)
              task_result = new veda.Workflow.WorkItemResult(_task_result);

          // print("[WORKFLOW][create_and_mapping_variables]: process=" + veda.Util.toJson (process));
          // print("[WORKFLOW][create_and_mapping_variables]: task=" + veda.Util.toJson (task));
          // print("[WORKFLOW][create_and_mapping_variables]: order=" + veda.Util.toJson (order));
          // print("[WORKFLOW][create_and_mapping_variables]: task_result=" + veda.Util.toJson (task_result));

          for (var i = 0; i < mapping.length; i++)
          {
              var map = get_individual(ticket, mapping[i].data);

              if (map)
              {
                  //print("[WORKFLOW][create_and_mapping_variables]: map_uri=" + map['@']);
                  var expression = veda.Util.getFirstValue(map['v-wf:mappingExpression']);
                  if (!expression) continue;

                  //print("[WORKFLOW][create_and_mapping_variables]: expression=" + expression);
                  try
                  {
                      var res1 = eval(expression);
                      //print("[WORKFLOW][create_and_mapping_variables]: res1=" + veda.Util.toJson(res1));
                      if (!res1) continue;

                      var mapToVariable_uri = veda.Util.getUri(map['v-wf:mapToVariable']);
                      if (!mapToVariable_uri) continue;

                      var def_variable = get_individual(ticket, mapToVariable_uri);
                      if (!def_variable) continue;

                      var new_variable = veda.Workflow.generate_variable(ticket, def_variable, res1, _process, _task, _task_result);
                      if (new_variable)
                      {
                          if (f_store == true)
                          {
                              put_individual(ticket, new_variable, _event_id);

                              if (trace_journal_uri)
                                  _trace_info.push(new_variable);

                              new_vars.push(
                              {
                                  data: new_variable['@'],
                                  type: "Uri"
                              });
                              //veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_variable['@'], ["v-s:canRead"]);

                          }
                          else
                          {
                              new_vars.push(new_variable);
                          }
                      }
                  }
                  catch (e)
                  {
                      if (trace_journal_uri)
                          veda.Util.traceToJournal(ticket, trace_journal_uri, "create_and_mapping_variables", "err: expression: " + expression + "\n" + e.stack);
                  }
              }
              else
              {
                  if (trace_journal_uri)
                      veda.Util.traceToJournal(ticket, trace_journal_uri, "create_and_mapping_variables", "map not found :" + mapping[i].data);
              }
          }

          if (trace_journal_uri)
              veda.Util.traceToJournal(ticket, trace_journal_uri, "create_and_mapping_variables", trace_comment + " = '" + veda.Util.getUris(mapping) + "' \n\nout = \n" + veda.Util.toJson(_trace_info));

          return new_vars;
      }
      catch (e)
      {
          print(e.stack);
          return [];
      }

  };

  //////////////////////////////////////////////////////////////////////////

  veda.Workflow.find_in_work_item_tree = function (ticket, _process, compare_field, compare_value)
  {
      try
      {
          var res = [];

          var f_workItemList = _process['v-wf:workItemList'];

          if (f_workItemList)
              veda.Workflow.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, _process);

          return res;
      }
      catch (e)
      {
          print(e.stack);
      }
  };

  veda.Workflow.rsffiwit = function (ticket, work_item_list, compare_field, compare_value, res, _parent)
  {
      try
      {
          for (var idx = 0; idx < work_item_list.length; idx++)
          {
              var i_work_item = get_individual(ticket, work_item_list[idx].data);
              if (i_work_item)
              {
                  var ov = i_work_item[compare_field];
                  var isCompleted = i_work_item['v-wf:isCompleted'];

                  if (ov && veda.Util.getUri(ov) == compare_value && !isCompleted)
                      res.push(
                      {
                          parent: _parent,
                          work_item: i_work_item
                      });

                  var f_workItemList = i_work_item['v-wf:workItemList'];

                  if (f_workItemList)
                      veda.Workflow.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, i_work_item);
              }

          }
      }
      catch (e)
      {
          print(e.stack);
      }


  };

///////////////////////////////////////////// JOURNAL //////////////////////////////////////////////////
veda.Workflow.create_new_journal = function(ticket, new_journal_uri, parent_journal_uri, label, is_trace)
{
    try
    {
        var exists_journal = get_individual(ticket, new_journal_uri);

        if (!exists_journal)
        {
            var new_journal = {
                '@': new_journal_uri,
                'rdf:type': [
                {
                    data: 'v-s:Journal',
                    type: "Uri"
                }],
                'v-s:created': [
                {
                    data: new Date(),
                    type: "Datetime"
                }]
            };

            if (parent_journal_uri)
            {
                veda.Workflow.create_new_journal(ticket, parent_journal_uri, null, "", is_trace)
                new_journal['v-s:parentJournal'] = veda.Util.newUri(parent_journal_uri);
            }

            if (label)
                new_journal['rdfs:label'] = label;

            if (is_trace)
                new_journal['v-wf:isTrace'] = veda.Util.newBool(true);

            put_individual(ticket, new_journal, _event_id);
            //print ("create_new_journal, new_journal=", veda.Util.toJson (new_journal), ", ticket=", ticket);
        }
        else
        {
            //print ("create_new_journal, journal already exists, exists_journal=", veda.Util.toJson (exists_journal), ", ticket=", ticket);
        }

        return new_journal_uri;
    }
    catch (e)
    {
        print(e.stack);
    }

};

  veda.Workflow.mapToJournal = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment)
  {
      try
      {
          if (journal_uri && map_container)
          {
              var process_uri = _process['@'];

              //* выполнить маппинг для журнала
              var journalVars = [];

              if (_task && msg)
                  _task['rdfs:label'] = msg;

              journalVars = veda.Workflow.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);
              if (journalVars)
              {
                  var new_journal_record = veda.Util.newJournalRecord(journal_uri);
                  for (var idx = 0; idx < journalVars.length; idx++)
                  {
                      var jvar = journalVars[idx];
                      var name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
                      var value = jvar['v-wf:variableValue'];
                      new_journal_record[name] = value;
                  }
                  veda.Util.logToJournal(ticket, journal_uri, new_journal_record);

                  //print("@@@ logToJournal[" + journal_uri + "], new_journal_record=" + veda.Util.toJson(new_journal_record));

              }
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };

  /*
   * функция mapToMessage, генерирует индивид/сообщение с помощью шаблонизатора mustache (http://mustache.github.io/)
   *
   *    ! для работы требуется заполненная переменная $template, которая указывает на шаблон (индивид типа v-s:Notification)
   *
   *    из шаблона используются поля:
   *      v-s:notificationLanguage - указание какой язык выбран для генерации текста
   *      v-s:notificationSubject  - шаблон для заголовка
   *      v-s:notificationBody   - шаблон для тела
   */

  veda.Workflow.getAppName = function () {
    var appInfo = get_individual(ticket, "v-s:vedaInfo");
    var appName = appInfo ? veda.Util.getFirstValue(appInfo["rdfs:label"]) : "";
    return appName;
  };

  veda.Workflow.mapToMessage = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment) {
    try {
      if (journal_uri && map_container) {
        var process_uri = _process['@'];

        //* выполнить маппинг для сообщения
        var messageVars = [];
        messageVars = veda.Workflow.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);


        if (messageVars) {

          var new_message_uri = veda.Util.genUri() + "-msg";
          var new_message = {
            '@': new_message_uri,
            'v-s:created': [{
              data: new Date(),
              type: "Datetime"
            }]
          };

          var template;

          for (var idx = 0; idx < messageVars.length; idx++) {
            var jvar = messageVars[idx];
            var name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
            var value = jvar['v-wf:variableValue'];

            if (name == '$template') {
              template = get_individual(ticket, veda.Util.getUri(value));
            }

            if (name.indexOf(':') > 0) {
              new_message[name] = value;
            }
          }

          if (template) {
            var lang = template['v-s:notificationLanguage'];
            var subject = veda.Util.getFirstValue(template['v-s:notificationSubject']);
            var body = veda.Util.getFirstValue(template['v-s:notificationBody']);

            if (lang) {
              var lang_indv = get_individual(ticket, lang);

              if (lang_indv && lang_indv['rdf:value']) {
                lang = veda.Util.getFirstValue(lang_indv['rdf:value']).toLowerCase ();
              } else {
                lang = 'RU';
              }
            } else {
              lang = 'RU';
            }
            var view = {
              "app_name": veda.Workflow.getAppName
            };

            for (var idx = 0; idx < messageVars.length; idx++) {
              var jvar = messageVars[idx];
              var name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
              if (name == '$template' || name.indexOf(':') > 0) {
                continue;
              }
              var values = jvar['v-wf:variableValue'];
              var araa = [];

              for (var val_idx in values) {
                var value = values[val_idx];
                if (value.type == "Uri") {
                  var inner_indv = get_individual(ticket, value.data);
                  if (inner_indv == undefined) {
                    araa.push('ERR! individual [' + value.data + '] not found, var.name=' + name);
                    continue;
                  }
                  if (inner_indv['rdfs:label'] == undefined) {
                    araa.push('ERR! individual [' + value.data + '] not contains rdfs:label, var.name=' + name);
                    continue;
                  }
                  //print("@@@43 inner_indv=", veda.Util.toJson (inner_indv), ", lang=", lang);
                  value = veda.Util.getFirstValueUseLang(inner_indv['rdfs:label'], lang);

                  if (!value) {
                    value = veda.Util.getFirstValue(inner_indv['rdfs:label']);
                  }
                  araa.push(value);
                } else {
                  var aa = "";
                  if (value.lang == lang || value.lang == "" || value.lang == undefined || value.lang == "NONE") {
                    aa = value.data;
                    araa.push(aa);
                  }
                }
              }
              view[name] = araa;
            }
            //print("@@@50 view=", veda.Util.toJson(view));
            var output_subject = Mustache.render(subject, view).replace (/&#x2F;/g, '/');
            var output_body = Mustache.render(body, view).replace (/&#x2F;/g, '/');
            new_message['v-s:subject'] = veda.Util.newStr (output_subject, lang);
            new_message['v-s:messageBody'] = veda.Util.newStr (output_body, lang);
            new_message['v-wf:onWorkOrder'] = veda.Util.newUri (_order['@']);
            new_message['v-s:hasMessageType'] = template['v-s:hasMessageType'];
            put_individual(ticket, new_message, _event_id);
          }
          //print("@@@ mapToMessage=" + veda.Util.toJson(new_message));
        }
      }
    } catch (e) {
      print(e.stack);
    }
  };


  veda.Workflow.create_new_subjournal = function (parent_uri, el_uri, label, jtype)
  {
      return veda.Workflow._create_new_subjournal(false, parent_uri, el_uri, label, jtype)
  };

  veda.Workflow.create_new_trace_subjournal = function (parent_uri, net_element_impl, label, jtype)
  {
      var new_sub_journal_uri;
      var isTrace;

      isTrace = net_element_impl['v-wf:isTrace'];

      if (!isTrace || isTrace && veda.Util.getFirstValue(isTrace) == false)
          return undefined;

      var el_uri = net_element_impl['@'];

      new_sub_journal_uri = veda.Workflow._create_new_subjournal(true, parent_uri, el_uri, label, jtype)

      var set_journal_to_element;
      set_journal_to_element = {
          '@': el_uri,
          'v-wf:traceJournal': veda.Util.newUri(new_sub_journal_uri),
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
      };
      add_to_individual(ticket, set_journal_to_element, _event_id);

      return new_sub_journal_uri;
  };

  veda.Workflow._create_new_subjournal = function (is_trace, parent_uri, el_uri, label, jtype)
  {
      var new_sub_journal_uri;
      var parent_journal_uri;

      if (is_trace == true)
      {
          new_sub_journal_uri = veda.Util.getTraceJournalUri(el_uri);
          parent_journal_uri = veda.Util.getTraceJournalUri(parent_uri);
      }
      else
      {
          new_sub_journal_uri = veda.Util.getJournalUri(el_uri);
          parent_journal_uri = veda.Util.getJournalUri(parent_uri);
      }

      var cj = get_individual(ticket, new_sub_journal_uri);
      if (cj)
      {
          //print("!!!!!!!!!! journal [" + new_sub_journal_uri + "] already exists");
          return new_sub_journal_uri;
      }
      else
          veda.Workflow.create_new_journal(ticket, new_sub_journal_uri, parent_journal_uri, label, is_trace);

      var journal_record = veda.Util.newJournalRecord(parent_journal_uri);
      journal_record['rdf:type'] = [
      {
          data: jtype,
          type: "Uri"
      }];
      if (label)
      {
          if (Array.isArray(label))
              journal_record['rdfs:label'] = label;
          else
              journal_record['rdfs:label'] = [
              {
                  data: label,
                  type: "String"
              }];
      }
      journal_record['v-s:subJournal'] = [
      {
          data: new_sub_journal_uri,
          type: "Uri"
      }];
      veda.Util.logToJournal(ticket, parent_journal_uri, journal_record, true);

      put_individual(ticket, journal_record, _event_id);

      return new_sub_journal_uri;
  };

  veda.Workflow.get_trace_journal = function (document, process)
  {
      var isTrace = document['v-wf:isTrace'];
      if (isTrace && veda.Util.getFirstValue(isTrace) == true)
      {
          return veda.Util.getTraceJournalUri(process['@']);
      }
      else
      {
          return undefined;
      }
  };

  /////////////////////////////////////////////////////////////////////////////////////////

  veda.Workflow.create_new_subprocess = function (ticket, f_useSubNet, f_executor, parent_net, f_inVars, document, parent_trace_journal_uri)
  {
      try
      {
          var parent_process_uri = document['@'];

          var use_net;

          if (f_useSubNet)
              use_net = f_useSubNet;
          else
              use_net = f_executor;

          if (parent_trace_journal_uri)
              veda.Util.traceToJournal(ticket, parent_trace_journal_uri, "[WO2.4] executor= " + veda.Util.getUri(f_executor) + " used net", veda.Util.getUri(use_net));

          //var ctx = new veda.Workflow.Context(work_item, ticket);
          //ctx.print_variables ('v-wf:inVars');
          var _started_net = get_individual(ticket, veda.Util.getUri(use_net));
          if (_started_net)
          {
              var new_process_uri = veda.Util.genUri() + "-prs";

              var new_process = {
                  '@': new_process_uri,
                  'rdf:type': [
                  {
                      data: 'v-wf:Process',
                      type: "Uri"
                  }],
                  'v-wf:instanceOf': use_net,
                  'v-wf:parentWorkOrder': [
                  {
                      data: parent_process_uri,
                      type: "Uri"
                  }],
          'v-s:created': [
          {
                data: new Date(),
                type: "Datetime"
                  }]
              };

              var msg = "экземпляр маршрута :" + veda.Util.getFirstValue(_started_net['rdfs:label']) + ", запущен из " + veda.Util.getFirstValue(parent_net['rdfs:label'])

              if (f_useSubNet)
                  msg += ", для " + veda.Util.getUri(f_executor);

              new_process['rdfs:label'] = [
              {
                  data: msg,
                  type: "String"
              }];

              // возьмем входные переменные WorkItem  и добавим их процессу
              if (f_inVars)
                  new_process['v-wf:inVars'] = f_inVars;

              if (f_useSubNet)
                  new_process['v-wf:executor'] = f_executor;

              if (parent_trace_journal_uri)
              {
                  veda.Util.traceToJournal(ticket, parent_trace_journal_uri, "new_process=", veda.Util.getUri(use_net), veda.Util.toJson(new_process));
                  new_process['v-wf:isTrace'] = veda.Util.newBool(true);

                  var trace_journal_uri = veda.Util.getTraceJournalUri(new_process_uri);
                  if (trace_journal_uri)
                  {
                      veda.Workflow.create_new_journal(ticket, trace_journal_uri, null, _started_net['rdfs:label']);
                      new_process['v-wf:traceJournal'] = veda.Util.newUri(trace_journal_uri);
                  }
              }
              put_individual(ticket, new_process, _event_id);

              veda.Workflow.create_new_subjournal(parent_process_uri, new_process_uri, 'запущен подпроцесс', 'v-wf:SubProcessStarted');

              document['v-wf:isProcess'] = [
              {
                  data: new_process_uri,
                  type: "Uri"
              }];

              put_individual(ticket, document, _event_id);
          }
      }
      catch (e)
      {
          print(e.stack);
      }

  };


  veda.Workflow.get_properties_chain = function (var1, query, result_if_fail_search)
  {
      var res = [];

      if (query.length < 1)
          return res;

      var doc;
          //print('@@@get_properties_chain#1 var1=', veda.Util.toJson(var1), ", query=", veda.Util.toJson (query));
      try
      {
      doc = get_individual(ticket, veda.Util.getUri(var1));

      if (doc)
          veda.Workflow.traversal(doc, query, 0, res);

          //print('@@@get_properties_chain #2 res=', veda.Util.toJson(res));

    if (result_if_fail_search && (res == undefined || res.length == 0))
      res = result_if_fail_search;

          //print('@@@get_properties_chain #3 res=', veda.Util.toJson(res));
      }
      catch (e)
      {
          print(e.stack);
      }

      return res;
  };

  veda.Workflow.traversal = function (indv, query, pos_in_path, result)
  {
      var condition = query[pos_in_path];

      //print('@@@ traversal#0 condition=', veda.Util.toJson(condition), ", indv=", veda.Util.toJson(indv));

      var op_get;
      var op_go;
      var op_eq;
      for (var key in condition)
      {
          var op = key;

          if (op == '$get')
              op_get = condition[key];

          if (op == '$go')
              op_go = condition[key];

          if (op == '$eq')
              op_eq = condition[key];
      }
      if (op_go)
      {
          var ffs = indv[op_go];

          for (var i in ffs)
          {
              //print('@@@ traversal#2 ffs[i]=', ffs[i].data);
              var doc = get_individual(ticket, ffs[i].data);
              //print('@@@ traversal#4 doc=', veda.Util.toJson(doc));
              veda.Workflow.traversal(doc, query, pos_in_path + 1, result);
          }
      }

      if (op_get)
      {
          //print ("@1 op_get=", op_get);
          var is_get = true;
          if (op_eq)
          {
              is_get = false;

              var kk = Object.keys(op_eq);
              if (kk)
              {
                  var field = kk[0];

                  var A = indv[field];
                  if (A)
                  {
                      //print("###1 A=", veda.Util.toJson(A));
                      var B = op_eq[field];
                      //print("###2 B=", veda.Util.toJson(B));

                      for (var i in A)
                      {
                          if (A[i].type == B[0].type && A[i].data == B[0].data)
                          {
                              is_get = true;
                              //print("###3 A == B");
                              break;
                          }

                      }

                  }
              }
          }
          else
          {
              is_get = true;
          }

          if (is_get && indv != undefined)
          {
              //print ("@2 op_get=", op_get);
              var ffs = indv[op_get];
              //print ("@3 op_get=", ffs);

              for (var i in ffs)
              {
                  //print('@@@ traversal#3 push ', ffs[i].data);
                  result.push(ffs[i]);
              }
          }
      }

  };

  veda.Workflow.remove_empty_branches_from_journal = function (journal_uri)
  {
      var jrn = get_individual(ticket, journal_uri);
      if (jrn && !jrn["v-s:childRecord"])
      {
          var parent_jrn_uri = veda.Util.getUri(jrn["v-s:parentJournal"]);
          if (parent_jrn_uri)
          {
              var parent_jrn = get_individual(ticket, parent_jrn_uri);

              var child_records = parent_jrn['v-s:childRecord'];
        if (child_records)
        {
          for (var i = 0; i < child_records.length; i++)
          {
            var chr_uri = child_records[i].data;
            var chr = get_individual(ticket, chr_uri);
            if (chr && veda.Util.getUri(chr["v-s:subJournal"]) == journal_uri)
            {
              var remove_from_journal = {
                          '@': parent_jrn_uri,
                          'v-s:childRecord': [
                          {
                              data: chr_uri,
                              type: "Uri"
                          }]
              };
              remove_from_individual(ticket, remove_from_journal, _event_id);

              //print("@@@@@@@@ parent_jrn=", veda.Util.toJson(parent_jrn), ", remove_from_journal=", veda.Util.toJson(remove_from_journal));
              break;
            }

          }
        }
          }
      }
  };

  veda.Workflow.getSystemUrl = function (var_to) {
      var userTo = get_individual(ticket, var_to[0].data);
      var isExternal = false;
      if (userTo["v-s:origin"] && userTo["v-s:origin"][0].data ==="ExternalUser") {
          isExternal = true;
      };
      var systemIndivid = isExternal ? veda.Util.newUri ('cfg:SystemInfoExternal') : veda.Util.newUri ('v-s:vedaInfo');
      return veda.Util.getFirstValue (veda.Workflow.get_properties_chain (systemIndivid, [{$get:'v-s:appUrl'}]));
  };

  veda.Workflow.getInboxUrl = function (var_to) {
      var userTo = get_individual(ticket, var_to[0].data);
      var isExternal = false;
      if (userTo["v-s:origin"] && userTo["v-s:origin"][0].data ==="ExternalUser") {
          isExternal = true;
      };
      var systemIndivid = isExternal ? veda.Util.newUri ('cfg:SystemInfoExternal') : veda.Util.newUri ('v-s:vedaInfo');
      return veda.Util.getFirstValue (veda.Workflow.get_properties_chain (systemIndivid, [{$get:'v-wf:appInboxUrl'}]));
  };

  veda.Workflow.isSubUnitOf = function (current, target, depth) {
      if (current.length == 0) return false;
      print("@@@@@isSubUnitOf run");
      depth = depth || 0;
      var dep = get_individual(ticket, current[0].data);
      if (!veda.Util.hasValue(dep, "v-s:parentUnit") || depth > 16) {
        print("@@@@@isSubUnitOf parentUnit empty");
        return false;
      } else if (veda.Util.hasValue(dep, "v-s:parentUnit", {data: target, type: "Uri"})) {
        print("@@@@@isSubUnitOf parentUnit match");
        return true;
      } else {
        return veda.Workflow.isSubUnitOf(dep["v-s:parentUnit"], target, depth + 1);
      }
  };
});
