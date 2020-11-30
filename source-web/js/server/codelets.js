// Codelets

"use strict";

import veda from "../common/veda.js";

import Sha256 from "../common/lib/sha256.js";

var Codelet = {};

export default veda.Codelet = Codelet;

Codelet.down_right_and_store = function (process, task)
{
    return Codelet.change_rights(process, task, [
    {
        "data": "-r--"
    }]);
};

Codelet.change_rights = function (process, task, rightset)
{
    return Codelet.change_rights_actor(process, task, [
    {
        "data": "-r--"
    }], 'actor');
};

Codelet.change_rights_actor = function (process, task, rightset, actor, docId, executors)
{
    try
    {
        var doc_id;
        if (docId) {
            doc_id = docId;
        } else {
            doc_id = process.getInputVariable('docId');
        }
        //print ("@JS change_rights_actor");
        //print ("@JS doc_id=", veda.Util.toJson (doc_id));
        //print ("@JS rightset=", veda.Util.toJson (rightset));
        var allow_set = [];
        if (rightset[0].data.indexOf('r') >= 0)
        {
            allow_set.push("v-s:canRead");
        }
        if (rightset[0].data.indexOf('u') >= 0)
        {
            allow_set.push("v-s:canUpdate");
        }
        if (doc_id)
        {
            //print ("@JS0 actor=", actor);
            //print ("@JS1 process.getLocalVariable (" + actor + ")=", veda.Util.toJson(process.getLocalVariable (actor)));
            //print ("@JS2 process.getExecutor()=", veda.Util.toJson(process.getExecutor()));
            var executorArr;
            if (executors) {
              executorArr = executors;
            } else {
                executorArr = (process.getLocalVariable(actor)) ? process.getLocalVariable(actor) : process.getExecutor();
                if (!executorArr) executorArr = task.getInputVariable(actor);
                if (!executorArr) {
                  try {
                    var length = executorArr.length;
                  } catch (e) {
                    executorArr = [executorArr];
                  }
                };
            }

            for (var i = 0; i<executorArr.length; i++) {
              var executor = [executorArr[i]];
              print ("@JS3 executor=", veda.Util.toJson(executor));
              var employee = veda.Workflow.get_properties_chain(executor, [
              {
                  $get: 'v-s:employee'
              }], undefined);

              print ("@JS4 employee=", veda.Util.toJson(employee));
              if (employee)
              {
                  var employee_uri = veda.Util.getUri(employee);

                  if (employee_uri) {
                      veda.Util.addRight(ticket, employee_uri, veda.Util.getUri(doc_id), allow_set);
                  } else
                      print("ERR! change_rights_actor: undefined employee_uri, actor=[" + actor + "], executor=" + veda.Util.toJson(executor) + ", doc_id=" + veda.Util.getUri(doc_id) + ", process=" + veda.Util.getUri(process) + ", task=" + veda.Util.getUri(task));
              }

              executor = veda.Workflow.get_properties_chain(executor, [
              {
                  $get: 'v-s:occupation'
              }], executor);

              if (!executor)
              {
                  print("@JS executor undefined, actor=", process.getLocalVariable(actor));
              }

              if (executor)
              {
                  var executor_uri = veda.Util.getUri(executor);
                  if (executor_uri) {
                      veda.Util.addRight(ticket, executor_uri, veda.Util.getUri(doc_id), allow_set);
                  } else
                      print("ERR! change_rights_actor: undefined executor_uri, actor=[" + actor + "], executor=" + veda.Util.toJson(executor) + ", doc_id=" + veda.Util.getUri(doc_id) + ", process=" + veda.Util.getUri(process) + ", task=" + veda.Util.getUri(task));
              }
            }


            //var instanceOf = veda.Util.getUri(process['v-wf:instanceOf']);
            //var net_doc_id = instanceOf + "_" + doc_id[0].data;
            //print("[WORKFLOW]:down_right_and_store, find=", net_doc_id);
        }
        return [veda.Workflow.get_new_variable('right', veda.Util.newStr('acl1'))];
    }
    catch (e)
    {
        print(e.stack);
    }
};

Codelet.restore_right = function (task)
{
    try
    {
        //print("[WORKFLOW]:restore_right, task=", veda.Util.toJson(task));
        //print("[WORKFLOW]:restore_right function RESTORE RIGHT IS NOT IMPLIMENTED");
        var right = task.getInputVariable('originalRights');
        //print("[WORKFLOW]:restore_right ", veda.Util.toJson(right));
        return [veda.Workflow.get_new_variable('result', veda.Util.newStr('Ok'))];

    }
    catch (e)
    {
        print(e.stack);
    }
};

Codelet.complete_process = function (ticket, process, _event_id)
{
    Codelet.change_process_status(ticket, process, 'v-wf:Completed', _event_id);
};

Codelet.interrupt_process = function (ticket, process, _event_id)
{
    Codelet.change_process_status(ticket, process, 'v-wf:Interrupted', _event_id);
};

Codelet.change_process_status = function (ticket, process, status, _event_id)
{
    //print('>>> '+veda.Util.toJson(process));
    var vars = process['v-wf:inVars'];
    if (!vars) return;
    for (var i = 0; i < vars.length; i++)
    {
        var variable = get_individual(process.ticket, vars[i].data);
        if (variable &&
            variable['v-wf:variableName'][0] &&
            variable['v-wf:variableName'][0].data == 'docId')
        {
            var doc = get_individual(ticket, variable['v-wf:variableValue'][0].data);

            if (!doc['v-wf:isProcess'])  return;
            for(var j = 0; j < doc['v-wf:isProcess'].length; j++) {
              //print('>>> '+veda.Util.toJson(doc['v-wf:isProcess'][j].data));
              if (doc['v-wf:isProcess'][j].data == process['@']) {
                delete doc['v-wf:isProcess'];
                doc['v-wf:hasStatusWorkflow'] = veda.Util.newUri(status);
                put_individual(ticket, doc, _event_id);
              }
            }
        }
    }
};

Codelet.change_document_workflow_status = function (process, status)
{
    //status: InProcess, InReworking
    var doc_id = process.getInputVariable('docId');
    //print('$$$$ doc:', veda.Util.toJson(doc_id));
    if (doc_id) {
        var set_in_document = {
            '@': veda.Util.getUri(doc_id)
        };
        set_in_document['v-wf:hasStatusWorkflow'] = veda.Util.newUri(status);

        set_in_individual(process.ticket, set_in_document, _event_id);
    };
    return [veda.Workflow.get_new_variable('workflowStatus', veda.Util.newStr(status))];
};

Codelet.change_document_status = function (process, status)
{

    // print ("@JS setStatus=", veda.Util.toJson(process.getInputVariable('setStatus')));
    if ( status ) {
        var setStatus=process.getInputVariable('setStatus');
        if (setStatus && setStatus[0].data == true) {
            var doc_id = process.getInputVariable('docId');
            if (doc_id) {
                var set_in_document = {
                    '@': veda.Util.getUri(doc_id)
                };
                set_in_document['v-s:hasStatus'] = veda.Util.newUri(status);
                if (status == 'v-s:StatusExecuted') {
                    set_in_document['v-s:dateFact'] = veda.Util.newDate(Date.now());
                }
                //print ("@JS set_in_document=", veda.Util.toJson(set_in_document));
                set_in_individual(process.ticket, set_in_document, _event_id);
            };
        }
    };
    return [veda.Workflow.get_new_variable('status', veda.Util.newStr(status))];
};

Codelet.createPermissionStatement = function(process, stage)
{
    print("###### Start Codelet.createPermissionStatement ######");
    var docId = process.getInputVariable("docId");
    print("docId:", veda.Util.toJson(docId));
    var subjectAppointmentUri;
    var statementUri;
    if (stage === "rework") {
      subjectAppointmentUri = process.getLocalVariable ('responsible');
      statementUri = docId[0].data + '-pf-rework';
    } else if (stage === "task") {
      subjectAppointmentUri = process.getLocalVariable ('actor');
      statementUri = docId[0].data + '-pf-task';
    };
    print("subjectAppointmentUri: ", veda.Util.toJson(subjectAppointmentUri));
    if (subjectAppointmentUri) {
      var subjectAppointment = get_individual(ticket, subjectAppointmentUri[0].data);
      if (subjectAppointment) {
        var permissionStatement= {
          '@' : statementUri,
          'rdf:type': veda.Util.newUri('v-s:PermissionStatement'),
          'v-s:useFilter': veda.Util.newUri('v-s:StatusStarted'),
          'v-s:permissionObject': docId,
          'v-s:permissionSubject': subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation']),
          'v-s:canUpdate': veda.Util.newBool('true')
        };
        print('@@@@@responsible:', veda.Util.toJson(subjectAppointment['v-s:employee'].concat(subjectAppointment['v-s:occupation'])));
        put_individual(ticket, permissionStatement, _event_id);
        print("put_individual: ", statementUri);
      } else {
        print('Error create_permission_statement_executor: not found subjectAppointment: ', subjectAppointmentUri);
      }
    } else {
      print("Error create_permission_statement_executor: not found local variable 'responsible'");
    }
    print("###### Finish Codelet.createPermissionStatement ######");
    return veda.Util.newStr(statementUri);
};

Codelet.deletePermissionStatement = function(process, stage)
{
    print("###### Start Codelet.deletePermissionStatement ######");
    var docId = process.getInputVariable("docId");
    print("docId:", veda.Util.toJson(docId));
    var statementUri;
    if (stage === "rework") {
      statementUri = docId[0].data + '-pf-rework';
    } else if (stage === "task") {
      statementUri = docId[0].data + '-pf-task';
    };
    var set_in_statement = {
      '@' : statementUri,
      'v-s:deleted': veda.Util.newBool('true')
    }
    set_in_individual(ticket, set_in_statement);
    print("###### Finish Codelet.deletePermissionStatement ######");
    return veda.Util.newStr("empty");
};

Codelet.is_exists_net_executor = function (process)
{
    try
    {
        var res = process.getExecutor() !== undefined;
        return [veda.Workflow.get_new_variable('res', veda.Util.newBool(res))];
    }
    catch (e)
    {
        print(e.stack);
    }
};

Codelet.get_type_of_docId = function (task)
{
    try
    {
        var res = '?';

        if (task)
        {
            var doc_id = task.getInputVariable('docId');
            if (doc_id)
            {
                var doc = get_individual(task.ticket, doc_id[0].data);

                if (doc)
                {
                    res = doc['rdf:type'][0].data;
                }
            }

        }

        return [veda.Workflow.get_new_variable('res', veda.Util.newUri(res))];
    }
    catch (e)
    {
        print(e.stack);
    }

};

Codelet.is_in_docflow_and_set_if_true = function (task)
{

    // # 322
    //// # 285
    //    return [veda.Workflow.get_new_variable('result', veda.Util.newUri(false))];

    try
    {
        var res = false;
        if (task)
        {
            var doc_id = task.getInputVariable('docId');
            if (doc_id)
            {
                var forProcess = veda.Util.getUri(task.src_data['v-wf:forProcess']);
                //print("[Z1Z] := "+veda.Util.toJson(forProcess));
                var process = get_individual(task.ticket, forProcess);
                //print("[Z2Z] := "+veda.Util.toJson(process));
                if (process)
                {
                    var instanceOf = veda.Util.getUri(process['v-wf:instanceOf']);

                    var net_doc_id = instanceOf + "_" + doc_id[0].data;
                    //print("[WORKFLOW]:is_in_docflow_and_set_if_true, find=", net_doc_id);

                    var in_doc_flow = get_individual(task.ticket, net_doc_id);
                    //print("[Z3Z] := "+veda.Util.toJson(in_doc_flow));

                    //                   if (in_doc_flow)
                    //                   {
                    // # 322
                    //                        res = true;
                    //                        res = false;
                    //
                    //                    }
                    //                    else
                    {
                        var new_doc = {
                            '@': net_doc_id,
                            'rdf:type': [
                            {
                                data: 'v-wf:Variable',
                                type: "Uri"
                            }]
                        };
                        put_individual(task.ticket, new_doc, _event_id);

                        var add_to_document = {
                            '@': doc_id[0].data,
                            'v-wf:isProcess': veda.Util.newUri(process['@'])
                        };
                        print('$ add_to_document >>' + veda.Util.toJson(add_to_document));
                        add_to_individual(ticket, add_to_document, _event_id);
                    }
                }
            }

        }

        return [veda.Workflow.get_new_variable('result', veda.Util.newUri(res))];
    }
    catch (e)
    {
        print(e.stack);
    }

};

Codelet.distribution = function (process, task)
{};

Codelet.add_value_to_document = function (process, task)
{
    try
    {
        var src;

        if (task)
        {
            var src_uri = task.getInputVariable('src_uri');
            var name_uri = task.getInputVariable('name_uri');
            var value = task.getInputVariable('value');

            var src;

            if (name_uri && value)
            {
                src = get_individual(task.ticket, veda.Util.getUri(src_uri));
                if (src)
                {
                    name_uri = veda.Util.getUri(name_uri);
                    var ch_value = src[name_uri];

                    if (!ch_value)
                        ch_value = [];

                    for (var key in value)
                        ch_value.push(value[key]);

                    src[name_uri] = ch_value;
                    put_individual(ticket, src, _event_id);
                }
            }
        }

        return [veda.Workflow.get_new_variable('res', src_uri)];
    }
    catch (e)
    {
        print(e.stack);
    }
};

Codelet.set_value_to_document = function (process, task)
{
    try
    {
        var src;

        if (task)
        {
            var src_uri = task.getInputVariable('src_uri');
            var name_uri = task.getInputVariable('name_uri');
            var value = task.getInputVariable('value');

            var src;

            if (name_uri && value)
            {
                src = get_individual(task.ticket, veda.Util.getUri(src_uri));
                if (src)
                {
                    name_uri = veda.Util.getUri(name_uri);
                    src[name_uri] = value;
                    put_individual(ticket, src, _event_id);
                }
            }
        }

        return [veda.Workflow.get_new_variable('res', src_uri)];
    }
    catch (e)
    {
        print(e.stack);
    }
};

Codelet.create_use_transformation = function (process, task)
{
    try
    {
        var new_items_uri = [];

        if (task)
        {
            var src_doc_id = task.getInputVariable('src_uri');
            var transform_link = task.getInputVariable('transformation_uri');

            if (transform_link)
            {
                var transform = get_individual(task.ticket, veda.Util.getUri(transform_link));
                if (transform)
                {
                    var document = get_individual(task.ticket, veda.Util.getUri(src_doc_id));
                    if (document)
                    {
                        var new_items = veda.Util.transformation(task.ticket, document, transform, null, null, veda.Util.newUri(process.src_data['@']));
                        for (var i = 0; i < new_items.length; i++)
                        {
                            put_individual(ticket, new_items[i], _event_id);
                            new_items_uri.push(
                            {
                                data: new_items[i]['@'],
                                type: "Uri"
                            });
                        }
                    }
                }

            }
        }

        return [veda.Workflow.get_new_variable('res', new_items_uri)];
    }
    catch (e)
    {
        print(e.stack);
    }

};

// скрипт поиска в документе uri > 64
Codelet.find_long_terms = function (ticket, uri, execute_script)
{
    var event_id = '';
    var cid = get_from_ght('cid');
    //print ("exist cid=" + cid);
    if (!cid)
    {
        var count_appts = 0;
        var cid = new_uris_consumer();
        put_to_ght('cid', cid);
        print("new cid=" + cid);

        var i_uri = "?";
        while (i_uri)
        {
            i_uri = uris_pop(cid);

            if (i_uri)
            {
                uris_commit_and_next(cid, true);
                if (i_uri.length > 63)
                {
                    var document = get_individual(ticket, i_uri);

                    if (document)
                    {
                        if ( veda.Util.hasValue(document, "rdf:type", {data: "v-s:Appointment", type: "Uri"}) )
                        {
                            var hash = Sha256.hash(i_uri);

                            hash = "d:appt_" + hash.substr(0, 50);
                            put_to_ght(i_uri, hash);
                            count_appts++;
                        }
                    }
                }
            }
        }

        print("found appointments : " + count_appts);

    }
    else
    {
        var document = get_individual(ticket, uri);

        if (document)
        {
            var is_changed = false;
            for (var key in document)
            {
                var values = document[key];
                if (key != '@')
                {
                    var new_values = [];
                    for (var idx in values)
                    {
                        var value = values[idx];
                        var new_uri = get_from_ght(value.data);
                        if (new_uri)
                        {
                            print("found: value>63," + uri + " " + key + "=" + value.data + " -> " + new_uri);
                            value.data = new_uri;
                            is_changed = true;
                        }

                        new_values.push(value);
                    }

                    if (is_changed == true)
                        document[key] = new_values;
                }
                else
                {
                    if (get_from_ght(values))
                    {
                        var new_uri = get_from_ght(values);
                        if (new_uri)
                        {
                            print("found: uri>63," + values + "(remove) -> " + new_uri);
                            document['@'] = new_uri;
                            put_individual(ticket, document, event_id);
                            remove_individual(ticket, uri, event_id);
                        }
                    }
                }
            }

            if (is_changed == true)
            {
                put_individual(ticket, document, event_id);
            }
        }

    }
};

// скрипт переименования онтологии
Codelet.onto_rename = function (ticket, document, execute_script)
{
    //    print ('$$$$$$$$$$$$$$ script_onto_rename:doc= ' + document['@']);
    try
    {
        //print ('$ script_onto_rename:execute_script= ' + veda.Util.toJson (execute_script));
        if (document['@'] === execute_script['@'])
            return;

        var args_uris = execute_script['v-s:argument'];
        var args = veda.Util.loadVariablesUseField(ticket, args_uris);

        for (var idx in args_uris)
        {
            var arg_uri = args_uris[idx].data;
            if (arg_uri === document['@'])
                return;
        }

        var rename_template = args["rename_template"];
        var is_update = false;
        var is_replace = false;
        var prev_doc_uri = document['@'];
        var prev_doc = veda.Util.clone(document);
        var from_2_to = {};

        for (var idx in rename_template)
        {
            var template = rename_template[idx];

            var cc = template.split(',');
            if (!cc || cc.length != 2)
                continue;

            var from = cc[0];
            var to = cc[1];
            from_2_to[from] = to;

            var from_u = from.replace(':', '_');
            var to_u = to.replace(':', '_');

            if (from_u !== from)
                from_2_to[from_u] = to_u;
        }

        for (var key in document)
        {
            var values = document[key];
            if (key != '@')
            {
                for (var from in from_2_to)
                {
                    if (key === from)
                    {
                        var to = from_2_to[from];
                        document[to] = values;
                        delete document[from];
                    }
                }

                for (var idx in values)
                {
                    var value = values[idx];

                    for (var from in from_2_to)
                    {
                        if (value.type == "Uri" || value.type == "String")
                        {
                            var to = from_2_to[from];
                            var new_str = veda.Util.replace_word(value.data, from, to);
                            if (new_str !== value.data)
                            {
                                is_update = true;
                                value.data = new_str;
                            }
                        }
                    }
                }
            }
            else
            {
                // replace in uri
                for (var from in from_2_to)
                {
                    var to = from_2_to[from];
                    //print ('values=', values, ', from=', from, ', to=', to);
                    var new_str = veda.Util.replace_word(values, from, to);
                    if (new_str !== values)
                    {
                        is_replace = true;
                        document['@'] = new_str;
                    }
                }
            }
        }

        if (is_replace)
        {
            remove_individual(ticket, prev_doc_uri, "");
            put_individual(ticket, document, "");
            //print('$ script_onto_rename:is_replace, ' + prev_doc['@'] + '->' + document['@']);
        }
        else
        {
            if (is_update)
            {
                put_individual(ticket, document, "");
                //print('$ script_onto_rename:is_update, ' + prev_doc['@'] + '->' + document['@']);
                //            print('$ script_onto_rename:is_update, ' + veda.Util.toJson(prev_doc) + '->' + veda.Util.toJson(document));
            }
        }

        if (is_replace || is_update)
        {
            //            print('$ script_onto_rename:is_update, ' + prev_doc['@'] + '->' + document['@']);
            //                        print('$ script_onto_rename:is_update, ' + veda.Util.toJson(prev_doc) + '->' + veda.Util.toJson(document));
        }


    }
    catch (e)
    {
        if (typeof window === "undefined")
        {
            print(e.stack);
        }
        else
        {
            console.log(e.stack);
        }
    }
};
