// Codelets

'use strict';

import veda from '../common/veda.js';

import Sha256 from '../common/lib/sha256.js';

const Codelet = {};

export default veda.Codelet = Codelet;

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
    // print ("@JS change_rights_actor");
    // print ("@JS doc_id=", veda.Util.toJson (doc_id));
    // print ("@JS rightset=", veda.Util.toJson (rightset));
    const allow_set = [];
    if (rightset[0].data.indexOf('r') >= 0) {
      allow_set.push('v-s:canRead');
    }
    if (rightset[0].data.indexOf('u') >= 0) {
      allow_set.push('v-s:canUpdate');
    }
    if (doc_id) {
      // print ("@JS0 actor=", actor);
      // print ("@JS1 process.getLocalVariable (" + actor + ")=", veda.Util.toJson(process.getLocalVariable (actor)));
      // print ("@JS2 process.getExecutor()=", veda.Util.toJson(process.getExecutor()));
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

      for (let i = 0; i<executorArr.length; i++) {
        let executor = [executorArr[i]];
        print('@JS3 executor=', veda.Util.toJson(executor));
        const employee = veda.Workflow.get_properties_chain(executor, [
          {
            $get: 'v-s:employee',
          }], undefined);

        print('@JS4 employee=', veda.Util.toJson(employee));
        if (employee) {
          const employee_uri = veda.Util.getUri(employee);

          if (employee_uri) {
            veda.Util.addRight(ticket, employee_uri, veda.Util.getUri(doc_id), allow_set);
          } else {
            print('ERR! change_rights_actor: undefined employee_uri, actor=[' + actor + '], executor=' + veda.Util.toJson(executor) + ', doc_id=' + veda.Util.getUri(doc_id) + ', process=' + veda.Util.getUri(process) + ', task=' + veda.Util.getUri(task));
          }
        }

        executor = veda.Workflow.get_properties_chain(executor, [
          {
            $get: 'v-s:occupation',
          }], executor);

        if (!executor) {
          print('@JS executor undefined, actor=', process.getLocalVariable(actor));
        }

        if (executor) {
          const executor_uri = veda.Util.getUri(executor);
          if (executor_uri) {
            veda.Util.addRight(ticket, executor_uri, veda.Util.getUri(doc_id), allow_set);
          } else {
            print('ERR! change_rights_actor: undefined executor_uri, actor=[' + actor + '], executor=' + veda.Util.toJson(executor) + ', doc_id=' + veda.Util.getUri(doc_id) + ', process=' + veda.Util.getUri(process) + ', task=' + veda.Util.getUri(task));
          }
        }
      }


      // var instanceOf = veda.Util.getUri(process['v-wf:instanceOf']);
      // var net_doc_id = instanceOf + "_" + doc_id[0].data;
      // print("[WORKFLOW]:down_right_and_store, find=", net_doc_id);
    }
    return [veda.Workflow.get_new_variable('right', veda.Util.newStr('acl1'))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.restore_right = function (task) {
  try {
    return [veda.Workflow.get_new_variable('result', veda.Util.newStr('Ok'))];
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
  // print('>>> '+veda.Util.toJson(process));
  const vars = process['v-wf:inVars'];
  if (!vars) return;
  for (let i = 0; i < vars.length; i++) {
    const variable = get_individual(process.ticket, vars[i].data);
    if (variable &&
            variable['v-wf:variableName'][0] &&
            variable['v-wf:variableName'][0].data == 'docId') {
      const doc = get_individual(ticket, variable['v-wf:variableValue'][0].data);

      if (!doc['v-wf:isProcess']) return;
      for (let j = 0; j < doc['v-wf:isProcess'].length; j++) {
        // print('>>> '+veda.Util.toJson(doc['v-wf:isProcess'][j].data));
        if (doc['v-wf:isProcess'][j].data == process['@']) {
          delete doc['v-wf:isProcess'];
          doc['v-wf:hasStatusWorkflow'] = veda.Util.newUri(status);
          put_individual(ticket, doc, _event_id);
        }
      }
    }
  }
};

Codelet.change_document_workflow_status = function (process, status) {
  // status: InProcess, InReworking
  const doc_id = process.getInputVariable('docId');
  // print('$$$$ doc:', veda.Util.toJson(doc_id));
  if (doc_id) {
    const set_in_document = {
      '@': veda.Util.getUri(doc_id),
    };
    set_in_document['v-wf:hasStatusWorkflow'] = veda.Util.newUri(status);

    set_in_individual(process.ticket, set_in_document, _event_id);
  };
  return [veda.Workflow.get_new_variable('workflowStatus', veda.Util.newStr(status))];
};

Codelet.change_document_status = function (process, status) {
  // print ("@JS setStatus=", veda.Util.toJson(process.getInputVariable('setStatus')));
  if ( status ) {
    const setStatus=process.getInputVariable('setStatus');
    if (setStatus && setStatus[0].data == true) {
      const doc_id = process.getInputVariable('docId');
      if (doc_id) {
        const set_in_document = {
          '@': veda.Util.getUri(doc_id),
        };
        set_in_document['v-s:hasStatus'] = veda.Util.newUri(status);
        if (status == 'v-s:StatusExecuted') {
          set_in_document['v-s:dateFact'] = veda.Util.newDate(Date.now());
        }
        // print ("@JS set_in_document=", veda.Util.toJson(set_in_document));
        set_in_individual(process.ticket, set_in_document, _event_id);
      };
    }
  };
  return [veda.Workflow.get_new_variable('status', veda.Util.newStr(status))];
};

Codelet.createPermissionStatement = function(process, stage) {
  print('###### Start Codelet.createPermissionStatement ######');
  const docId = process.getInputVariable('docId');
  print('docId:', veda.Util.toJson(docId));
  let subjectAppointmentUri;
  let statementUri;
  if (stage === 'rework') {
    subjectAppointmentUri = process.getLocalVariable('responsible');
    statementUri = docId[0].data + '-pf-rework';
  } else if (stage === 'task') {
    subjectAppointmentUri = process.getLocalVariable('actor');
    statementUri = docId[0].data + '-pf-task';
  };
  print('subjectAppointmentUri: ', veda.Util.toJson(subjectAppointmentUri));
  if (subjectAppointmentUri) {
    const subjectAppointment = get_individual(ticket, subjectAppointmentUri[0].data);
    if (subjectAppointment) {
      const permissionStatement= {
        '@': statementUri,
        'rdf:type': veda.Util.newUri('v-s:PermissionStatement'),
        'v-s:useFilter': veda.Util.newUri('v-s:StatusStarted'),
        'v-s:permissionObject': docId,
        'v-s:permissionSubject': subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation']),
        'v-s:canUpdate': veda.Util.newBool('true'),
      };
      print('@@@@@responsible:', veda.Util.toJson(subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation'])));
      put_individual(ticket, permissionStatement, _event_id);
      print('put_individual: ', statementUri);
    } else {
      print('Error create_permission_statement_executor: not found subjectAppointment: ', subjectAppointmentUri);
    }
  } else {
    print('Error create_permission_statement_executor: not found local variable \'responsible\'');
  }
  print('###### Finish Codelet.createPermissionStatement ######');
  return veda.Util.newStr(statementUri);
};

Codelet.deletePermissionStatement = function(process, stage) {
  print('###### Start Codelet.deletePermissionStatement ######');
  const docId = process.getInputVariable('docId');
  print('docId:', veda.Util.toJson(docId));
  let statementUri;
  if (stage === 'rework') {
    statementUri = docId[0].data + '-pf-rework';
  } else if (stage === 'task') {
    statementUri = docId[0].data + '-pf-task';
  };
  const set_in_statement = {
    '@': statementUri,
    'v-s:deleted': veda.Util.newBool('true'),
  };
  set_in_individual(ticket, set_in_statement);
  print('###### Finish Codelet.deletePermissionStatement ######');
  return veda.Util.newStr('empty');
};

Codelet.is_exists_net_executor = function (process) {
  try {
    const res = process.getExecutor() !== undefined;
    return [veda.Workflow.get_new_variable('res', veda.Util.newBool(res))];
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

    return [veda.Workflow.get_new_variable('res', veda.Util.newUri(res))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.is_in_docflow_and_set_if_true = function (task) {
  // # 322
  // // # 285
  //    return [veda.Workflow.get_new_variable('result', veda.Util.newUri(false))];

  try {
    const res = false;
    if (task) {
      const doc_id = task.getInputVariable('docId');
      if (doc_id) {
        const forProcess = veda.Util.getUri(task.src_data['v-wf:forProcess']);
        // print("[Z1Z] := "+veda.Util.toJson(forProcess));
        const process = get_individual(task.ticket, forProcess);
        // print("[Z2Z] := "+veda.Util.toJson(process));
        if (process) {
          const instanceOf = veda.Util.getUri(process['v-wf:instanceOf']);

          const net_doc_id = instanceOf + '_' + doc_id[0].data;
          // print("[WORKFLOW]:is_in_docflow_and_set_if_true, find=", net_doc_id);

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
            'v-wf:isProcess': veda.Util.newUri(process['@']),
          };
          print('$ add_to_document >>' + veda.Util.toJson(add_to_document));
          add_to_individual(ticket, add_to_document, _event_id);
        }
      }
    }

    return [veda.Workflow.get_new_variable('result', veda.Util.newUri(res))];
  } catch (e) {
    print(e.stack);
  }
};

Codelet.distribution = function (process, task) {};

Codelet.add_value_to_document = function (process, task) {
  try {
    let src_uri;

    if (task) {
      src_uri = task.getInputVariable('src_uri');
      let name_uri = task.getInputVariable('name_uri');
      const value = task.getInputVariable('value');

      let src;

      if (name_uri && value) {
        src = get_individual(task.ticket, veda.Util.getUri(src_uri));
        if (src) {
          name_uri = veda.Util.getUri(name_uri);
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

    return [veda.Workflow.get_new_variable('res', src_uri)];
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
        src = get_individual(task.ticket, veda.Util.getUri(src_uri));
        if (src) {
          name_uri = veda.Util.getUri(name_uri);
          src[name_uri] = value;
          put_individual(ticket, src, _event_id);
        }
      }
    }

    return [veda.Workflow.get_new_variable('res', src_uri)];
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
        const transform = get_individual(task.ticket, veda.Util.getUri(transform_link));
        if (transform) {
          const document = get_individual(task.ticket, veda.Util.getUri(src_doc_id));
          if (document) {
            const new_items = veda.Util.transformation(task.ticket, document, transform, null, null, veda.Util.newUri(process.src_data['@']));
            for (let i = 0; i < new_items.length; i++) {
              put_individual(ticket, new_items[i], _event_id);
              new_items_uri.push(
                {
                  data: new_items[i]['@'],
                  type: 'Uri',
                });
            }
          }
        }
      }
    }

    return [veda.Workflow.get_new_variable('res', new_items_uri)];
  } catch (e) {
    print(e.stack);
  }
};

// скрипт поиска в документе uri > 64
Codelet.find_long_terms = function (ticket, uri, execute_script) {
  const event_id = '';
  let cid = get_from_ght('cid');
  // print ("exist cid=" + cid);
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
            if ( veda.Util.hasValue(document, 'rdf:type', {data: 'v-s:Appointment', type: 'Uri'}) ) {
              let hash = Sha256.hash(i_uri);

              hash = 'd:appt_' + hash.substr(0, 50);
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

            if (is_changed == true) {
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

      if (is_changed == true) {
        put_individual(ticket, document, event_id);
      }
    }
  }
};

// скрипт переименования онтологии
Codelet.onto_rename = function (ticket, document, execute_script) {
  //    print ('$$$$$$$$$$$$$$ script_onto_rename:doc= ' + document['@']);
  try {
    // print ('$ script_onto_rename:execute_script= ' + veda.Util.toJson (execute_script));
    if (document['@'] === execute_script['@']) {
      return;
    }

    const args_uris = execute_script['v-s:argument'];
    const args = veda.Util.loadVariablesUseField(ticket, args_uris);

    for (const idx in args_uris) {
      if (Object.hasOwnProperty.call(args_uris, idx)) {
        const arg_uri = args_uris[idx].data;
        if (arg_uri === document['@']) {
          return;
        }
      }
    }

    const rename_template = args['rename_template'];
    let is_update = false;
    let is_replace = false;
    const prev_doc_uri = document['@'];
    const from_2_to = {};

    for (const idx in rename_template) {
      if (Object.hasOwnProperty.call(rename_template, idx)) {
        const template = rename_template[idx];

        const cc = template.split(',');
        if (!cc || cc.length != 2) {
          continue;
        }

        const from = cc[0];
        const to = cc[1];
        from_2_to[from] = to;

        const from_u = from.replace(':', '_');
        const to_u = to.replace(':', '_');

        if (from_u !== from) {
          from_2_to[from_u] = to_u;
        }
      }
    }

    for (const key in document) {
      if (Object.hasOwnProperty.call(document, key)) {
        const values = document[key];
        if (key != '@') {
          for (const from in from_2_to) {
            if (Object.hasOwnProperty.call(from_2_to, from)) {
              if (key === from) {
                const to = from_2_to[from];
                document[to] = values;
                delete document[from];
              }
            }
          }

          for (const idx in values) {
            if (Object.hasOwnProperty.call(values, idx)) {
              const value = values[idx];

              for (const from in from_2_to) {
                if (Object.hasOwnProperty.call(from_2_to, from)) {
                  if (value.type == 'Uri' || value.type == 'String') {
                    const to = from_2_to[from];
                    const new_str = veda.Util.replace_word(value.data, from, to);
                    if (new_str !== value.data) {
                      is_update = true;
                      value.data = new_str;
                    }
                  }
                }
              }
            }
          }
        } else {
          // replace in uri
          for (const from in from_2_to) {
            if (Object.hasOwnProperty.call(from_2_to, from)) {
              const to = from_2_to[from];
              // print ('values=', values, ', from=', from, ', to=', to);
              const new_str = veda.Util.replace_word(values, from, to);
              if (new_str !== values) {
                is_replace = true;
                document['@'] = new_str;
              }
            }
          }
        }
      }
    }

    if (is_replace) {
      remove_individual(ticket, prev_doc_uri, '');
      put_individual(ticket, document, '');
      // print('$ script_onto_rename:is_replace, ' + prev_doc['@'] + '->' + document['@']);
    } else {
      if (is_update) {
        put_individual(ticket, document, '');
        // print('$ script_onto_rename:is_update, ' + prev_doc['@'] + '->' + document['@']);
        //            print('$ script_onto_rename:is_update, ' + veda.Util.toJson(prev_doc) + '->' + veda.Util.toJson(document));
      }
    }

    if (is_replace || is_update) {
      //            print('$ script_onto_rename:is_update, ' + prev_doc['@'] + '->' + document['@']);
      //                        print('$ script_onto_rename:is_update, ' + veda.Util.toJson(prev_doc) + '->' + veda.Util.toJson(document));
    }
  } catch (e) {
    if (typeof window === 'undefined') {
      print(e.stack);
    } else {
      console.log(e.stack);
    }
  }
};
