// Veda server utility functions

veda.Module(function (veda) { "use strict";

  veda.Util = veda.Util || {};

  veda.Util.getJournalUri = function (object_uri)
  {
      return object_uri + "j";
  };

  veda.Util.getTraceJournalUri = function (object_uri)
  {
      return object_uri + "t";
  };

  veda.Util.newJournalRecord = function (journal_uri)
  {
      var new_journal_record_uri = veda.Util.genUri() + "-jr";

      var new_journal_record = {
          '@': new_journal_record_uri,
          'rdf:type': [
          {
              data: 'v-s:JournalRecord',
              type: "Uri"
          }],
          'v-s:parentJournal': [
          {
              data: journal_uri,
              type: "Uri"
          }],
          'v-s:created': [
          {
              data: new Date(),
              type: "Datetime"
          }]
      };
      return new_journal_record;
  };

  veda.Util.logToJournal = function (ticket, journal_uri, journal_record, jr_type)
  {
      //if (!jr_type)
      //  print("@@@ logToJournal, new_journal_record=" + veda.Util.toJson(journal_record));

      put_individual(ticket, journal_record, _event_id);

      var add_to_journal = {
          '@': journal_uri,
          'v-s:childRecord': [
          {
              data: journal_record['@'],
              type: "Uri"
          }]
      };

      //if (!jr_type)
      //  print("@@@ logToJournal, add_to_journal = " + veda.Util.toJson(add_to_journal));

      //var before = get_individual(ticket, journal_uri);
      //print('BEFORE : '+veda.Util.toJson(before))

      add_to_individual(ticket, add_to_journal, _event_id);

      //var after = get_individual(ticket, journal_uri);
      //print('AFTER : '+veda.Util.toJson(after))
  };

  veda.Util.traceToJournal = function (ticket, journal_uri, label, _data)
  {
      //print("@@@ traceToJournal, journal_uri=" + journal_uri + " #1");
      var journal_record = veda.Util.newJournalRecord(journal_uri);

      journal_record['rdf:type'] = [
      {
          data: 'v-wf:TraceRecord',
          type: "Uri"
      }];
      journal_record['rdfs:label'] = [
      {
          data: label,
          type: "String"
      }];
      journal_record['rdfs:comment'] = [
      {
          data: _data,
          type: "String"
      }];

      veda.Util.logToJournal(ticket, journal_uri, journal_record, true);

      //print("@@@ traceToJournal, journal_uri=" + journal_uri + ", " + veda.Util.toJson(journal_record));
  };


// DEPRECATED
  veda.Util.isTecnicalChange = function (newdoc, olddoc)
  {
      if (newdoc['v-s:actualVersion'] && newdoc['v-s:actualVersion'][0].data != newdoc['@'])
      {
          olddoc = get_individual(ticket, newdoc['v-s:actualVersion'][0].data);
      }
      if (!olddoc)
      {
          // print (newdoc['@']+' x ');
          return false;
      }

      for (var key in newdoc)
      {
          if (key === '@') continue;

          if ((newdoc[key] && !olddoc[key]) // добвили
              ||
              (newdoc[key] && !olddoc[key]) // удалили
              ||
              (newdoc[key].length !== olddoc[key].length) // изменили количество
          )
          {
              if (!veda.Util.isTechnicalAttribute(key, olddoc[key]))
              {
                  // в нетехническом атрибуте
                  //print (newdoc['@']+' x '+olddoc[key]+' >1> '+newdoc[key]+' : '+key);
                  return false;
              }
          }
          else
          {
              for (var item in newdoc[key])
              {
                  if (newdoc[key][item].data.valueOf() != olddoc[key][item].data.valueOf() && !veda.Util.isTechnicalAttribute(key, olddoc[key][item].data))
                  { // поменялось одно из значений в нетехническом атрибуте
                      //print ('2 old:', veda.Util.toJson(olddoc));
                      //print ('2 new:', veda.Util.toJson(newdoc));
                      //print (newdoc['@']+' x '+olddoc[key][item].data+' >2> '+newdoc[key][item].data+' : '+key);
                      return false;
                  }
              }
          }
      }

      return true;
  };


// DEPRECATED
  veda.Util.isTechnicalAttribute = function (attName, oldvalue)
  {
      if (!oldvalue && attName === 'v-s:actualVersion') return true;
      if (!oldvalue && attName === 'v-s:previousVersion') return true;
      if (!oldvalue && attName === 'v-s:nextVersion') return true;
      if (attName === 'v-wf:hasStatusWorkflow') return true;
      return false;
  };

  veda.Util.loadVariablesUseField = function (ticket, field)
  {
      var res = {};
      for (var idx in field)
      {
          var uri = field[idx].data;
          if (uri)
          {
              var indv = get_individual(ticket, uri);

              if ( veda.Util.hasValue(indv, "rdf:type", {data: "v-s:Variable", type: "Uri"}) )
              {
                  var varName = veda.Util.getFirstValue(indv['v-s:variableName']);
                  var varValue = veda.Util.getValues(indv['v-s:variableValue']);
                  res[varName] = varValue;
              }
          }
      }
      return res;
  };

  veda.Util.isAlphaNumeric = function (src)
  {
      if (!src)
          return false;
      var alphanum = /[a-zA-Z0-9]/;
      if (alphanum.test(src))
          return true;
      else
          return false;
  };

  veda.Util.replace_word = function (src, from, to)
  {
      var trace = true;

      var new_str = src;
      //if (trace)
      //  print ('src=', src, ', from=', from, ', to=', to);

      var is_prepare = false;

      var pos_f = from.indexOf('*');
      var pos_t = to.indexOf('*');

      if (pos_f > 0 && pos_f > 0)
      {
          from = from.substring(0, pos_f);
          to = to.substring(0, pos_t);

          var pos_w_b = src.indexOf(from);
          var word;
          if (pos_w_b >= 0)
          {
              pos_w_b += from.length;
              var pos_w_e = pos_w_b;
              var ch = src.charAt(pos_w_e);
              while (veda.Util.isAlphaNumeric(ch))
              {
                  pos_w_e++;
                  ch = src.charAt(pos_w_e);
              }
              if (pos_w_e > pos_w_b)
              {
                  word = src.substring(pos_w_b, pos_w_e);
                  //print ('is *1, from=', from, ", to=", to);
                  //print ('is *2, word=', word);
                  from = from + word;
                  to = to + word;
                  //print ('is *3, from=', from, ", to=", to);

                  is_prepare = true;
              }
          }
      }
      else
      {
          if (src.length == from.length)
              is_prepare = true;

          if (is_prepare == false)
          {
              var pos = src.indexOf(from);
              if (pos && pos >= 0)
              {
                  if (trace)
                  {
                      print('$replace_word #1 pos=', pos);
                  }

                  var last_ch = src[pos + from.length];

                  if (trace)
                      print('$replace_word #2 last_ch=[' + last_ch + ']');

                  if (last_ch && veda.Util.isAlphaNumeric(last_ch) == false)
                  {
                      if (trace)
                      {
                          print('$replace_word !isAlphaNumeric last_ch=', last_ch);
                      }
                      is_prepare = true;
                  }
              }
          }
      }

      if (is_prepare)
      {
          new_str = src.replace(new RegExp(from, 'g'), to);
      }


      return new_str;
  };

  /**
   * Create document snapshot
   * @param ticket
   * @param document Document
   * @param prev_state Previous document state
   * @param user_uri Initiator
   * @param _event_id
   */
  veda.Util.create_version = function (ticket, document, prev_state, user_uri, _event_id) {
    // Only if we save actual version of document (or it is first save of versioned document)
    if (
      !document['v-s:actualVersion']
      ||
      (
        document['v-s:actualVersion'][0].data === document['@']
        &&
        (
          (
            !document['v-s:previousVersion'] && (!prev_state || !prev_state['v-s:previousVersion'])
          )
          ||
          (
            prev_state
            && document['v-s:previousVersion']
            && prev_state['v-s:previousVersion']
            && document['v-s:previousVersion'][0].data === prev_state['v-s:previousVersion'][0].data
          )
        )
      )
    ) {
      var user = get_individual(ticket, user_uri);
      var appointment_uri = veda.Util.getUri(user["v-s:defaultAppointment"]) || veda.Util.getUri(user["v-s:hasAppointment"]);
      var actor_uri = appointment_uri || user_uri;

      if (!prev_state) prev_state = document;
      var actualId = document['@'];
      var versionId = veda.Util.genUri() + "-vr";

      // Create new version
      var version = get_individual(ticket, document['@']);
      version['@'] = versionId;
      if (prev_state['v-s:previousVersion']) {
        version['v-s:previousVersion'] = prev_state['v-s:previousVersion'];
      } else {
        version['v-s:previousVersion'] = [];
      }
      version['v-s:actualVersion'] = [{
        data: document['@'],
        type: "Uri"
      }];
      version['v-s:nextVersion'] = [{
        data: actualId,
        type: "Uri"
      }];
      version['rdf:type'] = version['rdf:type'].concat(
        [{
          data: "v-s:Version",
          type: "Uri"
        }]
      );
      version['v-s:created'] = [{data: new Date(), type: "Datetime"}];
      version['v-s:edited'] = [];
      version['v-s:creator'] = veda.Util.newUri(actor_uri);
      version['v-s:lastEditor'] = [];

      put_individual(ticket, version, _event_id);

      // Add rights to version
      var membership_uri = 'd:membership_' + versionId.split(':').join('_') + '_' + actualId.split(':').join('_');
      var membership = {
        '@' : membership_uri,
        'rdf:type'     : veda.Util.newUri('v-s:Membership'),
        'v-s:memberOf' : veda.Util.newUri(actualId),
        'v-s:resource' : veda.Util.newUri(versionId),
        'rdfs:comment' : veda.Util.newStr('создано: server script veda.Util.create_version ()'),
        'v-s:canRead'  : veda.Util.newBool(true)
      };
      put_individual (ticket, membership, _event_id);

      // Update previous version
      if (document['v-s:previousVersion']) {
        var previous = get_individual(ticket, veda.Util.getUri(document['v-s:previousVersion']));
        previous['v-s:nextVersion'] = [{
          data: versionId,
          type: "Uri"
        }];
        put_individual(ticket, previous, _event_id);
      }

      // Update actual version
      document['v-s:previousVersion'] = [{
        data: versionId,
        type: "Uri"
      }];
      document['v-s:actualVersion'] = [{
        data: document['@'],
        type: "Uri"
      }];
      document['v-s:nextVersion'] = [];
      document['v-s:edited'] = [{data: new Date(), type: "Datetime"}];
      document['v-s:lastEditor'] = veda.Util.newUri(actor_uri);
      put_individual(ticket, document, _event_id);
    }
  };

  veda.Util.recursiveCall = function (elem, path, ticket, _event_id) {
    if (path[elem['@']]) {
      print('WARNING! Recursive path '+veda.Util.toJson(path)+' > '+elem['a']);
      return;
    }

    path[elem['@']] = Object.keys(path).length;
    if (elem['v-wf:decisionFormList']) {
      elem['v-wf:decisionFormList'].forEach(function(dfae) {
        var df = get_individual(ticket, dfae.data)
        if (!df['v-wf:isCompleted'] || df['v-wf:isCompleted'][0].data == false) {
          df['v-s:deleted'] = veda.Util.newBool(true);
          df['v-wf:isStopped'] = veda.Util.newBool(true);
          put_individual(ticket, df, _event_id);
        }
      });
    }

    if (elem['v-wf:workItemList']) {
      elem['v-wf:workItemList'].forEach(function(wi) {
        veda.Util.recursiveCall(get_individual(ticket, wi.data), path, ticket, _event_id);
      });
    }

    if (elem['v-wf:workOrderList']) {
      elem['v-wf:workOrderList'].forEach(function(wo) {
        veda.Util.recursiveCall(get_individual(ticket, wo.data), path, ticket, _event_id);
      });
    }

    if (elem['v-wf:isProcess']) {
      elem['v-wf:isProcess'].forEach(function(p) {
        var df = get_individual(ticket, p.data);
        if (!df['v-wf:isCompleted'] || df['v-wf:isCompleted'][0].data == false) {
          df['v-wf:isStopped'] = veda.Util.newBool(true);
          put_individual(ticket, df, _event_id);
        }
        veda.Util.recursiveCall(df, path, ticket, _event_id);
      });
    }
  };

  veda.Util.set_err_on_indv = function (msg, indv, src)
  {
      var bugreport = {
        '@' : veda.Util.genUri () + '-err',
        'rdf:type'     : veda.Util.newUri('v-s:BugReport'),
        'v-s:created'  : veda.Util.newDate (new Date()),
        'rdfs:comment' : veda.Util.newStr(src),
        'v-s:errorMessage' : veda.Util.newStr (msg),
        'v-s:resource': veda.Util.newUri (indv['@'])
      };
      put_individual(ticket, bugreport, _event_id);

      var add_to_indv = {
          '@': indv['@'],
          'v-s:hasError': veda.Util.newUri (bugreport['@'])
          };
      add_to_individual(ticket, add_to_indv, _event_id);

      print("ERR! " + src + ':' +  msg);
  };

  veda.Util.set_field_to_document = function (field_name, value, doc_id)
  {
      var set_in_document = {
      '@': doc_id
      };

      set_in_document[field_name] = value;
      set_in_individual(ticket, set_in_document, _event_id);
  };

  /**
   * Трансформировать указанные индивидуалы по заданным правилам
   *
   * @param ticket сессионный билет
   * @param individuals один или несколько IndividualModel или их идентификаторов
   * @param transform применяемая трансформация
   * @param executor контекст исполнителя
   * @param work_order контекст рабочего задания
   * @returns {Array}
   */
  veda.Util.transformation = function (ticket, individuals, transform, executor, work_order, process)
  {
    try
    {
      var out_data0 = {};

      if (Array.isArray(individuals) !== true)
      {
        individuals = [individuals];
      }

      var rules = transform['v-wf:transformRule'];

      if (!rules || !rules.length)
        return;

      //print ("@B start transform");
      var tmp_rules = [];
      //print ("rules_in=", veda.Util.toJson (rules));
      //print ("individuals=", veda.Util.toJson (individuals));
      for (var i in rules)
      {
        var rul = get_individual(ticket, rules[i].data);
        if (!rul)
        {
          print("not read rule [", veda.Util.toJson(rul), "]");
          continue;
        }
        else
          tmp_rules.push(rul);
      }
      rules = tmp_rules;

      var out_data0_el = {};

      /* PUT functions [BEGIN] */
      var putFieldOfIndividFromElement = (function()
      {
        return function(name, field)
        {
          var rr = get_individual(ticket, veda.Util.getUri(element));
          if (!rr)
            return;

          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(rr[field]);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putFieldOfObject = (function()
      {
        return function(name, field)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
              out_data0_el_arr = [];

          out_data0_el_arr.push(individual[field]);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putUri = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Uri"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setUri = function(name, value)
      {
        out_data0_el[name] = [
        {
          data: value,
          type: "Uri"
        }];
      };

      var putString = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "String"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setString = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "String"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setDatetime = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Datetime"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putDatetime = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Datetime"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putBoolean = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Boolean"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setBoolean = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Boolean"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();


      var putInteger = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Integer"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var setInteger = (function()
      {
        return function(name, value)
        {
          var out_data0_el_arr;

          out_data0_el_arr = [];

          out_data0_el_arr.push(
          {
            data: value,
            type: "Integer"
          });

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putExecutor = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(executor) === true)
          {
            for (var key3 in executor)
            {
              out_data0_el_arr.push(executor[key3]);
            }
          }
          else
            out_data0_el_arr.push(executor);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putWorkOrder = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(work_order) === true)
          {
            for (var key3 in work_order)
            {
              out_data0_el_arr.push(work_order[key3]);
            }
          }
          else
            out_data0_el_arr.push(work_order);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var putThisProcess = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(process) === true)
          {
            for (var key3 in process)
            {
              out_data0_el_arr.push(process[key3]);
            }
          }
          else
            out_data0_el_arr.push(process);

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      var removeThisProcess = (function()
      {
        return function(name)
        {
          var out_data0_el_arr = out_data0_el[name];

          if (!out_data0_el_arr)
            out_data0_el_arr = [];

          if (Array.isArray(process) === true)
          {
            for (var key3 in process)
            {
              out_data0_el_arr = out_data0_el_arr.filter(function (value) {return value.data !== process[key3];});
            }
          }
          else
          {
            out_data0_el_arr = out_data0_el_arr.filter(function (value) {return value.data !== process;});
          }

          out_data0_el[name] = out_data0_el_arr;
        };
      })();

      /* PUT functions [END] */

      for (var key in individuals)
      {
        //print("#1 key=", key);
        var individual = individuals[key];

        //print("#1.1 key=", key);
        var objectContentStrValue = (function()
        {
          return function(name, value)
          {
            if (individual[name])
            {
              var result = false;
              for (var i in individual[name])
              {
                if (value === individual[name][i].data)
                {
                  result = true;
                }
              }
              return result;
            }
          };
        })();

        var iteratedObject = Object.keys(individual);

        for (var key2 = 0; key2 < iteratedObject.length; key2++)
        {
          var element = individual[iteratedObject[key2]];

          var putValue = (function()
          {
            return function(name)
            {
              var out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr)
                out_data0_el_arr = [];

              if (iteratedObject[key2] == '@')
              {
                out_data0_el_arr.push(
                {
                  data: element,
                  type: "Uri"
                });
              }
              else
              {
                if (Array.isArray(element) === true)
                {
                  for (var key3 in element)
                  {
                    out_data0_el_arr.push(element[key3]);
                  }
                }
                else
                  out_data0_el_arr.push(element);
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          var putValueFrom = (function()
          {
            return function(name, path, transform)
            {
              var out_data0_el_arr = out_data0_el[name];
              if (!out_data0_el_arr)
                out_data0_el_arr = [];

              var element_uri;

              if (Array.isArray(element) === true)
                element_uri = veda.Util.getUri (element);
              else
                element_uri = element.data ? element.data : element;

              var curelem;

              curelem = get_individual(ticket, element_uri);

              for (var i = 0; i < path.length - 1; i++)
              {
                if (!curelem || !curelem[path[i]]) return;
                var uri = Array.isArray(curelem[path[i]]) && curelem[path[i]][0].data ? curelem[path[i]][0].data : curelem[path[i]];
                curelem = get_individual(ticket, uri);
              }
              if (!curelem || !curelem[path[path.length - 1]]) return;

              out_data0_el_arr = out_data0_el_arr.concat(curelem[path[path.length - 1]]);

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          var putFrontValue = (function()
          {
            return function(name)
            {
              var out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr)
                out_data0_el_arr = [];
              if (iteratedObject[key2] == '@')
              {
                out_data0_el_arr.unshift(
                {
                  data: element,
                  type: "Uri"
                });
              }
              else
              {
                if (Array.isArray(element) === true)
                {
                  for (var key3 in element)
                  {
                    out_data0_el_arr.unshift(element[key3]);
                  }
                }
                else
                  out_data0_el_arr.unshift(element);
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          var putElement = (function()
          {
            return function()
            {
              var name = iteratedObject[key2];
              if (name == '@')
                return;

              var out_data0_el_arr = [];
              out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr)
                out_data0_el_arr = [];

              if (Array.isArray(element) === true)
              {
                for (var key3 in element)
                {
                  out_data0_el_arr.push(element[key3]);
                }
              }
              else
                out_data0_el_arr.push(element);

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          /* Segregate functions [BEGIN] */
          var contentName = (function()
          {
            return function(name)
            {
              return iteratedObject[key2] == name;
            };
          })();

          var elementContentStrValue = (function()
          {
            return function(name, value)
            {
              if (iteratedObject[key2] !== name)
                return false;
              var str = element[0].data;
              if (str == value)
                return true;
              else
                return false;
            };
          })();
          /* Segregate functions [END] */

          var getElement = (function()
          {
            return function()
            {
              return element;
            };
          })();


          // выполняем все rules
          for (var key3 in rules)
          {
            var rule = rules[key3];
            // 1. v-wf:segregateObject
            var segregateObject = rule['v-wf:segregateObject'];

            // 2. v-wf:segregateElement
            var segregateElement = rule['v-wf:segregateElement'];
            var grouping = rule['v-wf:grouping'];

            var res = undefined;

            if (segregateObject)
            {
              res = eval(segregateObject[0].data);
              if (res == false)
                continue;
            }

            if (segregateElement)
            {
              res = eval(segregateElement[0].data);
              if (res == false)
                continue;
            }

            // 3. v-wf:aggregate
            var group_key;
            if (!grouping)
            {
              out_data0_el = {};
              out_data0_el['@'] = veda.Util.genUri() + "-tr";
            }
            else
            {
              var useExistsUid = false;
              for (var i in grouping)
              {
                var gk = grouping[i].data;
                if (gk == '@')
                  useExistsUid = true;
                else
                  group_key = gk;
              }

              out_data0_el = out_data0[group_key];
              if (!out_data0_el)
              {
                out_data0_el = {};
                if (useExistsUid)
                  out_data0_el['@'] = individual['@'];
                else
                  out_data0_el['@'] = veda.Util.genUri() + "-tr";
              }
            }

            var agregate = rule['v-wf:aggregate'];
            for (var i2 = 0; i2 < agregate.length; i2++)
            {
              eval(agregate[i2].data);
            }

            if (!grouping)
            {
              out_data0[out_data0_el['@']] = out_data0_el;
            }
            else
            {
              out_data0[group_key] = out_data0_el;
            }
          }
        }
      }

      var out_data = [];
      for (var key in out_data0)
      {
        out_data.push(out_data0[key]);
      }

      return out_data;
    }
    catch (e)
    {
      console.log(e.stack);
    }
  };

});
