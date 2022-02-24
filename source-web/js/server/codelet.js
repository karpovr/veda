// Codelets

import Sha256 from '../common/lib/sha256.js';

import ServerUtil from '../server/util.js';

import WorkflowUtil from '../server/workflow_util.js';

const Codelet = {};

export default Codelet;

Codelet.down_right_and_store = function (process, task) {
  return Codelet.change_rights(process, task, [
    {
      'data': '-r--',
    }]);
};

Codelet.change_rights = function (process, task, rightset) {
  return Codelet.change_rights_actor(process, task, [
    {
      'data': '-r--',
    }], 'actor');
};

Codelet.change_rights_actor = function (process, task, rightset, actor, docId, executors) {
  try {
    let doc_id;
    if (docId) {
      doc_id = docId;
    } else {
      doc_id = process.getInputVariable('docId');
    }
    const allow_set = [];
    if (rightset[0].data.indexOf('r') >= 0) {
      allow_set.push('v-s:canRead');
    }
    if (rightset[0].data.indexOf('u') >= 0) {
      allow_set.push('v-s:canUpdate');
    }
    if (doc_id) {
      let executorArr;
      if (executors) {
        executorArr = executors;
      } else {
        executorArr = (process.getLocalVariable(actor)) ? process.getLocalVariable(actor) : process.getExecutor();
        if (!executorArr) executorArr = task.getInputVariable(actor);
        if (!executorArr) {
          executorArr = [executorArr];
        }
      }

      for (const item of executorArr) {
        let executor = [item];
        print('@JS3 executor=', ServerUtil.toJson(executor));
        const employee = WorkflowUtil.get_properties_chain(executor, [
          {
            $get: 'v-s:employee',
          }], undefined);

        print('@JS4 employee=', ServerUtil.toJson(employee));
        if (employee) {
          const employee_uri = ServerUtil.getUri(employee);

          if (employee_uri) {
            ServerUtil.addRight(ticket, employee_uri, ServerUtil.getUri(doc_id), allow_set);
          } else {
            print('ERR! change_rights_actor: undefined employee_uri, actor=[' + actor + '], executor=' + ServerUtil.toJson(executor) + ', doc_id=' + ServerUtil.getUri(doc_id) + ', process=' + ServerUtil.getUri(process) + ', task=' + ServerUtil.getUri(task));
          }
        }

        executor = WorkflowUtil.get_properties_chain(executor, [
          {
            $get: 'v-s:occupation',
          }], executor);

        if (!executor) {
          print('@JS executor undefined, actor=', process.getLocalVariable(actor));
        }

        if (executor) {
          const executor_uri = ServerUtil.getUri(executor);
          if (executor_uri) {
            ServerUtil.addRight(ticket, executor_uri, ServerUtil.getUri(doc_id), allow_set);
          } else {
            print('ERR! change_rights_actor: undefined executor_uri, actor=[' + actor + '], executor=' + ServerUtil.toJson(executor) + ', doc_id=' + ServerUtil.getUri(doc_id) + ', process=' + ServerUtil.getUri(process) + ', task=' + ServerUtil.getUri(task));
          }
        }
      }
    }
    return [WorkflowUtil.get_new_variable('right', ServerUtil.newStr('acl1'))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.restore_right = function (task) {
  try {
    return [WorkflowUtil.get_new_variable('result', ServerUtil.newStr('Ok'))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.complete_process = function (ticket, process, _event_id) {
  Codelet.change_process_status(ticket, process, 'v-wf:Completed', _event_id);
};

Codelet.interrupt_process = function (ticket, process, _event_id) {
  Codelet.change_process_status(ticket, process, 'v-wf:Interrupted', _event_id);
};

Codelet.change_process_status = function (ticket, process, status, _event_id) {
  const vars = process['v-wf:inVars'];
  if (!vars) return;
  for (const item of vars) {
    const variable = get_individual(process.ticket, item.data);
    if (variable &&
            variable['v-wf:variableName'][0] &&
            variable['v-wf:variableName'][0].data == 'docId') {
      const doc = get_individual(ticket, variable['v-wf:variableValue'][0].data);

      if (!doc['v-wf:isProcess']) continue;
      for (const isProcessValue of doc['v-wf:isProcess']) {
        if (isProcessValue.data == process['@']) {
          delete doc['v-wf:isProcess'];
          doc['v-wf:hasStatusWorkflow'] = ServerUtil.newUri(status);
          put_individual(ticket, doc, _event_id);
          break;
        }
      }
    }
  }
};

Codelet.change_document_workflow_status = function (process, status) {
  // status: InProcess, InReworking
  const doc_id = process.getInputVariable('docId');
  if (doc_id) {
    const set_in_document = {
      '@': ServerUtil.getUri(doc_id),
    };
    set_in_document['v-wf:hasStatusWorkflow'] = ServerUtil.newUri(status);

    set_in_individual(process.ticket, set_in_document, _event_id);
  }
  return [WorkflowUtil.get_new_variable('workflowStatus', ServerUtil.newStr(status))];
};

Codelet.change_document_status = function (process, status) {
  if ( status ) {
    const setStatus=process.getInputVariable('setStatus');
    if (setStatus && setStatus[0].data === true) {
      const doc_id = process.getInputVariable('docId');
      if (doc_id) {
        const set_in_document = {
          '@': ServerUtil.getUri(doc_id),
        };
        set_in_document['v-s:hasStatus'] = ServerUtil.newUri(status);
        if (status == 'v-s:StatusExecuted') {
          set_in_document['v-s:dateFact'] = ServerUtil.newDate(Date.now());
        } else if (status == 'v-s:StatusExecution') {
          const doc = get_individual(process.ticket, ServerUtil.getUri(doc_id));
          if (doc && !doc['v-s:dateToPlan'] && (doc['v-s:count'] && doc['v-s:count'].length > 0)) {
            set_in_document['v-s:dateFromPlan'] = ServerUtil.newDate(new Date().setHours(0, 0, 0, 0));
            const countDays = doc['v-s:count'][0].data;
            const dueDate = new Date(Date.now() + countDays*86400000).setHours(0, 0, 0, 0);
            set_in_document['v-s:dateToPlan'] = ServerUtil.newDate(dueDate);
          }
        }
        set_in_individual(process.ticket, set_in_document, _event_id);
      }
    }
  }
  return [WorkflowUtil.get_new_variable('status', ServerUtil.newStr(status))];
};

Codelet.createPermissionStatement = function (process, stage) {
  print('###### Start Codelet.createPermissionStatement ######');
  const docId = process.getInputVariable('docId');
  print('docId:', ServerUtil.toJson(docId));
  let subjectAppointmentUri;
  let statementUri;
  if (stage === 'rework') {
    subjectAppointmentUri = process.getLocalVariable('responsible');
    statementUri = docId[0].data + '-pf-rework';
  } else if (stage === 'task') {
    subjectAppointmentUri = process.getLocalVariable('actor');
    statementUri = docId[0].data + '-pf-task';
  }
  print('subjectAppointmentUri: ', ServerUtil.toJson(subjectAppointmentUri));
  if (subjectAppointmentUri) {
    const subjectAppointment = get_individual(ticket, subjectAppointmentUri[0].data);
    if (subjectAppointment) {
      const permissionStatement= {
        '@': statementUri,
        'rdf:type': ServerUtil.newUri('v-s:PermissionStatement'),
        'v-s:useFilter': ServerUtil.newUri('v-s:StatusStarted'),
        'v-s:permissionObject': docId,
        'v-s:permissionSubject': subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation']),
        'v-s:canUpdate': ServerUtil.newBool('true'),
      };
      print('@@@@@responsible:', ServerUtil.toJson(subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation'])));
      put_individual(ticket, permissionStatement, _event_id);
      print('put_individual: ', statementUri);
    } else {
      print('Error create_permission_statement_executor: not found subjectAppointment: ', subjectAppointmentUri);
    }
  } else {
    print('Error create_permission_statement_executor: not found local variable \'responsible\'');
  }
  print('###### Finish Codelet.createPermissionStatement ######');
  return ServerUtil.newStr(statementUri);
};

Codelet.deletePermissionStatement = function (process, stage) {
  print('###### Start Codelet.deletePermissionStatement ######');
  const docId = process.getInputVariable('docId');
  print('docId:', ServerUtil.toJson(docId));
  let statementUri;
  if (stage === 'rework') {
    statementUri = docId[0].data + '-pf-rework';
  } else if (stage === 'task') {
    statementUri = docId[0].data + '-pf-task';
  }
  const set_in_statement = {
    '@': statementUri,
    'v-s:deleted': ServerUtil.newBool('true'),
  };
  set_in_individual(ticket, set_in_statement);
  print('###### Finish Codelet.deletePermissionStatement ######');
  return ServerUtil.newStr('empty');
};

Codelet.is_exists_net_executor = function (process) {
  try {
    const res = process.getExecutor() !== undefined;
    return [WorkflowUtil.get_new_variable('res', ServerUtil.newBool(res))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.get_type_of_docId = function (task) {
  try {
    let res = '?';

    if (task) {
      const doc_id = task.getInputVariable('docId');
      if (doc_id) {
        const doc = get_individual(task.ticket, doc_id[0].data);

        if (doc) {
          res = doc['rdf:type'][0].data;
        }
      }
    }

    return [WorkflowUtil.get_new_variable('res', ServerUtil.newUri(res))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.is_in_docflow_and_set_if_true = function (task) {
  try {
    const res = false;
    if (task) {
      const doc_id = task.getInputVariable('docId');
      if (doc_id) {
        const forProcess = ServerUtil.getUri(task.src_data['v-wf:forProcess']);
        const process = get_individual(task.ticket, forProcess);
        if (process) {
          const instanceOf = ServerUtil.getUri(process['v-wf:instanceOf']);

          const net_doc_id = instanceOf + '_' + doc_id[0].data;

          const new_doc = {
            '@': net_doc_id,
            'rdf:type': [{
              data: 'v-wf:Variable',
              type: 'Uri',
            }],
          };
          put_individual(task.ticket, new_doc, _event_id);

          const add_to_document = {
            '@': doc_id[0].data,
            'v-wf:isProcess': ServerUtil.newUri(process['@']),
          };
          print('$ add_to_document >>' + ServerUtil.toJson(add_to_document));
          add_to_individual(ticket, add_to_document, _event_id);
        }
      }
    }

    return [WorkflowUtil.get_new_variable('result', ServerUtil.newUri(res))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.add_value_to_document = function (process, task) {
  try {
    let src_uri;

    if (task) {
      src_uri = task.getInputVariable('src_uri');
      let name_uri = task.getInputVariable('name_uri');
      const value = task.getInputVariable('value');

      let src;

      if (name_uri && value) {
        src = get_individual(task.ticket, ServerUtil.getUri(src_uri));
        if (src) {
          name_uri = ServerUtil.getUri(name_uri);
          let ch_value = src[name_uri];

          if (!ch_value) {
            ch_value = [];
          }

          for (const key in value) {
            if (Object.hasOwnProperty.call(value, key)) {
              ch_value.push(value[key]);
            }
          }

          src[name_uri] = ch_value;
          put_individual(ticket, src, _event_id);
        }
      }
    }

    return [WorkflowUtil.get_new_variable('res', src_uri)];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.set_value_to_document = function (process, task) {
  try {
    let src_uri;

    if (task) {
      src_uri = task.getInputVariable('src_uri');
      let name_uri = task.getInputVariable('name_uri');
      const value = task.getInputVariable('value');

      let src;

      if (name_uri && value) {
        src = get_individual(task.ticket, ServerUtil.getUri(src_uri));
        if (src) {
          name_uri = ServerUtil.getUri(name_uri);
          src[name_uri] = value;
          put_individual(ticket, src, _event_id);
        }
      }
    }

    return [WorkflowUtil.get_new_variable('res', src_uri)];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.create_use_transformation = function (process, task) {
  try {
    const new_items_uri = [];

    if (task) {
      const src_doc_id = task.getInputVariable('src_uri');
      const transform_link = task.getInputVariable('transformation_uri');

      if (transform_link) {
        const transform = get_individual(task.ticket, ServerUtil.getUri(transform_link));
        if (transform) {
          const document = get_individual(task.ticket, ServerUtil.getUri(src_doc_id));
          if (document) {
            const new_items = ServerUtil.transformation(task.ticket, document, transform, null, null, ServerUtil.newUri(process.src_data['@']));
            for (const new_item of new_items) {
              put_individual(ticket, new_item, _event_id);
              new_items_uri.push(
                {
                  data: new_item['@'],
                  type: 'Uri',
                });
            }
          }
        }
      }
    }

    return [WorkflowUtil.get_new_variable('res', new_items_uri)];
  } catch (e) {
    print(e.stack);
  }
};

// скрипт поиска в документе uri > 64
Codelet.find_long_terms = function (ticket, uri, execute_script) {
  const event_id = '';
  let cid = get_from_ght('cid');
  if (!cid) {
    let count_appts = 0;
    cid = new_uris_consumer();
    put_to_ght('cid', cid);
    print('new cid=' + cid);

    let i_uri = '?';
    while (i_uri) {
      i_uri = uris_pop(cid);

      if (i_uri) {
        uris_commit_and_next(cid, true);
        if (i_uri.length > 63) {
          const document = get_individual(ticket, i_uri);

          if (document) {
            if ( ServerUtil.hasValue(document, 'rdf:type', {data: 'v-s:Appointment', type: 'Uri'}) ) {
              let hash = Sha256.hash(i_uri);

              hash = 'd:appt_' + hash.substring(0, 50);
              put_to_ght(i_uri, hash);
              count_appts++;
            }
          }
        }
      }
    }

    print('found appointments : ' + count_appts);
  } else {
    const document = get_individual(ticket, uri);

    if (document) {
      let is_changed = false;
      for (const key in document) {
        if (Object.hasOwnProperty.call(document, key)) {
          const values = document[key];
          if (key != '@') {
            const new_values = [];
            for (const idx in values) {
              if (Object.hasOwnProperty.call(values, idx)) {
                const value = values[idx];
                const new_uri = get_from_ght(value.data);
                if (new_uri) {
                  print('found: value>63,' + uri + ' ' + key + '=' + value.data + ' -> ' + new_uri);
                  value.data = new_uri;
                  is_changed = true;
                }

                new_values.push(value);
              }
            }

            if (is_changed) {
              document[key] = new_values;
            }
          } else {
            if (get_from_ght(values)) {
              const new_uri = get_from_ght(values);
              if (new_uri) {
                print('found: uri>63,' + values + '(remove) -> ' + new_uri);
                document['@'] = new_uri;
                put_individual(ticket, document, event_id);
                remove_individual(ticket, uri, event_id);
              }
            }
          }
        }
      }

      if (is_changed) {
        put_individual(ticket, document, event_id);
      }
    }
  }
};
