// Veda browser utility functions

"use strict";

import veda from "../common/veda.js";

import IndividualModel from "../common/individual_model.js";

import Backend from "../common/backend.js";

import Notify from "../browser/notify.js";

var Util = veda.Util || {};

export default veda.Util = Util;

Util.registerHandler = function (individual, template, event, handler) {
  individual.on(event, handler);
  template.one("remove", function () {
    individual.off(event, handler);
  });
};

// Escape function for css (jQuery) selectors
Util.escape4$ = function (str) {
  if (str) return str.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');
  return str;
};

Util.toTTL = function (individualList, callback) {
  var prefixes = {};
  var ttl = individualList.map(function (individual) {
    var individual_ttl = "";
    for ( var property in individual.properties ) {
      var resources = individual.properties[property];
      if (property === "@") {
        individual_ttl = resources + "\n" + individual_ttl;
        prefixer(resources, prefixes);
      } else {
        var values = resources.reduce(function (acc, resource) {
          var value;
          switch (resource.type) {
            case "Boolean":
            case "Integer":
            case "Decimal":
              value = resource.data;
              break;
            case "Uri":
              value = prefixer(resource.data, prefixes);
              break;
            case "Datetime":
              value = "\"" + resource.data + "\"^^xsd:dateTime";
              prefixer("xsd:", prefixes);
              break;
            case "String":
              if (/("|\n)/.test(resource.data)) {
                value = "\"\"\"" + resource.data + "\"\"\"";
              } else {
                value = "\"" + resource.data + "\"";
              }
              if (resource.lang !== undefined && resource.lang !== "NONE") {
                value += "@" + resource.lang.toLowerCase();
              }
              break;
          }
          return acc.length ? acc + ", " + value : value ;
        }, "");
        individual_ttl += "  " + property + " " + values + " ;\n";
        prefixer(property, prefixes);
      }
    }
    return individual_ttl + ".\n";
  }).join("\n");

  ttl = "\n" + ttl;

  for ( var prefix in prefixes ) {
    ttl = ["@prefix", prefix, "<" + prefixes[prefix] + ">"].join(" ") + ".\n" + ttl;
  }

  callback(undefined, ttl);

  function prefixer(value, prefixes) {
    var reg_uri = /^([a-z-0-9]+:)[a-zA-Z0-9-_]*$/;
    var ontologies = veda.ontology.ontologies;
    var result = reg_uri.exec(value);
    var prefix = result ? result[1] : null;
    var expanded;
    if (prefix === "dc") {
      expanded = "http://purl.org/dc/elements/1.1/";
    } else if (prefix === "grddl") {
      expanded = "http://www.w3.org/2003/g/data-view#";
    } else if (ontologies[prefix]) {
      expanded = ontologies[prefix]["v-s:fullUrl"][0].toString();
    }
    if (expanded) {
      prefixes[prefix] = expanded;
      return value;
    } else {
      return "<" + value + ">";
    }
  }
};

Util.exportTTL = function (individualList) {
  System.import("filesaver").then(function (module) {
    var saveAs = module.default;
    Util.toTTL(individualList, function (error, result) {
      var blob = new Blob([result], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "exported_graph.ttl");
    });
  });
};

/**
 * Event `createReport` handler:
 *  - Find available reports or use report specified by `reportId` parameter.
 *  - Let user to choice report (if more then one founded)
 *  - Redirect to report
 */
Util.createReport = function (report, params) {
  if (typeof report === "string" || report instanceof String) {
    report = new IndividualModel(report);
  }
  var jasperServerCfg = new IndividualModel('cfg:jasperServerAddress');
  Promise.all([report.load(), jasperServerCfg.load()]).then(function (loaded) {
    var report = loaded[0];
    var jasperServerCfg = loaded[1];
    var jasperServerAddress = jasperServerCfg['rdf:value'][0];

    var form = document.createElement("form");
    form.setAttribute("method", "post");
    form.setAttribute("action", jasperServerAddress + "flow.html?_flowId=viewReportFlow&reportUnit=" + encodeURIComponent(report["v-s:reportPath"][0]) + "&output=" + encodeURIComponent(report["v-s:reportFormat"][0]) + "&documentId=" + encodeURIComponent(params.id) + "&ticket=" + veda.ticket);
    form.setAttribute("target", "Report");

    Object.getOwnPropertyNames(params.properties).forEach(function (key) {
      if ( key !== "@" && params.hasValue(key) ) {
        var hiddenField = document.createElement("input");
        hiddenField.setAttribute("type", "hidden");
        hiddenField.setAttribute("name", key.replace(":", "_"));
        var value = params.get(key).map(function (item) {
          return item instanceof IndividualModel ? item.id :
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
Util.showRights = function (individual) {
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

Util.showModal = function (individual, template, mode) {
  if ( $("body").hasClass("modal-open")) {
    $(".modal").modal("hide").remove();
  };
  var modal = $( $("#notification-modal-template").html() );
  modal.modal();
  $("body").append(modal);
  var container = $(".modal-body", modal);
  if (typeof individual === "string") {
    individual = new IndividualModel(individual);
  }
  individual.present(container, template, mode);
  modal.find("#follow").click( function () {
    var resourceTemplate = modal.find("[resource]").first();
    var uri = resourceTemplate.attr("resource");
    var mode = resourceTemplate.data("mode");
    modal.modal("hide");
    riot.route( ["#", uri, "#main", undefined, mode].join("/") );
  });
  $(".action#cancel", modal).click(function () {
    modal.modal("hide");
  });
  modal.on("hidden.bs.modal", function () {
    modal.remove();
  });
  return modal;
};

Util.showSmallModal = function (individual, template, mode) {
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

Util.confirm = function (individual, template, mode) {
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
Util.send = function (individual, template, transformId, modal, startFormTemplate) {
  if ( transformId ) {
    template.trigger("save");
    var transform = new IndividualModel(transformId);
    return transform.load().then(function (transform) {
      return Util.buildStartFormByTransformation(individual, transform).then(function (startForm) {
        return Util.showModal(startForm, startFormTemplate, "edit");
      });
    });
  } else {
    individual["v-wf:hasStatusWorkflow"] = [ new IndividualModel("v-wf:ToBeSent") ];
    template.trigger("save");
    template.closest(".modal").modal("hide").remove();
    var notify = Notify ? new Notify() : function () {};
    var sendSuccess = new IndividualModel("v-s:SendSuccess");
    sendSuccess.load().then(function (sendSuccess) {
      notify("success", {name: sendSuccess});
    });
  }
};

/**
 * @returns IndividualModel - start form
 */
Util.buildStartFormByTransformation = function (individual, transform) {
  var promises = [individual.load(), transform.load()];
  return Promise.all(promises).then(function(loadedItems) {
    return Util.transformation(loadedItems[0].properties, loadedItems[1].properties);
  }).then(function (transformResult) {
    var startForm = new IndividualModel(transformResult[0]);
    startForm.isNew(true);
    startForm.isSync(false);
    return startForm.init();
  });
};

/**
 * Sync get individual
 */
function getSync(ticket, uri) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "get_individual?uri=" + uri + "&ticket=" + ticket, false);
  xhr.send();
  if (xhr.status === 200) {
    return JSON.parse(xhr.responseText, Util.decimalDatetimeReviver);
  } else {
    throw new BackendError(xhr);
  }
}

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
Util.transformation = function (individuals, transform) {

  if ( !Array.isArray(individuals) ) {
    individuals = [individuals];
  }

  var rules = Util.getValues(transform['v-wf:transformRule']);

  if (!rules.length) { return Promise.resolve(); }

  return Backend.get_individuals(veda.ticket, rules).then(function (rules) {

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
              element_uri = Util.getUri (element);
            else
              element_uri = element.data ? element.data : element;

            var curelem;

            curelem = getSync(veda.ticket, element_uri);

            for (var i = 0; i < path.length - 1; i++)
            {
              if (!curelem || !curelem[path[i]]) return;
              var uri = Array.isArray(curelem[path[i]]) && curelem[path[i]][0].data ? curelem[path[i]][0].data : curelem[path[i]];
              curelem = getSync(veda.ticket, uri);
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
            out_data0_el['@'] = Util.genUri() + "-tr";
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
                out_data0_el['@'] = Util.genUri() + "-tr";
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
