// WorkflowUtil engine utilities

import veda from '../common/veda.js';
import CommonUtil from '../common/util.js';
import ServerUtil from '../server/util.js';
import mustache from 'mustache';

const WorkflowUtil = {};

export default WorkflowUtil;

WorkflowUtil.create_work_item = function (ticket, process_uri, net_element_uri, parent_uri, _event_id, isTrace) {
  try {
    const new_uri = CommonUtil.genUri() + '-wit';
    const new_work_item = {
      '@': new_uri,
      'rdf:type': ServerUtil.newUri('v-wf:WorkItem'),
      'v-wf:forProcess': ServerUtil.newUri(process_uri),
      'v-wf:forNetElement': ServerUtil.newUri(net_element_uri),
      'v-s:created': ServerUtil.newDate(new Date()),
      'v-s:creator': ServerUtil.newUri('cfg:VedaSystem'),
    };

    if (isTrace) {
      new_work_item['v-wf:isTrace'] = ServerUtil.newBool(true);
    }

    if (parent_uri !== null) {
      new_work_item['v-wf:previousWorkItem'] = ServerUtil.newUri(parent_uri);
    }

    put_individual(ticket, new_work_item, _event_id);

    return new_uri;
  } catch (e) {
    print(e.stack);
  }
};

WorkflowUtil.WorkItemResult = function (_work_item_result) {
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

    if (!this.work_item_result || this.work_item_result.length == 0) {
      return false;
    }

    let true_count = 0;
    for (const i in this.work_item_result) {
      if (Object.hasOwnProperty.call(this.work_item_result, i)) {
        const wirv = this.work_item_result[i][var_name];
        if (wirv && wirv.length == value.length) {
          for (const j in wirv) {
            if (Object.hasOwnProperty.call(wirv, j)) {
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

    for (const item of this.work_item_result) {
      if (item.result) {
        return true;
      }
    }

    return false;
  };

  this.is_all_executors_taken_decision = function (var_name, value) {
    if (!value || value.length < 1) {
      return false;
    }

    let count_agreed = 0;
    for (const item of this.work_item_result) {
      const wirv = item[var_name];

      if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type) {
        count_agreed++;
      }
    }

    return count_agreed === this.work_item_result.length;
  };

  this.is_all_executors_taken_decision_subClassOf = function (var_name, value) {
    if (!value || value.length < 1) {
      return false;
    }
    const decisionClassUri = value[0].data;

    let count_taken = 0;
    for (const item of this.work_item_result) {
      const wirv = item?.[var_name];
      const itemDecisionClassUri = wirv?.[0]?.data;
      const itemDecisionSuperClassesUris = veda.ontology.classTree[itemDecisionClassUri].superClasses;
      if (itemDecisionClassUri && (itemDecisionClassUri === decisionClassUri || itemDecisionSuperClassesUris.indexOf(decisionClassUri) >= 0)) {
        count_taken++;
      }
    }

    return count_taken === this.work_item_result.length;
  };

  this.is_some_executor_taken_decision = function (var_name, value) {
    if (!value || value.length < 1) {
      return false;
    }

    for (const item of this.work_item_result) {
      const wirv = item[var_name];

      if (wirv && wirv.length > 0 && wirv[0].data == value[0].data && wirv[0].type == value[0].type) {
        return true;
      }
    }

    return false;
  };

  this.is_some_executor_taken_decision_subClassOf = function (var_name, value) {
    if (!value || value.length < 1) {
      return false;
    }
    const decisionClassUri = value[0].data;

    for (const item of this.work_item_result) {
      const wirv = item?.[var_name];
      const itemDecisionClassUri = wirv?.[0]?.data;
      const itemDecisionSuperClassesUris = veda.ontology.classTree[itemDecisionClassUri].superClasses;
      if (itemDecisionClassUri && (itemDecisionClassUri === decisionClassUri || itemDecisionSuperClassesUris.indexOf(decisionClassUri) >= 0)) {
        return true;
      }
    }

    return false;
  };
};

WorkflowUtil.is_some_content_value = function (a, b) {
  for (const a_el of a) {
    for (const b_el of b) {
      if (a_el.type == b_el.type && a_el.data == b_el.data) {
        return true;
      }
    }
  }
  return false;
};

WorkflowUtil.Context = function (_src_data, _ticket) {
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
      for (const src_data_el of this.src_data) {
        if (src_data_el.result == true_decision) {
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
      const variables = this.src_data[io];

      if (variables) {
        for (const item of variables) {
          const variable = get_individual(this.ticket, item.data);
          if (!variable) continue;

          const variable_name = ServerUtil.getFirstValue(variable['v-wf:variableName']);

          if (variable_name == var_name) {
            return variable['v-wf:variableValue'];
          }
        }
      }
    } catch (e) {
      print(e.stack);
      return false;
    }
  };

  this.print_variables = function (io) {
    try {
      const variables = this.src_data[io];

      if (variables) {
        for (const item of variables) {
          const variable = get_individual(this.ticket, item.data);
          if (!variable) continue;
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

WorkflowUtil.get_new_variable = function (variable_name, value) {
  try {
    const new_uri = CommonUtil.genUri() + '-var';
    const new_variable = {
      '@': new_uri,
      'rdf:type': ServerUtil.newUri('v-wf:Variable'),
      'v-wf:variableName': ServerUtil.newStr(variable_name),
      'v-s:created': ServerUtil.newDate(new Date()),
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

WorkflowUtil.store_items_and_set_minimal_rights = function (ticket, data) {
  try {
    const ids = [];
    for (const item of data) {
      if (item['v-s:created'] == undefined) {
        item['v-s:created'] = ServerUtil.newDate(new Date());
      } else {
        item['v-s:edited'] = ServerUtil.newDate(new Date());
      }

      if (item['v-s:creator'] == undefined) {
        item['v-s:creator'] = ServerUtil.newUri('cfg:VedaSystem');
      }

      put_individual(ticket, item, _event_id);

      ids.push(
        {
          data: item['@'],
          type: 'Uri',
        });

      // ServerUtil.addRight(ticket, 'v-wf:WorkflowReadUser', item['@'], ['v-s:canRead']);
    }
    return ids;
  } catch (e) {
    print(e.stack);
  }
};

WorkflowUtil.generate_variable = function (ticket, def_variable, value, _process, _task, _task_result) {
  try {
    const variable_name = ServerUtil.getFirstValue(def_variable['v-wf:varDefineName']);
    const new_variable = WorkflowUtil.get_new_variable(variable_name, value);
    const variable_scope = ServerUtil.getUri(def_variable['v-wf:varDefineScope']);
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
          // найдем среди локальных переменных процесса, такую переменную
          // если нашли, то новая переменная должна перезаписать переменную процесса
          for (const item of local_vars) {
            const local_var = get_individual(ticket, item.data);
            if (!local_var) continue;

            const var_name = ServerUtil.getFirstValue(local_var['v-wf:variableName']);
            if (!var_name) continue;

            if (var_name == variable_name) {
              find_local_var = local_var;
              break;
            }
          }

          if (find_local_var) {
            // нашли, обновим значение в локальной переменной
            find_local_var['v-wf:variableValue'] = value;
            put_individual(ticket, find_local_var, _event_id);
          }
        } else {
          local_vars = [];
        }

        if (!find_local_var) {
          // если не нашли то сделать копию и привязать ее переменную к процессу
          const new_variable_for_local = WorkflowUtil.get_new_variable(variable_name, value);
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

          local_vars.push(ServerUtil.newUri(new_variable_for_local['@'])[0]);
          _process['v-wf:localVars'] = local_vars;
        }
      }
    }
    return new_variable;
  } catch (e) {
    print(e.stack);
    throw e;
  }
};

WorkflowUtil.create_and_mapping_variables = function (ticket, mapping, _process, _task, _order, _task_result, f_store, trace_journal_uri, trace_comment) {
  try {
    const _trace_info = [];

    const new_vars = [];
    if (!mapping) return [];

    let process;
    let task;
    let order;
    let task_result;

    if (_process) {
      process = new WorkflowUtil.Context(_process, ticket);
    }

    if (_task) {
      task = new WorkflowUtil.Context(_task, ticket);
    }

    if (_order) {
      order = new WorkflowUtil.Context(_order, ticket);
    }

    if (_task_result) {
      task_result = new WorkflowUtil.WorkItemResult(_task_result);
    }

    for (const mapping_item of mapping) {
      const map = get_individual(ticket, mapping_item.data);

      if (map) {
        const expression = ServerUtil.getFirstValue(map['v-wf:mappingExpression']);
        if (!expression) continue;

        try {
          const res1 = eval(expression);
          if (!res1) continue;

          const mapToVariable_uri = ServerUtil.getUri(map['v-wf:mapToVariable']);
          if (!mapToVariable_uri) continue;

          const def_variable = get_individual(ticket, mapToVariable_uri);
          if (!def_variable) continue;

          const new_variable = WorkflowUtil.generate_variable(ticket, def_variable, res1, _process, _task, _task_result);
          if (new_variable) {
            if (f_store) {
              put_individual(ticket, new_variable, _event_id);

              if (trace_journal_uri) {
                _trace_info.push(new_variable);
              }

              new_vars.push(
                {
                  data: new_variable['@'],
                  type: 'Uri',
                });
            } else {
              new_vars.push(new_variable);
            }
          }
        } catch (e) {
          if (trace_journal_uri) {
            ServerUtil.traceToJournal(ticket, trace_journal_uri, 'create_and_mapping_variables', 'err: expression: ' + expression + '\n' + e.stack);
          }
        }
      } else {
        if (trace_journal_uri) {
          ServerUtil.traceToJournal(ticket, trace_journal_uri, 'create_and_mapping_variables', 'map not found :' + mapping_item.data);
        }
      }
    }

    if (trace_journal_uri) {
      ServerUtil.traceToJournal(ticket, trace_journal_uri, 'create_and_mapping_variables', trace_comment + ' = \'' + ServerUtil.getUris(mapping) + '\' \n\nout = \n' + CommonUtil.toJson(_trace_info));
    }

    return new_vars;
  } catch (e) {
    print(e.stack);
    return [];
  }
};

// ////////////////////////////////////////////////////////////////////////

WorkflowUtil.find_in_work_item_tree = function (ticket, _process, compare_field, compare_value) {
  try {
    const res = [];

    const f_workItemList = _process['v-wf:workItemList'];

    if (f_workItemList) {
      WorkflowUtil.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, _process);
    }

    return res;
  } catch (e) {
    print(e.stack);
  }
};

WorkflowUtil.rsffiwit = function (ticket, work_item_list, compare_field, compare_value, res, _parent) {
  try {
    for (const work_item of work_item_list) {
      const i_work_item = get_individual(ticket, work_item.data);
      if (i_work_item) {
        const ov = i_work_item[compare_field];
        const isCompleted = i_work_item['v-wf:isCompleted'];

        if (ov && ServerUtil.getUri(ov) == compare_value && !isCompleted) {
          res.push(
            {
              parent: _parent,
              work_item: i_work_item,
            });
        }

        const f_workItemList = i_work_item['v-wf:workItemList'];

        if (f_workItemList) {
          WorkflowUtil.rsffiwit(ticket, f_workItemList, compare_field, compare_value, res, i_work_item);
        }
      }
    }
  } catch (e) {
    print(e.stack);
  }
};

// /////////////////////////////////////////// JOURNAL //////////////////////////////////////////////////
WorkflowUtil.create_new_journal = function (ticket, new_journal_uri, parent_journal_uri, label, is_trace) {
  try {
    const exists_journal = get_individual(ticket, new_journal_uri);

    if (!exists_journal) {
      const new_journal = {
        '@': new_journal_uri,
        'rdf:type': ServerUtil.newUri('v-s:Journal'),
        'v-s:created': ServerUtil.newDate(new Date()),
      };

      if (parent_journal_uri) {
        WorkflowUtil.create_new_journal(ticket, parent_journal_uri, null, '', is_trace);
        new_journal['v-s:parentJournal'] = ServerUtil.newUri(parent_journal_uri);
      }

      if (label) {
        new_journal['rdfs:label'] = label;
      }

      if (is_trace) {
        new_journal['v-wf:isTrace'] = ServerUtil.newBool(true);
      }

      put_individual(ticket, new_journal, _event_id);
    }
    return new_journal_uri;
  } catch (e) {
    print(e.stack);
  }
};

WorkflowUtil.mapToJournal = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment) {
  try {
    if (journal_uri && map_container) {
      // выполнить маппинг для журнала
      let journalVars = [];

      if (_task && msg) {
        _task['rdfs:label'] = msg;
      }

      journalVars = WorkflowUtil.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);
      if (journalVars) {
        const new_journal_record = ServerUtil.newJournalRecord(journal_uri);
        for (const journalVar of journalVars) {
          const jvar = journalVar;
          const name = ServerUtil.getFirstValue(jvar['v-wf:variableName']);
          const value = jvar['v-wf:variableValue'];
          new_journal_record[name] = value;
        }
        ServerUtil.logToJournal(ticket, journal_uri, new_journal_record);
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

WorkflowUtil.getAppName = function () {
  const appInfo = get_individual(ticket, 'v-s:vedaInfo');
  return appInfo ? ServerUtil.getFirstValue(appInfo['rdfs:label']) : '';
};

WorkflowUtil.mapToMessage = function (map_container, ticket, _process, _task, _order, msg, journal_uri, trace_journal_uri, trace_comment) {
  try {
    if (journal_uri && map_container) {
      // выполнить маппинг для сообщения
      let messageVars = [];
      messageVars = WorkflowUtil.create_and_mapping_variables(ticket, map_container, _process, _task, _order, null, false, trace_journal_uri, trace_comment);


      if (messageVars) {
        const new_message_uri = CommonUtil.genUri() + '-msg';
        const new_message = {
          '@': new_message_uri,
          'v-s:created': ServerUtil.newDate(new Date()),
        };

        let template;

        for (const messageVar of messageVars) {
          const name = ServerUtil.getFirstValue(messageVar['v-wf:variableName']);
          const value = messageVar['v-wf:variableValue'];

          if (name == '$template') {
            template = get_individual(ticket, ServerUtil.getUri(value));
          }

          if (name.indexOf(':') > 0) {
            new_message[name] = value;
          }
        }

        if (template) {
          let lang = template['v-s:notificationLanguage'];
          const subject = ServerUtil.getFirstValue(template['v-s:notificationSubject']);
          const body = ServerUtil.getFirstValue(template['v-s:notificationBody']);

          if (lang) {
            const lang_indv = get_individual(ticket, lang);

            if (lang_indv && lang_indv['rdf:value']) {
              lang = ServerUtil.getFirstValue(lang_indv['rdf:value']).toLowerCase();
            } else {
              lang = 'RU';
            }
          } else {
            lang = 'RU';
          }
          const view = {
            'app_name': WorkflowUtil.getAppName,
          };

          for (const messageVar of messageVars) {
            const name = ServerUtil.getFirstValue(messageVar['v-wf:variableName']);
            if (name == '$template' || name.indexOf(':') > 0) {
              continue;
            }
            const values = messageVar['v-wf:variableValue'];
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

                  value = ServerUtil.getFirstValueUseLang(inner_indv['rdfs:label'], lang);

                  if (!value) {
                    value = ServerUtil.getFirstValue(inner_indv['rdfs:label']);
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
          const output_subject = mustache.render(subject, view).replace(/&#x2F;/g, '/');
          const output_body = mustache.render(body, view).replace(/&#x2F;/g, '/');
          new_message['v-s:subject'] = ServerUtil.newStr(output_subject, lang);
          new_message['v-s:messageBody'] = ServerUtil.newStr(output_body, lang);
          new_message['v-wf:onWorkOrder'] = ServerUtil.newUri(_order['@']);
          new_message['v-s:hasMessageType'] = template['v-s:hasMessageType'];
          put_individual(ticket, new_message, _event_id);
        }
      }
    }
  } catch (e) {
    print(e.stack);
  }
};


WorkflowUtil.create_new_subjournal = function (parent_uri, el_uri, label, jtype) {
  return WorkflowUtil._create_new_subjournal(false, parent_uri, el_uri, label, jtype);
};

WorkflowUtil.create_new_trace_subjournal = function (parent_uri, net_element_impl, label, jtype) {
  const isTrace = net_element_impl['v-wf:isTrace'];

  if (!isTrace || isTrace && ServerUtil.getFirstValue(isTrace) === false) {
    return undefined;
  }

  const el_uri = net_element_impl['@'];

  const new_sub_journal_uri = WorkflowUtil._create_new_subjournal(true, parent_uri, el_uri, label, jtype);

  const set_journal_to_element = {
    '@': el_uri,
    'v-wf:traceJournal': ServerUtil.newUri(new_sub_journal_uri),
    'v-s:created': ServerUtil.newDate(new Date()),
  };
  add_to_individual(ticket, set_journal_to_element, _event_id);

  return new_sub_journal_uri;
};

WorkflowUtil._create_new_subjournal = function (is_trace, parent_uri, el_uri, label, jtype) {
  let new_sub_journal_uri;
  let parent_journal_uri;

  if (is_trace) {
    new_sub_journal_uri = ServerUtil.getTraceJournalUri(el_uri);
    parent_journal_uri = ServerUtil.getTraceJournalUri(parent_uri);
  } else {
    new_sub_journal_uri = ServerUtil.getJournalUri(el_uri);
    parent_journal_uri = ServerUtil.getJournalUri(parent_uri);
  }

  const cj = get_individual(ticket, new_sub_journal_uri);
  if (cj) {
    return new_sub_journal_uri;
  } else {
    WorkflowUtil.create_new_journal(ticket, new_sub_journal_uri, parent_journal_uri, label, is_trace);
  }

  const journal_record = ServerUtil.newJournalRecord(parent_journal_uri);
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
  ServerUtil.logToJournal(ticket, parent_journal_uri, journal_record, true);

  put_individual(ticket, journal_record, _event_id);

  return new_sub_journal_uri;
};

WorkflowUtil.get_trace_journal = function (document, process) {
  const isTrace = document['v-wf:isTrace'];
  if (isTrace && ServerUtil.getFirstValue(isTrace) === true) {
    return ServerUtil.getTraceJournalUri(process['@']);
  } else {
    return undefined;
  }
};

// ///////////////////////////////////////////////////////////////////////////////////////

WorkflowUtil.create_new_subprocess = function (ticket, f_useSubNet, f_executor, parent_net, f_inVars, document, parent_trace_journal_uri) {
  try {
    const parent_process_uri = document['@'];

    let use_net;

    if (f_useSubNet) {
      use_net = f_useSubNet;
    } else {
      use_net = f_executor;
    }

    if (parent_trace_journal_uri) {
      ServerUtil.traceToJournal(ticket, parent_trace_journal_uri, '[WO2.4] executor= ' + ServerUtil.getUri(f_executor) + ' used net', ServerUtil.getUri(use_net));
    }

    const _started_net = get_individual(ticket, ServerUtil.getUri(use_net));
    if (_started_net) {
      const new_process_uri = CommonUtil.genUri() + '-prs';

      const new_process = {
        '@': new_process_uri,
        'rdf:type': ServerUtil.newUri('v-wf:Process'),
        'v-wf:instanceOf': use_net,
        'v-wf:parentWorkOrder': ServerUtil.newUri(parent_process_uri),
        'v-s:created': ServerUtil.newDate(new Date()),
      };

      let msg = 'экземпляр маршрута :' + ServerUtil.getFirstValue(_started_net['rdfs:label']) + ', запущен из ' + ServerUtil.getFirstValue(parent_net['rdfs:label']);

      if (f_useSubNet) {
        msg += ', для ' + ServerUtil.getUri(f_executor);
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
        ServerUtil.traceToJournal(ticket, parent_trace_journal_uri, 'new_process=', ServerUtil.getUri(use_net), CommonUtil.toJson(new_process));
        new_process['v-wf:isTrace'] = ServerUtil.newBool(true);

        const trace_journal_uri = ServerUtil.getTraceJournalUri(new_process_uri);
        if (trace_journal_uri) {
          WorkflowUtil.create_new_journal(ticket, trace_journal_uri, null, _started_net['rdfs:label']);
          new_process['v-wf:traceJournal'] = ServerUtil.newUri(trace_journal_uri);
        }
      }
      put_individual(ticket, new_process, _event_id);

      WorkflowUtil.create_new_subjournal(parent_process_uri, new_process_uri, 'запущен подпроцесс', 'v-wf:SubProcessStarted');

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


WorkflowUtil.get_properties_chain = function (var1, query, result_if_fail_search) {
  let res = [];

  if (query.length < 1) {
    return res;
  }

  let doc;

  try {
    doc = get_individual(ticket, ServerUtil.getUri(var1));

    if (doc) {
      WorkflowUtil.traversal(doc, query, 0, res);
    }

    if (result_if_fail_search && (res == undefined || res.length == 0)) {
      res = result_if_fail_search;
    }
  } catch (e) {
    print(e.stack);
  }

  return res;
};

WorkflowUtil.traversal = function (indv, query, pos_in_path, result) {
  const condition = query[pos_in_path];

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
        const doc = get_individual(ticket, ffs[i].data);
        WorkflowUtil.traversal(doc, query, pos_in_path + 1, result);
      }
    }
  }

  if (op_get) {
    let is_get = true;
    if (op_eq) {
      is_get = false;

      const kk = Object.keys(op_eq);
      if (kk) {
        const field = kk[0];

        const A = indv[field];
        if (A) {
          const B = op_eq[field];

          for (const i in A) {
            if (A[i].type == B[0].type && A[i].data == B[0].data) {
              is_get = true;
              break;
            }
          }
        }
      }
    }

    if (is_get && indv != undefined) {
      const ffs = indv[op_get];
      for (const i in ffs) {
        if (Object.hasOwnProperty.call(ffs, i)) {
          result.push(ffs[i]);
        }
      }
    }
  }
};

WorkflowUtil.remove_empty_branches_from_journal = function (journal_uri) {
  const jrn = get_individual(ticket, journal_uri);
  if (jrn && !jrn['v-s:childRecord']) {
    const parent_jrn_uri = ServerUtil.getUri(jrn['v-s:parentJournal']);
    if (parent_jrn_uri) {
      const parent_jrn = get_individual(ticket, parent_jrn_uri);

      const child_records = parent_jrn['v-s:childRecord'];
      if (child_records) {
        for (const child_record of child_records) {
          const chr_uri = child_record.data;
          const chr = get_individual(ticket, chr_uri);
          if (chr && ServerUtil.getUri(chr['v-s:subJournal']) == journal_uri) {
            const remove_from_journal = {
              '@': parent_jrn_uri,
              'v-s:childRecord': [
                {
                  data: chr_uri,
                  type: 'Uri',
                }],
            };
            remove_from_individual(ticket, remove_from_journal, _event_id);
            break;
          }
        }
      }
    }
  }
};

WorkflowUtil.getSystemUrl = function (var_to) {
  const userTo = get_individual(ticket, var_to[0].data);
  let isExternal = false;
  if (userTo['v-s:origin'] && userTo['v-s:origin'][0].data ==='ExternalUser') {
    isExternal = true;
  }
  const systemIndivid = isExternal ? ServerUtil.newUri('cfg:SystemInfoExternal') : ServerUtil.newUri('v-s:vedaInfo');
  return ServerUtil.getFirstValue(WorkflowUtil.get_properties_chain(systemIndivid, [{$get: 'v-s:appUrl'}]));
};

WorkflowUtil.getInboxUrl = function (var_to) {
  const userTo = get_individual(ticket, var_to[0].data);
  let isExternal = false;
  if (userTo['v-s:origin'] && userTo['v-s:origin'][0].data ==='ExternalUser') {
    isExternal = true;
  }
  const systemIndivid = isExternal ? ServerUtil.newUri('cfg:SystemInfoExternal') : ServerUtil.newUri('v-s:vedaInfo');
  return ServerUtil.getFirstValue(WorkflowUtil.get_properties_chain(systemIndivid, [{$get: 'v-wf:appInboxUrl'}]));
};

WorkflowUtil.isSubUnitOf = function (current, target, depth) {
  if (current.length == 0) return false;
  print('@@@@@isSubUnitOf run');
  depth = depth || 0;
  const dep = get_individual(ticket, current[0].data);
  if (!CommonUtil.hasValue(dep, 'v-s:parentUnit') || depth > 16) {
    print('@@@@@isSubUnitOf parentUnit empty');
    return false;
  } else if (CommonUtil.hasValue(dep, 'v-s:parentUnit', {data: target, type: 'Uri'})) {
    print('@@@@@isSubUnitOf parentUnit match');
    return true;
  } else {
    return WorkflowUtil.isSubUnitOf(dep['v-s:parentUnit'], target, depth + 1);
  }
};
