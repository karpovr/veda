// Workflow engine utilities

'use strict';

import veda from '../common/veda.js';

import mustache from 'mustache';

const Workflow = veda.Workflow || {};

export default veda.Workflow = Workflow;

Workflow.create_work_item = function (ticket, process_uri, net_element_uri, parent_uri, _event_id, isTrace) {
  try {
    const new_uri = veda.Util.genUri() + '-wit';
    const new_work_item = {
      '@': new_uri,
      'rdf:type': [
        {
          data: 'v-wf:WorkItem',
          type: 'Uri',
        }],
      'v-wf:forProcess': [
        {
          data: process_uri,
          type: 'Uri',
        }],
      'v-wf:forNetElement': [
        {
          data: net_element_uri,
          type: 'Uri',
        }],
      'v-s:created': [
        {
          data: new Date(),
          type: 'Datetime',
        }],
      'v-s:creator': [
        {
          data: 'cfg:VedaSystem',
          type: 'Uri',
        }],
    };

    if (isTrace) {
      new_work_item['v-wf:isTrace'] = veda.Util.newBool(true);
    }

    if (parent_uri !== null) {
      new_work_item['v-wf:previousWorkItem'] = [
        {
          data: parent_uri,
          type: 'Uri',
        }];
    }

    // print("[WORKFLOW]:create work item:" + new_uri);

    put_individual(ticket, new_work_item, _event_id);

    // veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_uri, ["v-s:canRead"]);

    return new_uri;
  } catch (e) {
    print(e.stack);
  }
};

Workflow.WorkItemResult = function (_work_item_result) {
  this.work_item_result = _work_item_result;

  // ///////////////////////// functions prepare work_item_result
  this.getValue = function (var_name) {
    for (const i in this.work_item_result) {
      if (Object.hasOwnProperty.call(this.work_item_result, i)) {
        return this.work_item_result[i][var_name];
      }
    }
  };

  this.compare = function (var_name, value) {
    if (!value || value.length < 1) {
      return false;
    }

    // print ("@@@compareTaskResult this.work_item_result=", veda.Util.toJson (this.work_item_result));
    // print ("@@@compareTaskResult value=", veda.Util.toJson (value));
    // print ("@@@compareTaskResult var_name=", veda.Util.toJson (var_name));
    if (!this.work_item_result || this.work_item_result.length == 0) {
      return false;
    }

    //  print ("@@@compareTaskResult 1");
    let true_count = 0;
    for (const i in this.work_item_result) {
      if (Object.hasOwnProperty.call(this.work_item_result, i)) {
        //  print ("@@@compareTaskResult 2");
        const wirv = this.work_item_result[i][var_name];
        if (wirv && wirv.length == value.length) {
          //  print ("@@@compareTaskResult 3");
          for (const j in wirv) {
            if (Object.hasOwnProperty.call(wirv, j)) {
              //  print ("@@@compareTaskResult 4");
              for (const k in value) {
                if (wirv[j].data == value[k].data && wirv[j].type == value[k].type) {
                  true_count++;
                }
              }
              if (true_count == value.length) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  };

  this.is_exists_result = function () {
    if (!this.work_item_result || this.work_item_result.length < 1) {
      return false;
    }

    for (let i = 0; i < this.work_item_result.length; i++) {
      if (this.work_item_result[i].result) {
        return true;
      }
    }

    return false;
  };

  this.is_all_executors_taken_decision = function (var_name, value) {
    // print('BLABLABLA > '+veda.Util.toJson(this));
    if (!value || value.length < 1) {
      return false;
    }

    let count_agreed = 0;
    for (let i = 0; i < this.work_item_result.length; i++) {
      const wirv = this.work_item_result[i][var_name];

      // print("@@@is_all_executors_taken_decision: wiri=" + veda.Util.toJson(wirv), ", value=", veda.Util.toJson(value));

      if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type) {
        count_agreed++;
      }
    }

    if (count_agreed == this.work_item_result.length) {
      // print("@@@is_some_executor_taken_decision: TRUE");
      return true;
    } else {
      return false;
    }
  };

  this.is_some_executor_taken_decision = function (var_name, value) {
    if (!value || value.length < 1) {
      return false;
    }

    for (let i = 0; i < this.work_item_result.length; i++) {
      const wirv = this.work_item_result[i][var_name];

      // print("@@@is_some_executor_taken_decision: wiri=" + veda.Util.toJson(wirv), ", value=", veda.Util.toJson(value));

      if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type) {
        // print("@@@is_some_executor_taken_decision: TRUE");
        return true;
      }
    }

    return false;
  };
};

Workflow.is_some_content_value = function (src, b) {
  for (let i = 0; i < src.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (src[i].type == b[j].type && src[i].data == b[j].data) {
        //          print("@@@is_some_content_value: TRUE");
        return true;
      }
    }
  }

  //          print("@@@is_some_content_value: FALSE");
  return false;
};


Workflow.Context = function (_src_data, _ticket) {
  this.src_data = _src_data;
  this.ticket = _ticket;

  this.getDecisionForms = function () {
    return this.src_data['v-wf:decisionFormList'];
  };

  this.getExecutor = function () {
    return this.src_data['v-wf:executor'];
  };

  this.getLabel = function () {
    return this.src_data['rdfs:label'];
  };

  this.get_results = function () {
    return this.src_data;
  };

  this.if_all_executors_taken_decision = function (true_decision, false_decision) {
    try {
      let count_agreed = 0;
      for (let i = 0; i < this.src_data.length; i++) {
        //     print ("data[i].result=", data[i].result);
        if (this.src_data[i].result == true_decision) {
          count_agreed++;
        }
      }

      if (count_agreed == this.src_data.length) {
        return [
          {
            'data': true_decision,
            'type': 'Uri',
          }];
      } else {
        return [
          {
            'data': false_decision,
            'type': 'Uri',
          }];
      }
    } catch (e) {
      print(e.stack);
      return false;
    }
  };

  this.getInputVariable = function (var_name) {
    return this.getVariableValueIO(var_name, 'v-wf:inVars');
  };

  this.getLocalVariable = function (var_name) {
    return this.getVariableValueIO(var_name, 'v-wf:localVars');
  };

  this.getOutVariable = function (var_name) {
    return this.getVariableValueIO(var_name, 'v-wf:outVars');
  };

  this.getVariableValueIO = function (var_name, io) {
    try {
      //          print ("CONTEXT::getVariableValueIO src_data=" + veda.Util.toJson (this.src_data));
      const variables = this.src_data[io];

      if (variables) {
        for (let i = 0; i < variables.length; i++) {
          const variable = get_individual(this.ticket, variables[i].data);
          if (!variable) continue;
          // print ("CONTEXT::getVariableValueIO var=" + veda.Util.toJson (variable));

          const variable_name = veda.Util.getFirstValue(variable['v-wf:variableName']);

          // print("[WORKFLOW]:getVariableIO #0: work_item=" + this.src_data['@'] + ", var_name=" + variable_name + ", val=" + veda.Util.toJson(variable['v-wf:variableValue']));

          if (variable_name == var_name) {
            const val = variable['v-wf:variableValue'];

            // print("[WORKFLOW]:getVariableValue #1: work_item=" + this.src_data['@'] + ", var_name=" + var_name + ", val=" + veda.Util.toJson(val)); // + ", variable=" + veda.Util.toJson (variable));
            return val;
          }
        }
      }
    } catch (e) {
      print(e.stack);
      return false;
    }

    // print("[WORKFLOW]:getVariableValue: work_item=" + this.src_data['@'] + ", var_name=" + var_name + ", val=undefined");
  };

  this.print_variables = function (io) {
    try {
      const variables = this.src_data[io];

      if (variables) {
        for (let i = 0; i < variables.length; i++) {
          const variable = get_individual(this.ticket, variables[i].data);
          if (!variable) continue;
          // const variable_name = veda.Util.getFirstValue(variable['v-wf:variableName']);
          // print("[WORKFLOW]:print_variable: work_item=" + this.src_data['@'] + ", var_name=" + variable_name + ", val=" + veda.Util.toJson(variable['v-wf:variableValue']));
        }
      }
    } catch (e) {
      print(e.stack);
      return false;
    }
  };

  this.get_result_value = function (field1, type1) {
    try {
      if (this.src_data && this.src_data.length > 0) {
        const rr = this.src_data[0][field1];
        if (rr) {
          return [
            {
              'data': rr,
              'type': type1,
            }];
        } else {
          return null;
        }
      }
    } catch (e) {
      print(e.stack);
      return false;
    }
  };
};

Workflow.get_new_variable = function (variable_name, value) {
  try {
    const new_uri = veda.Util.genUri() + '-var';
    const new_variable = {
      '@': new_uri,
      'rdf:type': [{
        data: 'v-wf:Variable',
        type: 'Uri',
      }],
      'v-wf:variableName': [{
        data: variable_name,
        type: 'String',
      }],
      'v-s:created': [{
        data: new Date(),
        type: 'Datetime',
      }],
    };
    if (value) {
      new_variable['v-wf:variableValue'] = value;
    }
    return new_variable;
  } catch (e) {
    print(e.stack);
    throw e;
  }
};

Workflow.store_items_and_set_minimal_rights = function (ticket, data) {
  try {
    const ids = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i]['v-s:created'] == undefined) {
        data[i]['v-s:created'] = veda.Util.newDate(new Date());
      } else {
        data[i]['v-s:edited'] = veda.Util.newDate(new Date());
      }

      if (data[i]['v-s:creator'] == undefined) {
        data[i]['v-s:creator'] = veda.Util.newUri('cfg:VedaSystem');
      }

      put_individual(ticket, data[i], _event_id);

      ids.push(
        {
          data: data[i]['@'],
          type: 'Uri',
        });

      veda.Util.addRight(ticket, 'v-wf:WorkflowReadUser', data[i]['@'], ['v-s:canRead']);
    }
    return ids;
  } catch (e) {
    print(e.stack);
  }
};

Workflow.generate_variable = function (ticket, def_variable, value, _process, _task, _task_result) {
  try {
    const variable_name = veda.Util.getFirstValue(def_variable['v-wf:varDefineName']);

    // print("[WORKFLOW][generate_variable]: variable_define_name=" + variable_name);
    const new_variable = Workflow.get_new_variable(variable_name, value);

    const variable_scope = veda.Util.getUri(def_variable['v-wf:varDefineScope']);
    if (variable_scope) {
      let scope;
      if (variable_scope == 'v-wf:Net') {
        scope = _process['@'];
      }

      if (scope) {
        new_variable['v-wf:variableScope'] = [
          {
            data: scope,
            type: 'Uri',
          }];

        let local_vars = _process['v-wf:localVars'];
        let find_local_var;
        if (local_vars) {
          // print("[WORKFLOW][generate_variable]: ищем переменную [", variable_name, "] среди локальных процесса:" + _process['@'] + ", local_vars=", veda.Util.toJson (local_vars));

          // найдем среди локальных переменных процесса, такую переменную
          // если нашли, то новая переменная должна перезаписать переменную процесса
          for (let i = 0; i < local_vars.length; i++) {
            // print ("@@ local_var_uri=", veda.Util.toJson (local_vars[i]));
            const local_var = get_individual(ticket, local_vars[i].data);
            if (!local_var) continue;

            // print ("@@ local_var=", veda.Util.toJson (local_var));

            const var_name = veda.Util.getFirstValue(local_var['v-wf:variableName']);
            if (!var_name) continue;

            if (var_name == variable_name) {
              find_local_var = local_var;
              break;
            }
          }

          if (find_local_var) {
            // нашли, обновим значение в локальной переменной
            find_local_var['v-wf:variableValue'] = value;
            //            print ("find_local_var=", veda.Util.toJson (find_local_var));
            put_individual(ticket, find_local_var, _event_id);

            //                        new_variable['@'] = find_local_var['@'];
          }
        } else {
          local_vars = [];
        }

        if (!find_local_var) {
          // print("[WORKFLOW][generate_variable]: переменная [", variable_name, "] не, найдена, привязать новую к процессу:" + _process['@']);

          // если не нашли то сделать копию и привязать ее переменную к процессу
          const new_variable_for_local = Workflow.get_new_variable(variable_name, value);
          put_individual(ticket, new_variable_for_local, _event_id);

          const add_to_document = {
            '@': _process['@'],
            'v-wf:localVars': [
              {
                data: new_variable_for_local['@'],
                type: 'Uri',
              }],
          };
          add_to_individual(ticket, add_to_document, _event_id);

          local_vars.push(veda.Util.newUri(new_variable_for_local['@'])[0]);
          _process['v-wf:localVars'] = local_vars;

          // print("[WORKFLOW][generate_variable]: _process= ", veda.Util.toJson (_process['v-wf:localVars']));
        }
      }
    }

    // print("[WORKFLOW][generate_variable]: new variable: " + veda.Util.toJson(new_variable));

    return new_variable;
  } catch (e) {
    print(e.stack);
    throw e;
  }
};

Workflow.create_and_mapping_variables = function (ticket, mapping, _process, _task, _order, _task_result, f_store, trace_journal_uri, trace_comment) {
  try {
    const _trace_info = [];

    const new_vars = [];
    if (!mapping) return [];

    let process;
    let task;
    let order;
    let task_result;

    if (_process) {
      process = new Workflow.Context(_process, ticket);
    }

    if (_task) {
      task = new Workflow.Context(_task, ticket);
    }

    if (_order) {
      order = new Workflow.Context(_order, ticket);
    }

    if (_task_result) {
      task_result = new Workflow.WorkItemResult(_task_result);
    }

    // print("[WORKFLOW][create_and_mapping_variables]: process=" + veda.Util.toJson (process));
    // print("[WORKFLOW][create_and_mapping_variables]: task=" + veda.Util.toJson (task));
    // print("[WORKFLOW][create_and_mapping_variables]: order=" + veda.Util.toJson (order));
    // print("[WORKFLOW][create_and_mapping_variables]: task_result=" + veda.Util.toJson (task_result));

    for (let i = 0; i < mapping.length; i++) {
      const map = get_individual(ticket, mapping[i].data);

      if (map) {
        // print("[WORKFLOW][create_and_mapping_variables]: map_uri=" + map['@']);
        const expression = veda.Util.getFirstValue(map['v-wf:mappingExpression']);
        if (!expression) continue;

        // print("[WORKFLOW][create_and_mapping_variables]: expression=" + expression);
        try {
          const res1 = eval(expression);
          // print("[WORKFLOW][create_and_mapping_variables]: res1=" + veda.Util.toJson(res1));
          if (!res1) continue;

          const mapToVariable_uri = veda.Util.getUri(map['v-wf:mapToVariable']);
          if (!mapToVariable_uri) continue;

          const def_variable = get_individual(ticket, mapToVariable_uri);
          if (!def_variable) continue;

          const new_variable = Workflow.generate_variable(ticket, def_variable, res1, _process, _task, _task_result);
          if (new_variable) {
            if (f_store == true) {
              put_individual(ticket, new_variable, _event_id);

              if (trace_journal_uri) {
                _trace_info.push(new_variable);
              }

              new_vars.push(
                {
                  data: new_variable['@'],
                  type: 'Uri',
                });
              // veda.Util.addRight(ticket, "v-wf:WorkflowReadUser", new_variable['@'], ["v-s:canRead"]);
            } else {
              new_vars.push(new_variable);
            }
          }
        } catch (e) {
          if (trace_journal_uri) {
            veda.Util.traceToJournal(ticket, trace_journal_uri, 'create_and_mapping_variables', 'err: expression: ' + expression + '\n' + e.stack);
          }
        }
      } else {
        if (trace_journal_uri) {
          veda.Util.traceToJournal(ticket, trace_journal_uri, 'create_and_mapping_variables', 'map not found :' + mapping[i].data);
        }
      }
    }

    if (trace_journal_uri) {
      veda.Util.traceToJournal(ticket, trace_journal_uri, 'create_and_mapping_variables', trace_comment + ' = \'' + veda.Util.getUris(mapping) + '\' \n\nout = \n' + veda.Util.toJson(_trace_info));
    }

    return new_vars;
  } catch (e) {
    print(e.stack);
    return [];
  }
};

// ////////////////////////////////////////////////////////////////////////

Workflow.find_in_work_item_tree = function (ticket, _process, compare_field, compare_value) {
  try {
    const res = [];

    const f_workItemList = _process['v-wf:workItemList'];

    if (f_workItemList) {
      Workflow.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, _process);
    }

    return res;
  } catch (e) {
    print(e.stack);
  }
};

Workflow.rsffiwit = function (ticket, work_item_list, compare_field, compare_value, res, _parent) {
  try {
    for (let idx = 0; idx < work_item_list.length; idx++) {
      const i_work_item = get_individual(ticket, work_item_list[idx].data);
      if (i_work_item) {
        const ov = i_work_item[compare_field];
        const isCompleted = i_work_item['v-wf:isCompleted'];

        if (ov && veda.Util.getUri(ov) == compare_value && !isCompleted) {
          res.push(
            {
              parent: _parent,
              work_item: i_work_item,
            });
        }

        const f_workItemList = i_work_item['v-wf:workItemList'];

        if (f_workItemList) {
          Workflow.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, i_work_item);
        }
      }
    }
  } catch (e) {
    print(e.stack);
  }
};

// /////////////////////////////////////////// JOURNAL //////////////////////////////////////////////////
Workflow.create_new_journal = function (ticket, new_journal_uri, parent_journal_uri, label, is_trace) {
  try {
    const exists_journal = get_individual(ticket, new_journal_uri);

    if (!exists_journal) {
      const new_journal = {
        '@': new_journal_uri,
        'rdf:type': [
          {
            data: 'v-s:Journal',
            type: 'Uri',
          }],
        'v-s:created': [
          {
            data: new Date(),
            type: 'Datetime',
          }],
      };

      if (parent_journal_uri) {
        Workflow.create_new_journal(ticket, parent_journal_uri, null, '', is_trace);
        new_journal['v-s:parentJournal'] = veda.Util.newUri(parent_journal_uri);
      }

      if (label) {
        new_journal['rdfs:label'] = label;
      }

      if (is_trace) {
        new_journal['v-wf:isTrace'] = veda.Util.newBool(true);
      }

      put_individual(ticket, new_journal, _event_id);
      // print ("create_new_journal, new_journal=", veda.Util.toJson (new_journal), ", ticket=", ticket);
    } else {
      // print ("create_new_journal, journal already exists, exists_journal=", veda.Util.toJson (exists_journal), ", ticket=", ticket);
    }

    return new_journal_uri;
  } catch (e) {
    print(e.stack);
  }
};

Workflow.mapToJournal = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment) {
  try {
    if (journal_uri && map_container) {
      // const process_uri = _process['@'];

      //* выполнить маппинг для журнала
      let journalVars = [];

      if (_task && msg) {
        _task['rdfs:label'] = msg;
      }

      journalVars = Workflow.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);
      if (journalVars) {
        const new_journal_record = veda.Util.newJournalRecord(journal_uri);
        for (let idx = 0; idx < journalVars.length; idx++) {
          const jvar = journalVars[idx];
          const name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
          const value = jvar['v-wf:variableValue'];
          new_journal_record[name] = value;
        }
        veda.Util.logToJournal(ticket, journal_uri, new_journal_record);

        // print("@@@ logToJournal[" + journal_uri + "], new_journal_record=" + veda.Util.toJson(new_journal_record));
      }
    }
  } catch (e) {
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

Workflow.getAppName = function () {
  const appInfo = get_individual(ticket, 'v-s:vedaInfo');
  const appName = appInfo ? veda.Util.getFirstValue(appInfo['rdfs:label']) : '';
  return appName;
};

Workflow.mapToMessage = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment) {
  try {
    if (journal_uri && map_container) {
      const process_uri = _process['@'];

      //* выполнить маппинг для сообщения
      let messageVars = [];
      messageVars = Workflow.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);


      if (messageVars) {
        const new_message_uri = veda.Util.genUri() + '-msg';
        const new_message = {
          '@': new_message_uri,
          'v-s:created': [{
            data: new Date(),
            type: 'Datetime',
          }],
        };

        let template;

        for (let idx = 0; idx < messageVars.length; idx++) {
          const jvar = messageVars[idx];
          const name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
          const value = jvar['v-wf:variableValue'];

          if (name == '$template') {
            template = get_individual(ticket, veda.Util.getUri(value));
          }

          if (name.indexOf(':') > 0) {
            new_message[name] = value;
          }
        }

        if (template) {
          let lang = template['v-s:notificationLanguage'];
          const subject = veda.Util.getFirstValue(template['v-s:notificationSubject']);
          const body = veda.Util.getFirstValue(template['v-s:notificationBody']);

          if (lang) {
            const lang_indv = get_individual(ticket, lang);

            if (lang_indv && lang_indv['rdf:value']) {
              lang = veda.Util.getFirstValue(lang_indv['rdf:value']).toLowerCase();
            } else {
              lang = 'RU';
            }
          } else {
            lang = 'RU';
          }
          const view = {
            'app_name': Workflow.getAppName,
          };

          for (let idx = 0; idx < messageVars.length; idx++) {
            const jvar = messageVars[idx];
            const name = veda.Util.getFirstValue(jvar['v-wf:variableName']);
            if (name == '$template' || name.indexOf(':') > 0) {
              continue;
            }
            const values = jvar['v-wf:variableValue'];
            const araa = [];

            for (const val_idx in values) {
              if (Object.hasOwnProperty.call(values, val_idx)) {
                let value = values[val_idx];
                if (value.type == 'Uri') {
                  const inner_indv = get_individual(ticket, value.data);
                  if (inner_indv == undefined) {
                    araa.push('ERR! individual [' + value.data + '] not found, var.name=' + name);
                    continue;
                  }
                  if (inner_indv['rdfs:label'] == undefined) {
                    araa.push('ERR! individual [' + value.data + '] not contains rdfs:label, var.name=' + name);
                    continue;
                  }
                  // print("@@@43 inner_indv=", veda.Util.toJson (inner_indv), ", lang=", lang);
                  value = veda.Util.getFirstValueUseLang(inner_indv['rdfs:label'], lang);

                  if (!value) {
                    value = veda.Util.getFirstValue(inner_indv['rdfs:label']);
                  }
                  araa.push(value);
                } else {
                  let aa = '';
                  if (value.lang == lang || value.lang == '' || value.lang == undefined || value.lang == 'NONE') {
                    aa = value.data;
                    araa.push(aa);
                  }
                }
              }
            }
            view[name] = araa;
          }
          // print("@@@50 view=", veda.Util.toJson(view));
          const output_subject = mustache.render(subject, view).replace(/&#x2F;/g, '/');
          const output_body = mustache.render(body, view).replace(/&#x2F;/g, '/');
          new_message['v-s:subject'] = veda.Util.newStr(output_subject, lang);
          new_message['v-s:messageBody'] = veda.Util.newStr(output_body, lang);
          new_message['v-wf:onWorkOrder'] = veda.Util.newUri(_order['@']);
          new_message['v-s:hasMessageType'] = template['v-s:hasMessageType'];
          put_individual(ticket, new_message, _event_id);
        }
        // print("@@@ mapToMessage=" + veda.Util.toJson(new_message));
      }
    }
  } catch (e) {
    print(e.stack);
  }
};


Workflow.create_new_subjournal = function (parent_uri, el_uri, label, jtype) {
  return Workflow._create_new_subjournal(false, parent_uri, el_uri, label, jtype);
};

Workflow.create_new_trace_subjournal = function (parent_uri, net_element_impl, label, jtype) {
  const isTrace = net_element_impl['v-wf:isTrace'];

  if (!isTrace || isTrace && veda.Util.getFirstValue(isTrace) == false) {
    return undefined;
  }

  const el_uri = net_element_impl['@'];

  const new_sub_journal_uri = Workflow._create_new_subjournal(true, parent_uri, el_uri, label, jtype);

  const set_journal_to_element = {
    '@': el_uri,
    'v-wf:traceJournal': veda.Util.newUri(new_sub_journal_uri),
    'v-s:created': [
      {
        data: new Date(),
        type: 'Datetime',
      }],
  };
  add_to_individual(ticket, set_journal_to_element, _event_id);

  return new_sub_journal_uri;
};

Workflow._create_new_subjournal = function (is_trace, parent_uri, el_uri, label, jtype) {
  let new_sub_journal_uri;
  let parent_journal_uri;

  if (is_trace == true) {
    new_sub_journal_uri = veda.Util.getTraceJournalUri(el_uri);
    parent_journal_uri = veda.Util.getTraceJournalUri(parent_uri);
  } else {
    new_sub_journal_uri = veda.Util.getJournalUri(el_uri);
    parent_journal_uri = veda.Util.getJournalUri(parent_uri);
  }

  const cj = get_individual(ticket, new_sub_journal_uri);
  if (cj) {
    // print("!!!!!!!!!! journal [" + new_sub_journal_uri + "] already exists");
    return new_sub_journal_uri;
  } else {
    Workflow.create_new_journal(ticket, new_sub_journal_uri, parent_journal_uri, label, is_trace);
  }

  const journal_record = veda.Util.newJournalRecord(parent_journal_uri);
  journal_record['rdf:type'] = [
    {
      data: jtype,
      type: 'Uri',
    }];
  if (label) {
    if (Array.isArray(label)) {
      journal_record['rdfs:label'] = label;
    } else {
      journal_record['rdfs:label'] = [
        {
          data: label,
          type: 'String',
        }];
    }
  }
  journal_record['v-s:subJournal'] = [
    {
      data: new_sub_journal_uri,
      type: 'Uri',
    }];
  veda.Util.logToJournal(ticket, parent_journal_uri, journal_record, true);

  put_individual(ticket, journal_record, _event_id);

  return new_sub_journal_uri;
};

Workflow.get_trace_journal = function (document, process) {
  const isTrace = document['v-wf:isTrace'];
  if (isTrace && veda.Util.getFirstValue(isTrace) == true) {
    return veda.Util.getTraceJournalUri(process['@']);
  } else {
    return undefined;
  }
};

// ///////////////////////////////////////////////////////////////////////////////////////

Workflow.create_new_subprocess = function (ticket, f_useSubNet, f_executor, parent_net, f_inVars, document, parent_trace_journal_uri) {
  try {
    const parent_process_uri = document['@'];

    let use_net;

    if (f_useSubNet) {
      use_net = f_useSubNet;
    } else {
      use_net = f_executor;
    }

    if (parent_trace_journal_uri) {
      veda.Util.traceToJournal(ticket, parent_trace_journal_uri, '[WO2.4] executor= ' + veda.Util.getUri(f_executor) + ' used net', veda.Util.getUri(use_net));
    }

    // var ctx = new Workflow.Context(work_item, ticket);
    // ctx.print_variables ('v-wf:inVars');
    const _started_net = get_individual(ticket, veda.Util.getUri(use_net));
    if (_started_net) {
      const new_process_uri = veda.Util.genUri() + '-prs';

      const new_process = {
        '@': new_process_uri,
        'rdf:type': [
          {
            data: 'v-wf:Process',
            type: 'Uri',
          }],
        'v-wf:instanceOf': use_net,
        'v-wf:parentWorkOrder': [
          {
            data: parent_process_uri,
            type: 'Uri',
          }],
        'v-s:created': [
          {
            data: new Date(),
            type: 'Datetime',
          }],
      };

      let msg = 'экземпляр маршрута :' + veda.Util.getFirstValue(_started_net['rdfs:label']) + ', запущен из ' + veda.Util.getFirstValue(parent_net['rdfs:label']);

      if (f_useSubNet) {
        msg += ', для ' + veda.Util.getUri(f_executor);
      }

      new_process['rdfs:label'] = [
        {
          data: msg,
          type: 'String',
        }];

      // возьмем входные переменные WorkItem  и добавим их процессу
      if (f_inVars) {
        new_process['v-wf:inVars'] = f_inVars;
      }

      if (f_useSubNet) {
        new_process['v-wf:executor'] = f_executor;
      }

      if (parent_trace_journal_uri) {
        veda.Util.traceToJournal(ticket, parent_trace_journal_uri, 'new_process=', veda.Util.getUri(use_net), veda.Util.toJson(new_process));
        new_process['v-wf:isTrace'] = veda.Util.newBool(true);

        const trace_journal_uri = veda.Util.getTraceJournalUri(new_process_uri);
        if (trace_journal_uri) {
          Workflow.create_new_journal(ticket, trace_journal_uri, null, _started_net['rdfs:label']);
          new_process['v-wf:traceJournal'] = veda.Util.newUri(trace_journal_uri);
        }
      }
      put_individual(ticket, new_process, _event_id);

      Workflow.create_new_subjournal(parent_process_uri, new_process_uri, 'запущен подпроцесс', 'v-wf:SubProcessStarted');

      document['v-wf:isProcess'] = [
        {
          data: new_process_uri,
          type: 'Uri',
        }];

      put_individual(ticket, document, _event_id);
    }
  } catch (e) {
    print(e.stack);
  }
};


Workflow.get_properties_chain = function (var1, query, result_if_fail_search) {
  let res = [];

  if (query.length < 1) {
    return res;
  }

  let doc;
  // print('@@@get_properties_chain#1 var1=', veda.Util.toJson(var1), ", query=", veda.Util.toJson (query));
  try {
    doc = get_individual(ticket, veda.Util.getUri(var1));

    if (doc) {
      Workflow.traversal(doc, query, 0, res);
    }

    // print('@@@get_properties_chain #2 res=', veda.Util.toJson(res));

    if (result_if_fail_search && (res == undefined || res.length == 0)) {
      res = result_if_fail_search;
    }

    // print('@@@get_properties_chain #3 res=', veda.Util.toJson(res));
  } catch (e) {
    print(e.stack);
  }

  return res;
};

Workflow.traversal = function (indv, query, pos_in_path, result) {
  const condition = query[pos_in_path];

  // print('@@@ traversal#0 condition=', veda.Util.toJson(condition), ", indv=", veda.Util.toJson(indv));

  let op_get;
  let op_go;
  let op_eq;
  for (const key in condition) {
    if (Object.hasOwnProperty.call(condition, key)) {
      const op = key;

      if (op == '$get') {
        op_get = condition[key];
      }

      if (op == '$go') {
        op_go = condition[key];
      }

      if (op == '$eq') {
        op_eq = condition[key];
      }
    }
  }
  if (op_go) {
    const ffs = indv[op_go];

    for (const i in ffs) {
      if (Object.hasOwnProperty.call(ffs, i)) {
        // print('@@@ traversal#2 ffs[i]=', ffs[i].data);
        const doc = get_individual(ticket, ffs[i].data);
        // print('@@@ traversal#4 doc=', veda.Util.toJson(doc));
        Workflow.traversal(doc, query, pos_in_path + 1, result);
      }
    }
  }

  if (op_get) {
    // print ("@1 op_get=", op_get);
    let is_get = true;
    if (op_eq) {
      is_get = false;

      const kk = Object.keys(op_eq);
      if (kk) {
        const field = kk[0];

        const A = indv[field];
        if (A) {
          // print("###1 A=", veda.Util.toJson(A));
          const B = op_eq[field];
          // print("###2 B=", veda.Util.toJson(B));

          for (const i in A) {
            if (A[i].type == B[0].type && A[i].data == B[0].data) {
              is_get = true;
              // print("###3 A == B");
              break;
            }
          }
        }
      }
    } else {
      is_get = true;
    }

    if (is_get && indv != undefined) {
      // print ("@2 op_get=", op_get);
      const ffs = indv[op_get];
      // print ("@3 op_get=", ffs);

      for (const i in ffs) {
        if (Object.hasOwnProperty.call(ffs, i)) {
          // print('@@@ traversal#3 push ', ffs[i].data);
          result.push(ffs[i]);
        }
      }
    }
  }
};

Workflow.remove_empty_branches_from_journal = function (journal_uri) {
  const jrn = get_individual(ticket, journal_uri);
  if (jrn && !jrn['v-s:childRecord']) {
    const parent_jrn_uri = veda.Util.getUri(jrn['v-s:parentJournal']);
    if (parent_jrn_uri) {
      const parent_jrn = get_individual(ticket, parent_jrn_uri);

      const child_records = parent_jrn['v-s:childRecord'];
      if (child_records) {
        for (let i = 0; i < child_records.length; i++) {
          const chr_uri = child_records[i].data;
          const chr = get_individual(ticket, chr_uri);
          if (chr && veda.Util.getUri(chr['v-s:subJournal']) == journal_uri) {
            const remove_from_journal = {
              '@': parent_jrn_uri,
              'v-s:childRecord': [
                {
                  data: chr_uri,
                  type: 'Uri',
                }],
            };
            remove_from_individual(ticket, remove_from_journal, _event_id);

            // print("@@@@@@@@ parent_jrn=", veda.Util.toJson(parent_jrn), ", remove_from_journal=", veda.Util.toJson(remove_from_journal));
            break;
          }
        }
      }
    }
  }
};

Workflow.getSystemUrl = function (var_to) {
  const userTo = get_individual(ticket, var_to[0].data);
  let isExternal = false;
  if (userTo['v-s:origin'] && userTo['v-s:origin'][0].data ==='ExternalUser') {
    isExternal = true;
  };
  const systemIndivid = isExternal ? veda.Util.newUri('cfg:SystemInfoExternal') : veda.Util.newUri('v-s:vedaInfo');
  return veda.Util.getFirstValue(Workflow.get_properties_chain(systemIndivid, [{$get: 'v-s:appUrl'}]));
};

Workflow.getInboxUrl = function (var_to) {
  const userTo = get_individual(ticket, var_to[0].data);
  let isExternal = false;
  if (userTo['v-s:origin'] && userTo['v-s:origin'][0].data ==='ExternalUser') {
    isExternal = true;
  };
  const systemIndivid = isExternal ? veda.Util.newUri('cfg:SystemInfoExternal') : veda.Util.newUri('v-s:vedaInfo');
  return veda.Util.getFirstValue(Workflow.get_properties_chain(systemIndivid, [{$get: 'v-wf:appInboxUrl'}]));
};

Workflow.isSubUnitOf = function (current, target, depth) {
  if (current.length == 0) return false;
  print('@@@@@isSubUnitOf run');
  depth = depth || 0;
  const dep = get_individual(ticket, current[0].data);
  if (!veda.Util.hasValue(dep, 'v-s:parentUnit') || depth > 16) {
    print('@@@@@isSubUnitOf parentUnit empty');
    return false;
  } else if (veda.Util.hasValue(dep, 'v-s:parentUnit', {data: target, type: 'Uri'})) {
    print('@@@@@isSubUnitOf parentUnit match');
    return true;
  } else {
    return Workflow.isSubUnitOf(dep['v-s:parentUnit'], target, depth + 1);
  }
};
