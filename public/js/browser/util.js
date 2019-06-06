"use strict";

// Veda browser utility functions

veda.Module(function (veda) { "use strict";

  veda.Util = veda.Util || {};

  veda.Util.registerHandler = function (individual, template, event, handler) {
    individual.on(event, handler);
    template.one("remove", function () {
      individual.off(event, handler);
    });
  };

  veda.Util.decimalDatetimeReviver = function (key, value) {
    return key === "data" && this.type === "Datetime" ? new Date(value) : key === "data" && this.type === "Decimal" ? parseFloat(value) : value ;
  };

  veda.Util.mergeMutualChanges = function (high, low, base) {
    var key, merged = {};
    for (key in base) {
      merged[key] = base[key];
    }
    var highBaseDiff = veda.Util.diff(high, base);
    var lowBaseDiff = veda.Util.diff(low, base);
    var highLowDiff = veda.Util.diff(high, low);
    var lowHighDiff = veda.Util.diff(low, high);
    for (key in lowBaseDiff.missing) {
      delete merged[key];
    }
    for (key in highBaseDiff.missing) {
      delete merged[key];
    }
    for (key in lowBaseDiff.added) {
      merged[key] = lowBaseDiff.added[key];
    }
    for (key in highBaseDiff.added) {
      merged[key] = highBaseDiff.added[key];
    }
    for (key in lowBaseDiff.differ) {
      merged[key] = lowBaseDiff.differ[key];
    }
    for (key in highBaseDiff.diff) {
      merged[key] = highBaseDiff.differ[key];
    }
    return {
      merged: merged,
      conflicts: {
        high: highLowDiff.differ,
        low: lowHighDiff.differ
      }
    };
  };

  veda.Util.diff = function (changed, base) {
    var delta = {
      added: {},
      missing: {},
      differ: {}
    }
    var key, values, value, length, i, hasValue;
    for (key in base) {
      if ( !(key in changed) ) {
        delta.missing[key] = base[key];
      } else {
        if (key === "@") {
          if (changed[key] !== base[key]) {
            delta.differ[key] = changed[key];
          }
          continue;
        }
        values = base[key];
        length = values.length;
        hasValue = true;
        for (i = 0; i < length && hasValue; i++) {
          value = values[i];
          hasValue = hasValue && veda.Util.hasValue(changed, key, value);
        }
        if ( !hasValue ) {
          delta.differ[key] = changed[key];
        }
      }
    }
    for (key in changed) {
      if ( !(key in base) ) {
        delta.added[key] = changed[key];
      }
    }
    return delta;
  };

  // Уcтанавливает cookie
  // name - Название cookie
  // value - Значение cookie (строка)
  // props - Объект с дополнительными свойствами для установки cookie:
  //   expires - Время истечения cookie. Интерпретируется по-разному, в зависимости от типа:
  //     Если число - количество миллисекунд до истечения.
  //     Если объект типа Date - точная дата истечения.
  //     Если expires в прошлом, то cookie будет удалено.
  //     Если expires отсутствует или равно 0, то cookie будет установлено как сессионное и исчезнет при закрытии браузера.
  //   path - Путь для cookie.
  //   domain - Домен для cookie.
  //   secure - Пересылать cookie только по защищенному соединению.

  veda.Util.setCookie = function (name, value, props) {
    props = props || {};
    var exp = props.expires;
    if (typeof exp === "number" && exp) {
      var d = new Date();
      d.setTime(d.getTime() + exp);
      exp = props.expires = d;
    }
    if (exp && exp.toUTCString) { props.expires = exp.toUTCString(); }
    value = encodeURIComponent(value);
    var updatedCookie = name + "=" + value;
    for(var propName in props) {
      updatedCookie += "; " + propName;
      var propValue = props[propName];
      if (propValue !== true) { updatedCookie += "=" + propValue; }
    }
    document.cookie = updatedCookie;
  };

  veda.Util.delCookie = function (name) {
    veda.Util.setCookie(name, null, { expires: -1 });
  };

  // Escape function for css (jQuery) selectors
  veda.Util.escape4$ = function (str) {
    if (str) return str.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
    return str;
  };

  veda.Util.toTTL = function (individualList, callback) {
    var all_prefixes = {},
        prefixes = {},
        triples = [],
        writer = N3.Writer();

    all_prefixes["dc"] = "http://purl.org/dc/elements/1.1/";
    all_prefixes["grddl"] = "http://www.w3.org/2003/g/data-view#";

    veda.Backend.query(veda.ticket, "'rdf:type'=='owl:Ontology'")
      .then(function (queryResult) {
        var ontologies_uris = queryResult.result;
        var ontologiesPromises = ontologies_uris.map(function (ontology_uri) {
          var ontology = new veda.IndividualModel(ontology_uri);
          return ontology.load();
        });
        return Promise.all(ontologiesPromises);
      })
      .then(function (ontologies) {
        ontologies.forEach(function (ontology) {
          var prefix = ontology.id.slice(0, -1);
          if (ontology.hasValue("v-s:fullUrl")) {
            all_prefixes[prefix] = ontology["v-s:fullUrl"][0].toString();
          }
        });
      })
      .then(function () {
        individualList.forEach(function (individual) {
          var subject = prefixer(individual.id);
          // Type first
          individual.properties["rdf:type"].map(function (value) {
            var type_triple = {};
            type_triple.subject = subject;
            type_triple.predicate = prefixer("rdf:type");
            type_triple.object = prefixer(value.data);
            triples.push(type_triple);
          });
          // Other properties
          Object.getOwnPropertyNames(individual.properties).sort().map(function (property_uri) {
            if (property_uri === "@" || property_uri === "rdf:type") { return; }
            individual.properties[property_uri].map(function (item) {
              var triple = {};
              triple.subject = subject;
              triple.predicate = prefixer(property_uri);
              var value = item.data,
                  type = item.type,
                  lang = item.lang;
              switch (type) {
                case 4:
                case "Integer":
                  triple.object = '"' + value + '"^^' + prefixer("xsd:integer");
                  break;
                case 32:
                case "Decimal":
                  triple.object = '"' + value + '"^^' + prefixer("xsd:decimal");
                  break;
                case 64:
                case "Boolean":
                  triple.object = '"' + value + '"^^' + prefixer("xsd:boolean");
                  break;
                case 2:
                case "String":
                  triple.object = lang && lang !== "NONE" ? '"' + value + '"@' + lang.toLowerCase() : '"' + value + '"^^' + prefixer("xsd:string");
                  break;
                case 8:
                case "Datetime":
                  triple.object = '"' + ( value instanceof Date ? value.toISOString() : value ) + '"^^' + prefixer("xsd:dateTime");
                  break;
                case 1:
                case "Uri":
                  triple.object = prefixer(value);
                  break;
              }
              triples.push(triple);
            });
          });
        });
        writer.addPrefixes(prefixes);
        writer.addTriples(triples);
        writer.end(callback);
      });

    function prefixer(uri) {
      try {
        var colonIndex = uri.indexOf(":"),
            prefix = uri.substring(0, colonIndex);
        if ( !prefixes[prefix] ) {
          prefixes[prefix] = all_prefixes[prefix];
        }
        if ( colonIndex === uri.length-1 ) {
          return prefixes[prefix];
        } else {
          return N3.Util.expandPrefixedName(uri, prefixes);
        }
      } catch (error) {
        var notify = veda.Notify ? new veda.Notify() : function () {};
        notify("danger", error);
        return uri;
      }
    }
  };

  veda.Util.exportTTL = function (individualList) {
    veda.Util.toTTL(individualList, function (error, result) {
      var blob = new Blob([result], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "exported_graph.ttl");
    });
  };

  /**
   * Event `createReport` handler:
   *  - Find available reports or use report specified by `reportId` parameter.
   *  - Let user to choice report (if more then one founded)
   *  - Redirect to report
   */
  veda.Util.createReport = function (report, params) {
    if (typeof report === "string" || report instanceof String) {
      report = new veda.IndividualModel(report);
    }
    var jasperServerCfg = new veda.IndividualModel('cfg:jasperServerAddress');
    Promise.all([report.load(), jasperServerCfg.load()]).then(function (loaded) {
      var report = loaded[0];
      var jasperServerCfg = loaded[1];
      var jasperServerAddress = jasperServerCfg['rdf:value'][0];

      var form = document.createElement("form");
      form.setAttribute("method", "post");
      form.setAttribute("action", jasperServerAddress + "flow.html?_flowId=viewReportFlow&j_username=joeuser&j_password=joeuser&reportUnit=" + encodeURIComponent(report["v-s:reportPath"][0]) + "&output=" + encodeURIComponent(report["v-s:reportFormat"][0]) + "&documentId=" + encodeURIComponent(params.id) + "&ticket=" + veda.ticket);
      form.setAttribute("target", "Report");

      Object.getOwnPropertyNames(params.properties).forEach(function (key) {
        if ( key !== "@" && params.hasValue(key) ) {
          var hiddenField = document.createElement("input");
          hiddenField.setAttribute("type", "hidden");
          hiddenField.setAttribute("name", key.replace(":", "_"));
          var value = params.get(key).map(function (item) {
            return item instanceof veda.IndividualModel ? item.id :
                   item instanceof Date ? item.toISOString() :
                   item;
          }).join(",");
          hiddenField.setAttribute("value", value);
          form.appendChild(hiddenField);
        }
      });
      // Set client timezone parameter
      var tz = (new Date()).getTimezoneOffset();
      var tzField = document.createElement("input");
      tzField.setAttribute("type", "hidden");
      tzField.setAttribute("name", "timezone");
      tzField.setAttribute("value", tz);
      form.appendChild(tzField);
      document.body.appendChild(form);
      window.open("", "Report");
      form.submit();
    });
  };

  /**
   * Event `showRights` handler:
   *  - Find available reports
   *  - Let user to choice report (if more then one founded)
   *  - Redirect to report
   */
  veda.Util.showRights = function (individual) {
    var modalTmpl = $("#individual-modal-template").html();
    var modal = $(modalTmpl);
    var modalBody = $(".modal-body", modal);
    modal.modal();
    modal.on("hidden.bs.modal", function () {
      modal.remove();
    });
    $("body").append(modal);
    individual.present(modalBody, "v-ui:PermissionsTemplate");
  };

  veda.Util.showModal = function (individual, template, mode) {
    var modal = $( $("#notification-modal-template").html() );
    modal.modal();
    $("body").append(modal);
    var container = $(".modal-body", modal);
    individual.present(container, template, mode);
    $(".action#cancel", modal).click(function () {
      modal.modal("hide");
    });
    modal.on("hidden.bs.modal", function () {
      modal.remove();
    });
    return modal;
  };

  veda.Util.showSmallModal = function (individual, template, mode) {
    var modal = $( $("#minimal-modal-template").html() );
    modal.modal();
    $("body").append(modal);
    var container = $(".modal-body", modal);
    individual.present(container, template, mode);
    $(".action#cancel", modal).click(function () {
      modal.modal("hide");
    });
    modal.on("hidden.bs.modal", function () {
      modal.remove();
    });
    return modal;
  };

  veda.Util.confirm = function (individual, template, mode) {
    var modal = $( $("#confirm-modal-template").html() );
    modal.modal();
    modal.on("hidden.bs.modal", function () {
      modal.remove();
    });
    $("body").append(modal);
    var container = $(".modal-body", modal);
    return individual.present(container, template, mode).then(function () {
      return new Promise(function (resolve, reject) {
        $(".modal-footer > .ok", modal).click(function () { resolve(true); });
        $(".modal-footer > .cancel", modal).click(function () { resolve(false); });
      });
    });
  };

  /**
   * Event `send` handler:
   *  - Find transformation to start form or use transformation specified by `transformId` parameter
   *  - Apply transformation and redirect to start form.
   */
  veda.Util.send = function (individual, template, transformId, modal, startFormTemplate) {
    if ( transformId ) {
      template.trigger("save");
      var transform = new veda.IndividualModel(transformId);
      transform.load().then(function (transform) {
        veda.Util.buildStartFormByTransformation(individual, transform).then(function (startForm) {
          veda.Util.showModal(startForm, startFormTemplate, "edit");
        });
      });
    } else {
      individual["v-wf:hasStatusWorkflow"] = [ new veda.IndividualModel("v-wf:ToBeSent") ];
      template.trigger("save");
      template.closest(".modal").modal("hide").remove();
      var notify = veda.Notify ? new veda.Notify() : function () {};
      var sendSuccess = new veda.IndividualModel("v-s:SendSuccess");
      sendSuccess.load().then(function (sendSuccess) {
        notify("success", {name: sendSuccess});
      });
    }
  };

  /**
   * @returns veda.IndividualModel - start form
   */
  veda.Util.buildStartFormByTransformation = function (individual, transform) {
    var promises = [individual.load(), transform.load()];
    return Promise.all(promises).then(function(loadedItems) {
      return veda.Util.transformation(loadedItems[0].properties, loadedItems[1].properties);
    }).then(function (transformResult) {
      var startForm = new veda.IndividualModel(transformResult[0]);
      startForm.isNew(true);
      startForm.isSync(false);
      return startForm.init();
    });
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
  veda.Util.transformation = function (individuals, transform) {

    if ( !Array.isArray(individuals) ) {
      individuals = [individuals];
    }

    var rules = veda.Util.getValues(transform['v-wf:transformRule']);

    if (!rules.length) { return Promise.resolve(); }

    return veda.Backend.get_individuals(veda.ticket, rules).then(function (rules) {

      var out_data0 = {};

      var out_data0_el = {};

      /* PUT functions [BEGIN] */

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

              curelem = veda.Backend.get_individual({
                ticket: veda.ticket,
                uri: element_uri,
                async: false
              });

              for (var i = 0; i < path.length - 1; i++)
              {
                if (!curelem || !curelem[path[i]]) return;
                var uri = Array.isArray(curelem[path[i]]) && curelem[path[i]][0].data ? curelem[path[i]][0].data : curelem[path[i]];
                curelem = veda.Backend.get_individual({
                  ticket: veda.ticket,
                  uri: uri,
                  async: false
                });
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

    }).catch(function (error) {

      console.log(error);

    });
  };

});
