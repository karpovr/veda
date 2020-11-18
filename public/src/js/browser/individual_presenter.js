// Individual Presenter

"use strict";

import veda from "../common/veda.js";

import IndividualModel from "../common/individual_model.js";

import Util from "../common/util.js";

import "./util.js";

import riot from "../common/lib/riot.js";

import Notify from "./notify.js";

import $ from "jquery";

import "jquery-ui";

import "./veda_controls.js";

IndividualModel.prototype.present = IndividualPresenter;

export default IndividualPresenter;

function IndividualPresenter(container, template, mode, extra, toAppend) {

  mode = mode || "view";

  toAppend = typeof toAppend !== "undefined" ? toAppend : true;

  if (typeof container === "string") {
    container = $(container);
  }

  var reg_uri = /^[a-z-0-9]+:([a-zA-Z0-9-_])*$/;

  return this.load().then(function (individual) {

    var offlineTemplate = "<h5 class='container sheet text-center text-muted'>Нет связи с сервером. Этот объект сейчас недоступен / Server disconnected. This object is not available now</h5>";

    if (template) {
      if (template instanceof IndividualModel) {
      // if template is uri
      } else if (typeof template === "string" && reg_uri.test(template) ) {
        template = new IndividualModel(template);
      } else {
        if (typeof template === "string") {
          var templateString = template;
        } else if (template instanceof HTMLElement) {
          var templateString = template.outerHTML;
        }
        var uri = Util.simpleHash(templateString).toString();
        template = veda.cache.get(uri) ? veda.cache.get(uri) : new IndividualModel({
          "@": uri,
          "v-ui:template": [{data: templateString, type: "String"}]
        }, 1);
      }
      return template.load().then(function (template) {
        template = template.hasValue("v-ui:template") ? template["v-ui:template"][0].toString() : offlineTemplate;
        return renderTemplate(individual, container, template, mode, extra, toAppend);
      });
    } else {
      var isClass = individual.hasValue("rdf:type", "owl:Class") || individual.hasValue("rdf:type", "rdfs:Class");
      var templatePromise;
      if ( individual.hasValue("v-ui:hasTemplate") && !isClass ) {
        template = individual["v-ui:hasTemplate"][0];
        templatePromise = template.load().then(function (template) {
          if ( !template.hasValue("rdf:type", "v-ui:ClassTemplate") ) {
            throw new Error("Template type violation!");
          }
          template = template.hasValue("v-ui:template") ? template["v-ui:template"][0].toString() : offlineTemplate;
          return renderTemplate(individual, container, template, mode, extra, toAppend);
        });
      } else {
        var ontology = veda.ontology;

        var typePromises = individual["rdf:type"].map(function (type) {
          return type.load();
        });
        templatePromise = Promise.all(typePromises).then(function (types) {
          var templatesPromises = types.map( function (type) {
            var defaultTemplateUri = ontology.getClassTemplate(type.id);
            if (defaultTemplateUri) {
              return new IndividualModel(defaultTemplateUri).load();
            } else {
              return type.hasValue("v-ui:hasTemplate") ? type["v-ui:hasTemplate"][0].load() : new IndividualModel("v-ui:generic").load();
            }
          });
          return Promise.all(templatesPromises);
        }).then(function (templates) {
          var renderedTemplatesPromises = templates.map( function (template) {
            template = template.hasValue("v-ui:template") ? template["v-ui:template"][0].toString() : offlineTemplate;
            return renderTemplate(individual, container, template, mode, extra, toAppend);
          });
          return Promise.all(renderedTemplatesPromises);
        }).then(function (renderedTemplates) {
          return renderedTemplates.reduce(function (acc, renderedTemplate) {
            return acc.add(renderedTemplate);
          }, $());
        });
      }
      return templatePromise;
    }
  })
  .catch(function (error) {
    console.log("Presenter error", error);
  });
}

function renderTemplate(individual, container, template, mode, extra, toAppend) {
  var match,
      pre_render_src,
      pre_result,
      post_render_src;

  template = template.trim();

  // Extract pre script, template and post script
  match = template.match(/^(?:<script[^>]*>([\s\S]*?)<\/script>)?([\s\S]*?)(?:<script[^>]*>(?![\s\S]*<script[^>]*>)([\s\S]*)<\/script>)?$/i);
  //match = preProcess(template);
  pre_render_src = match[1];
  template = $( match[2] );
  post_render_src = match[3];

  if (pre_render_src) {
    pre_result = eval("(function (){ 'use strict'; " + pre_render_src + "}).call(individual);");
  }

  return (pre_result instanceof Promise ? pre_result : Promise.resolve(pre_result)).then(function () {

    return processTemplate(individual, container, template, mode).then(function (processedTemplate) {

      processedTemplate.trigger(mode);

      if (toAppend) {
        container.append(processedTemplate);
      }

      if (post_render_src) {
        eval("(function (){ 'use strict'; " + post_render_src + "}).call(individual);");
      }
      return processedTemplate;

    });

  });
}

function preProcess(templateString) {
  var pre,
      preStart = templateString.indexOf("<script>") + 8,
      preEnd = templateString.indexOf("</script>"),
      hasPre = preStart === 8;
  if (hasPre) {
    pre = templateString.substring(preStart, preEnd);
    templateString = templateString.substring(preEnd + 9);
  }
  var post,
      postStart = templateString.lastIndexOf("<script>") + 8,
      postEnd = templateString.lastIndexOf("</script>"),
      hasPost = postEnd === templateString.length - 9;
  if (hasPost) {
    post = templateString.substring(postStart, postEnd);
    templateString = templateString.substring(0, postStart - 8);
  }
  // Compatible with regexp
  return [undefined, pre, templateString, post];
}

function processTemplate (individual, container, template, mode) {

  // Get properties specifications
  var ontology = veda.ontology;
  var specs = $.extend.apply (
    {}, [{}].concat(
      individual["rdf:type"].map( function (_class) {
        return ontology.getClassSpecifications(_class.id);
      })
    )
  );
  template.attr({
    "resource": individual.id,
    "typeof": individual["rdf:type"].map(function (item) { return item.id; }).join(" ")
  });

  var view = template.find(".view").addBack(".view");
  var edit = template.find(".edit").addBack(".edit");
  var search = template.find(".search").addBack(".search");
  var _view = template.find(".-view").addBack(".-view");
  var _edit = template.find(".-edit").addBack(".-edit");
  var _search = template.find(".-search").addBack(".-search");

  // Apply mode to template to show/hide elements in different modes
  function modeHandler (e) {
    e.stopPropagation();
    mode = e.type;
    template.data("mode", mode);
    switch (mode) {
      case "view": view.show(); _view.hide(); break;
      case "edit": edit.show(); _edit.hide(); break;
      case "search": search.show(); _search.hide(); break;
    }
  }
  template.on("view edit search", modeHandler);

  // Embedded templates list
  var embedded = [];

  // Trigger same events for embedded templates
  function syncEmbedded (e) {
    embedded.map(function (item) {
      item.trigger(e.type, individual.id);
    });
    e.stopPropagation();
  }
  template.on("view edit search", syncEmbedded);

  // Define handlers
  template.callModelMethod = function (method, parent) {
    return Promise.all(embedded.map(function (item) {
      return item.callModelMethod(method, individual.id);
    })).then(function () {
      if (parent === individual.id) {
        return Promise.resolve();
      } else {
        return individual[method]();
      }
    }).then(function () {
      template.trigger("view");
      if (method === "reset") { return; }
      if (!parent) {
        var successMsg = new IndividualModel("v-s:SuccessBundle").load();
        successMsg.then(function (successMsg) {
          var notify = Notify ? new Notify() : function () {};
          notify("success", {name: successMsg.toString()});
        });
      } else if (parent !== individual.id) {
        var parentIndividual = new IndividualModel(parent);
        parentIndividual.isSync(false);
      }
    }).catch(function (error) {
      var errorMsg = new IndividualModel("v-s:ErrorBundle").load();
      errorMsg.then(function (errorMsg) {
        var notify = Notify ? new Notify() : function () {};
        notify("danger", {name: errorMsg.toString()});
      });
    });
  };
  template.on("save cancel delete destroy recover", function (e) {
    e.stopPropagation();
    if (e.type === "cancel") {
      template.callModelMethod("reset");
    } else if (e.type === "destroy") {
      template.callModelMethod("remove").then(function (removed) {
        var removedAlert = new IndividualModel("v-s:RemovedAlert");
        removedAlert.load().then(function (removedAlert) {
          template.empty().append('<div class="container alert alert-danger"><strong>' + removedAlert.toString() + '</strong></div>');
        });
      });
    } else {
      template.callModelMethod(e.type);
    }
  });
  template.one("remove", function () {
    template.callModelMethod = null;
  });

  // Deleted alert
  function deletedHandler () {
    if ( this.hasValue("v-s:deleted", true) ) {
      if ( container && typeof container.prop === "function" && container.prop("id") === "main" && !template.hasClass("deleted") ) {
        var alertModel = new IndividualModel("v-s:DeletedAlert");
        var recoverModel = new IndividualModel("v-s:Recover");
        Promise.all([ alertModel.load(), recoverModel.load(), this.canUpdate() ]).then(function (arr) {
          var alert = arr[0]["rdfs:label"].join(" ");
          var recover = arr[1]["rdfs:label"].join(" ");
          var canUpdate = arr[2];
          if (canUpdate) alert = alert + '<button id="deleted-alert-recover" class="btn btn-primary btn-xs recover pull-right">' + recover + '</button>';
          var deletedAlert = $(
            '<div id="deleted-alert" class="container sheet margin-lg">\
              <div class="alert alert-warning no-margin clearfix" role="alert">\
                <p id="deleted-alert-msg">' + alert + '</p>\
              </div>\
            </div>'
          );
          $(".recover", deletedAlert).click(function () {
            template.trigger("recover");
          });
          template.prepend(deletedAlert);
        });
      }
      template.addClass("deleted");
    } else {
      template.removeClass("deleted");
      if ( container && typeof container.prop === "function" && container.prop("id") === "main" ) {
        $("#deleted-alert", template).remove();
      }
    }
  }
  individual.on("v-s:deleted", deletedHandler);
  template.one("remove", function () {
    individual.off("v-s:deleted", deletedHandler);
  });
  deletedHandler.call(individual);

  // Valid alert
  function validHandler () {
    if ( this.hasValue("v-s:valid", false) && !this.hasValue("v-s:deleted", true) && mode === "view" ) {
      if ( (container.prop("id") === "main" || container.hasClass("modal-body") ) && !template.hasClass("invalid") ) {
        new IndividualModel("v-s:InvalidAlert").load().then(function(loaded) {
          var alert = loaded["rdfs:label"].join(" ");
          var invalidAlert = $(
            '<div id="invalid-alert" class="container sheet margin-lg">\
              <div class="alert alert-danger no-margin clearfix" role="alert">\
                <p id="invalid-alert-msg">' + alert + '</p>\
              </div>\
            </div>'
          );
          template.prepend(invalidAlert);
        })
      }
      template.addClass("invalid");
    } else {
      template.removeClass("invalid");
      if ( container.prop("id") === "main" ) {
        $("#invalid-alert", template).remove();
      }
    }
  }
  individual.on("v-s:valid v-s:deleted", validHandler);
  template.one("remove", function () {
    individual.off("v-s:valid v-s:deleted", validHandler);
  });
  validHandler.call(individual);

  // Process RDFa compliant template

  // Special (not RDFa)
  template.find("[href*='@']:not([rel] *):not([about] *)").addBack("[href*='@']:not([rel] *):not([about] *)").map( function () {
    var self = $(this);
    var str = self.attr("href");
    self.attr("href", str.replace("@", individual.id));
  });

  template.find("[src*='@']:not([rel] *):not([about] *)").addBack("[src*='@']:not([rel] *):not([about] *)").map( function () {
    var self = $(this);
    var str = self.attr("src");
    self.attr("src", str.replace("@", individual.id));
  });

  template.find("[style*='@']:not([rel] *):not([about] *)").addBack("[style*='@']:not([rel] *):not([about] *)").map( function () {
    var self = $(this);
    var style = self.attr("style");
    self.attr("style", style.replace("@", individual.id));
  });

  template.find("[title]:not([rel] *):not([about] *)").addBack("[style*='@']:not([rel] *):not([about] *)").map( function () {
    var self = $(this);
    var title = self.attr("title");
    if ( (/^(\w|-)+:.*?$/).test(title) ) {
      var titleIndividual = new IndividualModel(title);
      titleIndividual.load().then(function (titleIndividual) {
        self.attr("title", titleIndividual);
      });
    }
  });

  // Property values
  var props = template.find("[property]:not(veda-control):not([rel] *):not([about] *)").addBack("[property]:not(veda-control):not([rel] *):not([about] *)").map( function () {
    var propertyContainer = $(this),
        property_uri = propertyContainer.attr("property"),
        about_uri = propertyContainer.attr("about"),
        about,
        isAbout;

    if (about_uri === "@") {
      about = individual;
      isAbout = true;
      propertyContainer.attr("about", about.id);
    } else if (!about_uri) {
      about = individual;
      isAbout = false;
    } else {
      about = new IndividualModel(about_uri);
      isAbout = true;
    }

    return about.load().then(function (about) {

      function idModifiedHandler() {
        propertyContainer.text(about.id);
      }
      if (property_uri === "@") {
        propertyContainer.text(about.id);
        about.on("idChanged", idModifiedHandler);
        template.one("remove", function () {
          about.off("idChanged", idModifiedHandler);
        });
        return;
      }

      // Re-render all property values if model's property was changed
      function propertyModifiedHandler() {
        renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);
      }
      about.on(property_uri, propertyModifiedHandler);
      template.one("remove", function () {
        about.off(property_uri, propertyModifiedHandler);
      });

      renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);
    });

  }).get();

  // Max displayed values
  template.on("click", ".more", function (e) {
    e.stopPropagation();
    var $this = $(this),
        resource_uri = $this.closest("[resource]").attr("resource"),
        resource = new IndividualModel(resource_uri),
        relContainer = $this.closest("[rel]"),
        rel_uri = relContainer.attr("rel");
    resource.trigger(rel_uri, resource.get(rel_uri), Infinity);
    $this.remove();
  });

  // Related resources & about resources
  var rels = template.find("[rel]:not(veda-control):not([rel] *):not([about] *)").addBack("[rel]:not(veda-control):not([rel] *):not([about] *)").map( function () {
    var relContainer = $(this),
        about = relContainer.attr("about"),
        rel_uri = relContainer.attr("rel"),
        isEmbedded = relContainer.attr("data-embedded") === "true",
        spec = specs[rel_uri] ? new IndividualModel( specs[rel_uri] ) : undefined,
        rel_inline_template = relContainer.html().trim(),
        rel_template_uri = relContainer.attr("data-template"),
        limit = relContainer.attr("data-limit") || Infinity,
        more = relContainer.attr("data-more") || false,
        relTemplate,
        isAbout;

    var sortableOptions = {
      delay: 150,
      placeholder: "sortable-placeholder",
      forcePlaceholderSize: true,
      handle: ".button-drag",
      cancel: "",
      update: function () {
        var uris = $(this).sortable("toArray", {attribute: "resource"});
        individual.set(
          rel_uri,
          uris.map(function (uri) {
            return new IndividualModel(uri);
          })
        );
      }
    };
    relContainer.sortable(sortableOptions);
    template.one("remove", function () {
      relContainer.sortable("destroy");
    });

    if (about) {
      isAbout = true;
      about = (about === "@" ? individual : new IndividualModel(about));
      relContainer.attr("about", about.id);
    } else {
      isAbout = false;
      about = individual;
    }

    if ( rel_template_uri ) {
      relTemplate = rel_template_uri;
    } else if ( rel_inline_template.length ) {
      relTemplate = rel_inline_template;
    }
    relContainer.empty();

    template.on("view edit search", function (e) {
      if (e.type === "view") {
        relContainer.sortable("disable");
      } else if (e.type === "edit") {
        relContainer.sortable("enable");
        var property = new IndividualModel(rel_uri);
        if ( isEmbedded
            && spec
            && spec["v-ui:minCardinality"][0] >= 1
            && !individual.hasValue(rel_uri)
            && !(property.hasValue("rdfs:range") && property["rdfs:range"][0].id === "v-s:File")
        ) {
          var valueType = spec && spec.hasValue("v-ui:rangeRestriction") ?
              spec["v-ui:rangeRestriction"] : property.hasValue("rdfs:range") ?
              property["rdfs:range"]        : [];
          var emptyValue = new IndividualModel();
          if ( valueType.length ) {
            emptyValue["rdf:type"] = valueType;
          }
          individual.set(rel_uri, [emptyValue]);
        }
      } else if (e.type === "search") {
        relContainer.sortable("enable");
      }
      e.stopPropagation();
    });

    return about.load().then(function (about) {

      var values = about.get(rel_uri);

      if (isEmbedded) {
        embeddedHandler(values);
        about.on(rel_uri, embeddedHandler);
        template.one("remove", function () {
          about.off(rel_uri, embeddedHandler);
        });
      }

      about.on(rel_uri, propertyModifiedHandler);
      template.one("remove", function () {
        about.off(rel_uri, propertyModifiedHandler);
      });

      return propertyModifiedHandler(values, limit);

      function propertyModifiedHandler (values, limit_param) {
        limit = limit_param || limit;
        relContainer.empty();
        var templatesPromises = [];
        var i = 0, value;
        while( i < limit && (value = values[i]) ) {
          templatesPromises.push( renderRelationValue(about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded, false) );
          i++;
        }
        return Promise.all(templatesPromises).then(function (renderedTemplates) {
          relContainer.append(renderedTemplates);
          if (limit < values.length && more) {
            relContainer.append( "<a class='more badge'>&darr; " + (values.length - limit) + "</a>" );
          }
        });
      }

      function embeddedHandler(values) {
        if (mode === "edit") {
          values.map(function (value) {
            if (
              value.id !== about.id // prevent self parent
              && rel_uri !== "v-s:parent" // prevent circular parent
              && !value.hasValue("v-s:parent") // do not change parent
            ) {
              value["v-s:parent"] = [about];
            }
          });
        }
      }

    });

  }).get();

  // About resource
  var abouts = template.find("[about]:not([rel] *):not([about] *):not([rel]):not([property])").addBack("[about]:not([rel] *):not([about] *):not([rel]):not([property])").map( function () {
    var aboutContainer = $(this),
        about_template_uri = aboutContainer.attr("data-template"),
        about_inline_template = aboutContainer.html().trim(),
        isEmbedded = aboutContainer.attr("data-embedded") === "true",
        about, aboutTemplate;
    if ( about_template_uri ) {
      aboutTemplate = new IndividualModel( about_template_uri );
    } else if ( about_inline_template.length ) {
      aboutTemplate = about_inline_template;
    }
    aboutContainer.empty();
    if (aboutContainer.attr("about") === "@") {
      about = individual;
      aboutContainer.attr("about", about.id);
    } else {
      about = new IndividualModel(aboutContainer.attr("about"));
    }
    return about.present(aboutContainer, aboutTemplate, isEmbedded ? mode : undefined).then(function (aboutTemplate) {
      if (isEmbedded) {
        aboutTemplate.data("isEmbedded", true);
        embedded.push(aboutTemplate);
        if (mode === "edit") {
          aboutTemplate.trigger("internal-validate");
        }
      }
    });
  }).get();

  // Validation with support of embedded templates (arbitrary depth)

  function debounce(fn, delay) {
    var timeout;
    return function () {
      var that = this;
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        fn.apply(that, args);
      }, delay);
    }
  }

  // Initial validation state
  var validation = {state: true};
  template.data("validation", validation);

  function validateTemplate (e) {
    e.stopPropagation();
    if (mode === "edit") {
      Object.keys(validation).map( function (property_uri) {
        if (property_uri === "state") { return; }
        var spec = specs[property_uri] ? new IndividualModel( specs[property_uri] ) : undefined;
        validation[property_uri] = validate(individual, property_uri, spec);
      });
      template.trigger("validate");
      validation.state = Object.keys(validation).reduce( function (acc, property_uri) {
        if (property_uri === "state") { return acc; }
        return acc && validation[property_uri].state;
      }, true);
      validation.state = validation.state && embedded.reduce(function (acc, embeddedTemplate) {
        var embeddedValidation = embeddedTemplate.data("validation");
        return embeddedValidation ? acc && embeddedValidation.state : acc;
      }, true);
      template.trigger("internal-validated", [validation]);
    }
    // "validate" event should bubble up to be handled by parent template only if current template is embedded
    if ( template.data("isEmbedded") ) {
      container.trigger("internal-validate");
    }
  }
  //template.on("internal-validate", debounce(validateTemplate, 500));
  template.on("internal-validate", validateTemplate);

  function triggerValidation() {
    if (mode === "edit") {
      template.trigger("internal-validate");
    }
  };
  individual.on("propertyModified", triggerValidation);
  template.one("remove", function () {
    individual.off("propertyModified", triggerValidation);
  });
  template.on("edit", triggerValidation);

  // Handle validation events from template
  template.on("validate", stopPropagation);
  template.on("validated", mergeValidationResult);

  function stopPropagation (e) {
    e.stopPropagation();
  }
  function mergeValidationResult (e, validationResult) {
    e.stopPropagation();
    if (mode === "edit") {
      Object.keys(validationResult).map(function (property_uri) {
        if (property_uri === "state") { return; }
        validation[property_uri] = validationResult[property_uri];
      });
      validation.state = Object.keys(validation).reduce( function (acc, property_uri) {
        if (property_uri === "state") { return acc; }
        return acc && validation[property_uri].state;
      }, true);
      template.trigger("internal-validated", [validation]);
    }
  }

  // Controls
  template.find("veda-control[property], veda-control[rel]").not("[rel] *").not("[about] *").map( function () {
    var control = $(this),
        property_uri = control.attr("property") || control.attr("rel"),
        type = control.attr("data-type") || "generic",
        spec = specs[property_uri] ? new IndividualModel( specs[property_uri] ) : undefined,
        controlType = $.fn["veda_" + type];

    //control.removeAttr("property").removeAttr("rel");

    // Initial validation state
    validation[property_uri] = {state: true, cause: []};

    function validatedHandler(e, validation) {
      if ( validation.state || !validation[property_uri] || validation[property_uri].state === true ) {
        control.removeClass("has-error");
        control.popover("destroy");
      } else {
        control.addClass("has-error");
        var explanation;
        if (validation[property_uri].message) {
          explanation = validation[property_uri].message;
        } else {
          var causesPromises = validation[property_uri].cause.map(function (cause_uri) {
            return new IndividualModel(cause_uri).load();
          });
          Promise.all(causesPromises).then(function (causes) {
            explanation = causes.map(function (cause) {
              return cause["rdfs:comment"].join(", ");
            }).join("\n");
          });
        }
        control.popover({
          content: function () {
            return explanation;
          },
          container: control,
          trigger: "hover focus",
          placement: "top",
          animation: false
        });
        if ( $("input", control).is(":focus") ) {
          control.popover("show");
        }
      }
      e.stopPropagation();
    }
    template.on("internal-validated", validatedHandler);

    template.on("view edit search", function (e) {
      e.stopPropagation();
      control.trigger(e.type);
    });

    function assignDefaultValue (e) {
      if ( spec && spec.hasValue("v-ui:defaultValue") && !individual.hasValue(property_uri) ) {
        individual.set(property_uri, spec["v-ui:defaultValue"]);
      }
      e.stopPropagation();
    }
    template.on("edit", assignDefaultValue);

    var opts = {
      individual: individual,
      property_uri: property_uri,
      spec: spec,
      mode: mode
    };

    controlType.call(control, opts);
  });

  var promises = rels.concat(abouts, props);
  return Promise.all(promises).then(function () {
    return template;
  });
}

function renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode) {
  propertyContainer.empty();
  about.get(property_uri).map( function (value) {
    var formattedValue = Util.formatValue(value);
    if (isAbout) {
      var prevValue = propertyContainer.text();
      propertyContainer.text( prevValue ? prevValue + (formattedValue ? " " + formattedValue : "") : formattedValue );
    } else {
      var valueHolder = $("<span class='value-holder'></span>");
      propertyContainer.append(valueHolder.text( Util.formatValue(value) ));
      var btnGroup = $("<div class='prop-actions btn-group btn-group-xs' role='group'></div>");
      var btnRemove = $("<button class='btn btn-default' tabindex='-1'><span class='glyphicon glyphicon-remove'></span></button>");
      btnGroup.append(btnRemove);

      template.on("view edit search", function (e) {
        if (e.type === "view") btnGroup.hide();
        else btnGroup.show();
        e.stopPropagation();
      });
      if (mode === "view") { btnGroup.hide(); }

      btnRemove.click(function () {
        about.removeValue( property_uri, value );
      }).mouseenter(function () {
        valueHolder.addClass("red-outline");
      }).mouseleave(function () {
        valueHolder.removeClass("red-outline");
      });
      valueHolder.append( btnGroup );
    }
  });
}

function renderRelationValue(about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded, toAppend) {
  return value.present(relContainer, relTemplate, isEmbedded ? mode : undefined, undefined, toAppend).then(function (valTemplate) {
    if (isEmbedded) {
      valTemplate.data("isEmbedded", true);
      embedded.push(valTemplate);
      if (mode === "edit") {
        valTemplate.trigger("internal-validate");
      }
      valTemplate.one("remove", function () {
        if (embedded.length) {
          var index = embedded.indexOf(valTemplate);
          if ( index >= 0 ) embedded.splice(index, 1);
        }
      });
    }
    if (!isAbout) {
      var btnGroup = $("<div class='rel-actions btn-group btn-group-xs -view edit search' role='group'></div>");
      var btnDrag = $("<button class='btn btn-default button-drag' tabindex='-1'><span class='glyphicon glyphicon-move'></span></button>");
      var btnRemove = $("<button class='btn btn-default button-delete' tabindex='-1'><span class='glyphicon glyphicon-remove'></span></button>");
      btnGroup.append(btnDrag, btnRemove);
      template.on("view edit search", function (e) {
        if (e.type === "view") btnGroup.hide();
        else btnGroup.show();
        e.stopPropagation();
      });
      if (mode === "view") { btnGroup.hide(); }

      btnRemove.click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        valTemplate.remove();
        about.removeValue( rel_uri, value );
        if ( value.is("v-s:Embedded") && value.hasValue("v-s:parent", about) ) {
          value.delete();
        }
      }).mouseenter(function () {
        valTemplate.addClass("red-outline");
      }).mouseleave(function () {
        valTemplate.removeClass("red-outline");
      });

      //Sortable scroll bugfix
      btnDrag.mouseenter(function () {
        valTemplate.addClass("gray-outline");
      }).mouseleave(function () {
        valTemplate.removeClass("gray-outline");
      }).mousedown(function () {
        relContainer.addClass("sortable-overflow");
      }).mouseup(function () {
        relContainer.removeClass("sortable-overflow");
      });

      if (valTemplate.css("display") !== "inline") {
        btnGroup.addClass("block");
      }
      if (valTemplate.css("display") === "table-row" || valTemplate.prop("tagName") === "TR") {
        var cell = valTemplate.children().last();
        cell.css("position", "relative").append(btnGroup);
      } else {
        valTemplate.css("position", "relative");
        valTemplate.append(btnGroup);
      }
    }
    return valTemplate;
  });
}

// Property validation according to specification
function validate(individual, property_uri, spec) {
  var result = {
    state: true,
    cause: []
  };
  if (!spec) { return result; }
  var values = individual.get(property_uri);
  // cardinality check
  if (spec.hasValue("v-ui:minCardinality")) {
    var minCardinalityState = (values.length >= spec["v-ui:minCardinality"][0] &&
    // filter empty values
    values.length === values.filter(function(item) {
      return (
        typeof item === "boolean" ? true :
        typeof item === "number" ? true : !!item
      ) ;
    }).length);
    result.state = result.state && minCardinalityState;
    if (!minCardinalityState) {
      result.cause.push("v-ui:minCardinality");
    }
  }
  if (spec.hasValue("v-ui:maxCardinality")) {
    var maxCardinalityState = (
      values.length <= spec["v-ui:maxCardinality"][0] &&
      // filter empty values
      values.length === values.filter(function(item) {
        return (
          typeof item === "boolean" ? true :
          typeof item === "number" ? true : !!item
        ) ;
      }).length
    );
    result.state = result.state && maxCardinalityState;
    if (!maxCardinalityState) {
      result.cause.push("v-ui:maxCardinality");
    }
  }
  // check each value
  result = result && values.reduce(function (result, value) {
    // regexp check
    if (spec.hasValue("v-ui:regexp")) {
      var regexp = new RegExp(spec["v-ui:regexp"][0]);
      var regexpState = regexp.test(value.toString());
      result.state = result.state && regexpState;
      if (!regexpState) {
        result.cause.push("v-ui:regexp");
      }
    }
    // range check
    switch (spec["rdf:type"][0].id) {
      case "v-ui:DatatypePropertySpecification" :
        if (spec.hasValue("v-ui:minValue")) {
          var minValueState = (value >= spec["v-ui:minValue"][0]);
          result.state = result.state && minValueState;
          if (!minValueState) {
            result.cause.push("v-ui:minValue");
          }
        }
        if (spec.hasValue("v-ui:maxValue")) {
          var maxValueState = (value <= spec["v-ui:maxValue"][0]);
          result.state = result.state && maxValueState;
          if (!maxValueState) {
            result.cause.push("v-ui:maxValue");
          }
        }
        if (spec.hasValue("v-ui:minLength")) {
          var minLengthState = (value.toString().length >= spec["v-ui:minLength"][0]);
          result.state = result.state && minLengthState;
          if (!minLengthState) {
            result.cause.push("v-ui:minLength");
          }
        }
        if (spec.hasValue("v-ui:maxLength")) {
          var maxLengthState = (value.toString().length <= spec["v-ui:maxLength"][0]);
          result.state = result.state && maxLengthState;
          if (!maxLengthState) {
            result.cause.push("v-ui:maxLength");
          }
        }
        break;
      case "v-ui:ObjectPropertySpecification" :
        break;
    }
    return result;
  }, result);
  return result;
}
