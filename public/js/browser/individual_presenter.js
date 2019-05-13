// Individual Presenter

veda.Module(function (veda) { "use strict";

  veda.IndividualModel.prototype.present = function (container, template, mode, extra) {

    try {

      // Defaults
      container = container || "#main";
      mode = mode || "view";

      if (typeof container === "string") {
        container = $(container).empty();
      }

      //if (container.prop("id") === "main") { container.hide(); }

      template = present(this, container, template, mode, extra);

      //if (container.prop("id") === "main") { container.show("fade", 250); }

    } catch (err) {
      console.log(err);
    }

    return template;
  };

  function present(individual, container, template, mode, extra) {

    var ontology = new veda.OntologyModel();

    var specs = individual["rdf:type"].reduce( function (acc, _class) {
      var _classSpecs = ontology.getClassSpecifications(_class.id);
      Object.keys(_classSpecs).forEach(function (property_uri) {
        acc[property_uri] = _classSpecs[property_uri];
      });
      return acc;
    }, {});

    if (template) {
      if (typeof template === "string" && (/^(\w|-)+:.*?$/).test(template) ) {
        template = new veda.IndividualModel(template);
      } else if (typeof template === "string") {
        var templateString = template;
        var uri = veda.Util.simpleHash(templateString).toString();
        template = veda.cache.get(uri) ? veda.cache.get(uri) : new veda.IndividualModel({
          "@": uri,
          "v-ui:template": [{data: templateString, type: "String"}]
        });
      } else if (template instanceof HTMLElement) {
        var templateString = template.outerHTML;
        var uri = veda.Util.simpleHash(templateString).toString();
        template = veda.cache.get(uri) ? veda.cache.get(uri) : new veda.IndividualModel({
          "@": uri,
          "v-ui:template": [{data: templateString, type: "String"}]
        });
      }
      return renderTemplate(individual, container, template, mode, extra, specs);
    } else {
      var isClass = individual.hasValue("rdf:type", "owl:Class") || individual.hasValue("rdf:type", "rdfs:Class");
      if ( individual.hasValue("v-ui:hasTemplate") && !isClass ) {
        template = individual["v-ui:hasTemplate"][0];
        return renderTemplate(individual, container, template, mode, extra, specs);
      } else {
        return individual["rdf:type"].reduce(function (acc, type) {
          if ( type.hasValue("v-ui:hasTemplate") ) {
            template = type["v-ui:hasTemplate"][0];
          } else {
            template = new veda.IndividualModel("v-ui:generic");
          }
          var renderedTemplate = renderTemplate(individual, container, template, mode, extra, specs);
          return acc.add(renderedTemplate);
        }, $());
      }
    }
  }

  function renderTemplate(individual, container, template, mode, extra, specs) {

    var templateString, preScript, postScript;

    if ( template.preprocessed ) {
      preScript = template.preScript;
      templateString = template.templateString;
      postScript = template.postScript;
    } else {
      templateString = template["v-ui:template"][0].toString().trim();
      var match,
          preScript_src,
          preScript,
          postScript_src,
          postScript;

      // Extract pre script, template and post script
      // match = template.match(/^(?:<script[^>]*>([\s\S]*?)<\/script>)?([\s\S]*?)(?:<script[^>]*>(?![\s\S]*<script[^>]*>)([\s\S]*)<\/script>)?$/i);
      match = preProcess(templateString);
      preScript_src = match[1];
      templateString = match[2];
      postScript_src = match[3];

      if (preScript_src) {
        preScript = new Function("veda", "individual", "container", "template", "mode", "extra", "\"use strict\";" + preScript_src);
        template.preScript = preScript;
      }

      template.templateString = templateString;

      if (postScript_src) {
        postScript = new Function("veda", "individual", "container", "template", "mode", "extra", "\"use strict\";" + postScript_src);
        template.postScript = postScript;
      }

      template.preprocessed = true;
    }

    var renderedTemplate = $(templateString);

    if (preScript) {
      preScript.call(individual, veda, individual, container, renderedTemplate, mode, extra);
    }

    renderedTemplate = processTemplate (individual, container, renderedTemplate, mode, extra, specs);
    container.append(renderedTemplate);

    // Timeout to wait all related individuals to render
    setTimeout(function () {
      renderedTemplate.trigger(mode);
      if (postScript) {
        postScript.call(individual, veda, individual, container, renderedTemplate, mode, extra);
      }
    }, 0);

    // Watch individual updates on server
    var updateService = new veda.UpdateService();
    updateService.subscribe(individual.id);
    renderedTemplate.one("remove", function () {
      updateService.unsubscribe(individual.id);
    });

    return renderedTemplate;
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

  function processTemplate (individual, container, template, mode, extra, specs) {

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
      mode = e.type;
      template.data("mode", mode);
      switch (mode) {
        case "view": view.show(); _view.hide(); break;
        case "edit": edit.show(); _edit.hide(); break;
        case "search": search.show(); _search.hide(); break;
      }
      e.stopPropagation();
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
    template.on("view edit search save cancel delete recover draft destroy", syncEmbedded);

    // Define handlers
    function saveHandler (e, parent) {
      if (parent !== individual.id && !individual.isSync()) {
        individual.save();
        if (parent) {
          container.trigger("embeddedSaved", individual.id);
        }
      }
      template.trigger("view");
      e.stopPropagation();
    }
    template.on("save", saveHandler);

    var saveTimeout;
    function embeddedSavedHandler (e, childId) {
      if ( individual.isSync() && individual.hasValue(undefined, childId) && !saveTimeout) {
        saveTimeout = setTimeout(function () {
          individual.isSync(false);
          individual.save();
          container.trigger("embeddedSaved", individual.id);
          saveTimeout = undefined;
        });
      }
      e.stopPropagation();
    }
    template.on("embeddedSaved", embeddedSavedHandler);

    function draftHandler (e, parent) {
      if (parent !== individual.id) {
        individual.draft();
      }
      template.trigger("view");
      e.stopPropagation();
    }
    template.on("draft", draftHandler);

    function cancelHandler (e, parent) {
      if (parent !== individual.id) {
        individual.reset()
          .then(function () {
            template.trigger("view");
          })
          .catch(function () {
            template.trigger("view");
          });
      }
      e.stopPropagation();
    }
    template.on("cancel", cancelHandler);

    // Deleted alert
    function deletedHandler () {
      if ( this.hasValue("v-s:deleted", true) ) {
        if ( container.prop("id") === "main" && !template.hasClass("deleted") ) {
          var alert = new veda.IndividualModel("v-s:DeletedAlert")["rdfs:label"].join(" ");
          var recover = new veda.IndividualModel("v-s:Recover")["rdfs:label"].join(" ");
          var deletedAlert = $(
            '<div id="deleted-alert" class="container sheet margin-lg">\
              <div class="alert alert-warning no-margin clearfix" role="alert">\
                <p id="deleted-alert-msg">' + alert + '  <button id="deleted-alert-recover" class="btn btn-primary btn-xs recover pull-right">' + recover + '</button></p>\
              </div>\
            </div>'
          );
          template.prepend(deletedAlert);
          $(".recover", deletedAlert).click(function () {
            template.trigger("recover");
          });
        }
        template.addClass("deleted");
      } else {
        template.removeClass("deleted");
        if ( container.prop("id") === "main" ) {
          $("#deleted-alert", template).remove();
        }
      }
    }
    individual.on("v-s:deleted", deletedHandler);
    template.one("remove", function () {
      individual.off("v-s:deleted", deletedHandler);
    });
    deletedHandler.call(individual);

    function deleteHandler (e, parent) {
      if (parent !== individual.id) {
        individual.delete();
      }
      e.stopPropagation();
    }
    template.on("delete", deleteHandler);

    function destroyHandler (e, parent) {
      if (parent !== individual.id) {
        try {
          individual.remove();
          var notify = veda.Notify ? new veda.Notify() : function () {};
          notify("success", {name: "Success", message: "Object removed"});
        } catch (error) {
          var notify = veda.Notify ? new veda.Notify() : function () {};
          notify("danger", {message: error});
        }
      }
      e.stopPropagation();
    }
    template.on("destroy", destroyHandler);

    function recoverHandler (e, parent) {
      if (parent !== individual.id) {
        individual.recover();
      }
      e.stopPropagation();
    }
    template.on("recover", recoverHandler);

    function validHandler () {
      if ( this.hasValue("v-s:valid", false) && mode === "view" ) {
        if ( container.prop("id") === "main" && !template.hasClass("invalid") ) {
          var alert = new veda.IndividualModel("v-s:InvalidAlert")["rdfs:label"].join(" ");
          var invalidAlert = $(
            '<div id="invalid-alert" class="container sheet margin-lg">\
              <div class="alert alert-warning no-margin clearfix" role="alert">\
                <p id="invalid-alert-msg">' + alert + '</p>\
              </div>\
            </div>'
          );
          template.prepend(invalidAlert);
        }
        template.addClass("invalid");
      } else {
        template.removeClass("invalid");
        if ( container.prop("id") === "main" ) {
          $("#invalid-alert", template).remove();
        }
      }
    }
    individual.on("v-s:valid", validHandler);
    template.one("remove", function () {
      individual.off("v-s:valid", validHandler);
    });
    validHandler.call(individual);
    
    // Draft label
    var draftable, showLabel;

    function isDraftHandler() {
      if ( mode === "edit" && draftable && !individual.isSync() ) {
        individual.draft();
      }
      // If individual is draft
      if ( individual.isDraft() && showLabel ) {
        if ( template.children(".sheet").length ) {
          template.children(".sheet").addClass("is-draft");
        } else {
          template.addClass("is-draft");
        }
      } else {
        if ( template.children(".sheet").length ) {
          template.children(".sheet").removeClass("is-draft");
        } else {
          template.removeClass("is-draft");
        }
      }
    }
    individual.on("propertyModified afterSave afterReset", isDraftHandler);
    template.one("remove", function () {
      individual.off("propertyModified", isDraftHandler);
      individual.off("afterSave", isDraftHandler);
      individual.off("afterReset", isDraftHandler);
    });

    setTimeout( function () {
      draftable = individual.is("v-s:UserThing");
      if (draftable) {
        showLabel = !template.parent().closest("[resource='" + individual.id + "']").length;
        if (showLabel) {
          isDraftHandler();
        }
      }
    }, 100);

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

    // Fetch related individuals all together
    var prefetch_args = [1];

    // Related resources
    var rels = template.find("[rel]:not(veda-control):not([rel] *):not([about] *)").addBack("[rel]:not(veda-control):not([rel] *):not([about] *)");
    rels.map( function () {
      var rel_uri = $(this).attr("rel");
      if ( individual.hasValue(rel_uri) ) {
        prefetch_args.push(rel_uri);
      }
    });
    if (prefetch_args.length > 1) {
      individual.prefetch.apply(individual, prefetch_args);
    }

    // Fetch about resources alltogether
    var abouts = [];
    template.find("[about]").addBack("[about]").map( function () {
      var about_uri = $(this).attr("about");
      if (about_uri !== "@" && !veda.cache.get(about_uri) ) {
        abouts.push(about_uri);
      }
    });
    if (abouts.length) {
      get_individuals(veda.ticket, veda.Util.unique(abouts) ).map(function (item) {
        var about = new veda.IndividualModel(item);
      });
    }

    // Property value
    template.find("[property]:not(veda-control):not([rel] *):not([about] *)").addBack("[property]:not(veda-control):not([rel] *):not([about] *)").map( function () {
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
        about = new veda.IndividualModel(about_uri);
        isAbout = true;
      }

      function idModifiedHandler() {
        propertyContainer.text(individual.id);
      }
      if (property_uri === "@") {
        propertyContainer.text(about.id);
        about.on("idChanged", idModifiedHandler);
        template.one("remove", function () {
          about.off("idChanged", idModifiedHandler);
        });
        return;
      }
      renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);

      // Re-render all property values if model's property was changed
      function propertyModifiedHandler() {
        renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);
      }
      about.on(property_uri, propertyModifiedHandler);
      template.one("remove", function () {
        about.off(property_uri, propertyModifiedHandler);
      });

      if ( about !== individual ) {
        // Watch server-side updates
        var updateService = new veda.UpdateService();
        updateService.subscribe(about.id);
        template.one("remove", function () {
          updateService.unsubscribe(about.id);
        });
      }
    });

    // Max displayed values
    template.on("click", ".more", function (e) {
      e.stopPropagation();
      var $this = $(this),
          resource_uri = $this.closest("[resource]").attr("resource"),
          resource = new veda.IndividualModel(resource_uri),
          relContainer = $this.closest("[rel]"),
          rel_uri = relContainer.attr("rel");
      resource.trigger(rel_uri, resource.get(rel_uri), Infinity);
      $this.remove();
    });

    // Related resources & about resources
    rels.map( function () {
      var relContainer = $(this),
          about = relContainer.attr("about"),
          rel_uri = relContainer.attr("rel"),
          isEmbedded = relContainer.attr("data-embedded") === "true",
          spec = specs[rel_uri] ? new veda.IndividualModel( specs[rel_uri] ) : undefined,
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
              return new veda.IndividualModel(uri);
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
        about = (about === "@" ? individual : new veda.IndividualModel(about));
        relContainer.attr("about", about.id);
      } else {
        isAbout = false;
        about = individual;
      }

      if ( rel_template_uri ) {
        relTemplate = new veda.IndividualModel( rel_template_uri );
      } else if ( rel_inline_template.length ) {
        relTemplate = rel_inline_template;
      }
      relContainer.empty();

      template.on("view edit search", function (e) {
        if (e.type === "view") {
          relContainer.sortable("disable");
        } else if (e.type === "edit") {
          relContainer.sortable("enable");
          var property = new veda.IndividualModel(rel_uri);
          if ( isEmbedded
              && spec
              && spec["v-ui:minCardinality"][0] >= 1
              && !individual.hasValue(rel_uri)
              && !(property.hasValue("rdfs:range") && property["rdfs:range"][0].id === "v-s:File")
          ) {
            var valueType = spec && spec.hasValue("v-ui:rangeRestriction") ?
                spec["v-ui:rangeRestriction"] : property.hasValue("rdfs:range") ?
                property["rdfs:range"]        : [];
            var emptyValue = new veda.IndividualModel();
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

      var values = about.get(rel_uri);

      if (isEmbedded) {
        embeddedHandler(values);
        about.on(rel_uri, embeddedHandler);
        template.one("remove", function () {
          about.off(rel_uri, embeddedHandler);
        });
      }

      propertyModifiedHandler(values, limit);
      about.on(rel_uri, propertyModifiedHandler);
      template.one("remove", function () {
        about.off(rel_uri, propertyModifiedHandler);
      });

      // Re-render link property if its' values were changed
      function propertyModifiedHandler (values, limit_param) {
        limit = limit_param || limit;
        var appended = $();
        for (var i = 0, value, renderedRelation; i < limit && (value = values[i]); i++) {
          renderedRelation = relContainer.children("[resource='" + veda.Util.escape4$( value.id ) + "']");
          if ( !renderedRelation.length ) {
            renderedRelation = renderRelationValue(about, rel_uri, value, relContainer, relTemplate, isEmbedded, embedded, isAbout, template, mode);
          }
          appended = appended.add(renderedRelation);
        }
        relContainer.children().not(appended).remove();
        if (limit < values.length && more) {
          relContainer.append( "<a class='more badge'>&darr; " + (values.length - limit) + "</a>" );
        }
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

    // About resource
    template.find("[about]:not([rel] *):not([about] *):not([rel]):not([property])").addBack("[about]:not([rel] *):not([about] *):not([rel]):not([property])").map( function () {
      var aboutContainer = $(this),
          about_template_uri = aboutContainer.attr("data-template"),
          about_inline_template = aboutContainer.html().trim(),
          isEmbedded = aboutContainer.attr("data-embedded") === "true",
          about, aboutTemplate;
      if ( about_template_uri ) {
        aboutTemplate = new veda.IndividualModel( about_template_uri );
      } else if ( about_inline_template.length ) {
        aboutTemplate = about_inline_template;
      }
      aboutContainer.empty();
      if (aboutContainer.attr("about") === "@") {
        about = individual;
        aboutContainer.attr("about", about.id);
      } else {
        about = new veda.IndividualModel(aboutContainer.attr("about"));
      }
      aboutTemplate = about.present(aboutContainer, aboutTemplate, isEmbedded ? mode : "view");
      if (isEmbedded) {
        aboutTemplate.data("isEmbedded", true);
        embedded.push(aboutTemplate);
      }
    });

    // Validation with support of embedded templates (arbitrary depth)

    // Initial validation state
    var validation = {state: true};
    template.data("validation", validation);

    function validateTemplate (e) {
      if ( Object.keys(validation).length === 0) {
        if ( !template.data("isEmbedded") ) {
          e.stopPropagation();
        }
        return;
      }
      if (mode === "edit") {
        Object.keys(validation).map( function (property_uri) {
          if (property_uri === "state") { return; }
          var spec = specs[property_uri] ? new veda.IndividualModel( specs[property_uri] ) : undefined;
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
      if ( !template.data("isEmbedded") ) {
        e.stopPropagation();
      }
    }
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
        // Merge template validation results with internal validation results
        Object.keys(validationResult).map(function (property_uri) {
          if (property_uri === "state") { return; }
          validation[property_uri] = validationResult[property_uri];
        });
        validation.state = validation.state && validationResult.state;
      }
    }

    // Property control
    template.find("veda-control[property]:not([rel] *):not([about] *)").addBack("veda-control[property]:not([rel] *):not([about] *)").map( function () {

      var control = $(this),
          property_uri = control.attr("property"),
          type = control.attr("data-type") || "generic",
          spec = specs[property_uri] ? new veda.IndividualModel( specs[property_uri] ) : undefined,
          controlType = $.fn["veda_" + type];

      //control.removeAttr("property");

      // Initial validation state
      validation[property_uri] = {state: true, cause: []};

      function validatedHandler(e, validation) {
        if ( validation.state || !validation[property_uri] || validation[property_uri].state === true ) {
          control.removeClass("has-error");
          control.popover("destroy");
        } else {
          control.addClass("has-error");
          control.popover({
            content: function () {
              return validation[property_uri].cause.map(function (cause_uri) {
                return (new veda.IndividualModel(cause_uri))["rdfs:comment"].join(", ");
              }).join("\n");
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

    // Relation control
    template.find("veda-control[rel]:not([rel] *):not([about] *)").addBack("veda-control[rel]:not([rel] *):not([about] *)").map( function () {

      var control = $(this),
          rel_uri = control.attr("rel"),
          spec = specs[rel_uri] ? new veda.IndividualModel( specs[rel_uri] ) : undefined,
          type = control.attr("data-type") || "link",
          controlType = $.fn["veda_" + type];

      //control.removeAttr("rel");

      // Initial validation state
      validation[rel_uri] = {state: true, cause: []};

      function validatedHandler(e, validation) {
        if ( validation.state || !validation[rel_uri] || validation[rel_uri].state === true) {
          control.removeClass("has-error");
          control.popover("destroy");
        } else {
          control.addClass("has-error");
          control.popover({
            content: function () {
              return validation[rel_uri].cause.map(function (cause_uri) {
                return (new veda.IndividualModel(cause_uri))["rdfs:comment"].join(", ");
              }).join("\n");
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
        if ( spec && spec.hasValue("v-ui:defaultValue") && !individual.hasValue(rel_uri) ) {
          individual.set(rel_uri, spec["v-ui:defaultValue"]);
        }
        e.stopPropagation();
      }
      template.on("edit", assignDefaultValue);

      var opts = {
        individual: individual,
        rel_uri: rel_uri,
        spec: spec,
        mode: mode
      };
      controlType.call(control, opts);

    });

    return template;
  }

  function renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode) {
    propertyContainer.empty();
    about.get(property_uri).map( function (value, i) {
      if (isAbout) {
        propertyContainer.append( veda.Util.formatValue(value) + " " );
      } else {
        var valueHolder = $("<span class='value-holder'></span>");
        propertyContainer.append(valueHolder.text( veda.Util.formatValue(value) ));
        var btnGroup = $("<div class='prop-actions btn-group btn-group-xs' role='group'></div>");
        var btnRemove = $("<button class='btn btn-default'><span class='glyphicon glyphicon-remove'></span></button>");
        btnGroup.append(btnRemove);

        template.on("view edit search", function (e) {
          if (e.type === "view") btnGroup.hide();
          else btnGroup.show();
          e.stopPropagation();
        });
        if (mode === "view") { btnGroup.hide(); }

        btnRemove.click(function () {
          about.set( property_uri, about.get(property_uri).filter(function (_, j) {return j !== i; }) );
        }).mouseenter(function () {
          valueHolder.addClass("red-outline");
        }).mouseleave(function () {
          valueHolder.removeClass("red-outline");
        });
        valueHolder.append( btnGroup );
      }
    });
  }

  function renderRelationValue(individual, rel_uri, value, relContainer, relTemplate, isEmbedded, embedded, isAbout, template, mode) {
    var valTemplate = value.present(relContainer, relTemplate, isEmbedded ? mode : "view");
    if (isEmbedded) {
      valTemplate.data("isEmbedded", true);
      embedded.push(valTemplate);
      valTemplate.one("remove", function () {
        if (embedded.length) {
          var index = embedded.indexOf(valTemplate);
          if ( index >= 0 ) embedded.splice(index, 1);
        }
      });
    }
    if (!isAbout) {
      var btnGroup = $("<div class='rel-actions btn-group btn-group-xs -view edit search' role='group'></div>");
      var btnDrag = $("<button class='btn btn-default button-drag'><span class='glyphicon glyphicon-move'></span></button>");
      var btnRemove = $("<button class='btn btn-default button-delete'><span class='glyphicon glyphicon-remove'></span></button>");
      btnGroup.append(btnDrag, btnRemove);
      template.on("view edit search", function (e) {
        if (e.type === "view") btnGroup.hide();
        else btnGroup.show();
        e.stopPropagation();
      });
      if (mode === "view") { btnGroup.hide(); }

      btnRemove.click(function (e) {
        e.preventDefault();
        valTemplate.remove();
        individual.set( rel_uri, individual.get(rel_uri).filter(function (item) { return item.id !== value.id; }) );
        if ( value.is("v-s:Embedded") && value.hasValue("v-s:parent", individual) ) {
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

});
