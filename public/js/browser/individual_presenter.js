// Individual Presenter

veda.Module(function (veda) { "use strict";

  veda.IndividualModel.prototype.present = function (container, template, mode, extra) {

    mode = mode || "view";

    var toEmpty;

    if (typeof container === "string") {
      container = $(container);
      toEmpty = true;
    }

    return this.load().then(function (individual) {

      if (template) {
        if (template instanceof veda.IndividualModel) {
        // if template is uri
        } else if (typeof template === "string" && (/^(\w|-)+:.*?$/).test(template) ) {
          template = new veda.IndividualModel(template);
        } else {
          if (typeof template === "string") {
            var templateString = template;
          } else if (template instanceof HTMLElement) {
            var templateString = template.outerHTML;
          }
          var uri = veda.Util.simpleHash(templateString).toString();
          template = veda.cache.get(uri) ? veda.cache.get(uri) : new veda.IndividualModel({
            "@": uri,
            "v-ui:template": [{data: templateString, type: "String"}]
          }, 1);
        }
        return template.load().then(function (template) {
          template = template["v-ui:template"][0].toString();
          return renderTemplate(individual, container, template, mode, extra, toEmpty);
        });
      } else {
        var isClass = individual.hasValue("rdf:type", "owl:Class") || individual.hasValue("rdf:type", "rdfs:Class");
        if ( individual.hasValue("v-ui:hasTemplate") && !isClass ) {
          template = individual["v-ui:hasTemplate"][0];
          return template.load().then(function (template) {
            template = template["v-ui:template"][0].toString();
            return renderTemplate(individual, container, template, mode, extra, toEmpty);
          });
        } else {
          var typePromises = individual["rdf:type"].map(function (type) {
            return type.load();
          });
          return Promise.all(typePromises).then(function (types) {
            var templatesPromises = types.map( function (type) {
              return type.hasValue("v-ui:hasTemplate") ? type["v-ui:hasTemplate"][0].load() : new veda.IndividualModel("v-ui:generic").load();
            });
            return Promise.all(templatesPromises);
          }).then(function (templates) {
            var renderedTemplatesPromises = templates.map( function (template) {
              template = template["v-ui:template"][0].toString();
              return renderTemplate(individual, container, template, mode, extra, toEmpty);
            });
            return Promise.all(renderedTemplatesPromises);
          }).then(function (renderedTemplates) {
            return renderedTemplates.reduce(function (acc, renderedTemplate) {
              return acc.add(renderedTemplate);
            }, $());
          });
        }
      }
    })
    .catch(function (error) {
      console.log("Presenter error", error);
    });
  }

  function renderTemplate(individual, container, template, mode, extra, toEmpty) {
    var match,
        pre_render_src,
        pre_render,
        pre_result,
        post_render_src,
        post_render;

    template = template.trim();

    // Extract pre script, template and post script
    match = template.match(/^(?:<script[^>]*>([\s\S]*?)<\/script>)?([\s\S]*?)(?:<script[^>]*>(?![\s\S]*<script[^>]*>)([\s\S]*)<\/script>)?$/i);
    //match = preProcess(template);
    pre_render_src = match[1];
    template = $( match[2] );
    post_render_src = match[3];

    if (pre_render_src) {
      pre_render = new Function("veda", "individual", "container", "template", "mode", "extra", "\"use strict\";" + pre_render_src);
    }
    if (post_render_src) {
      post_render = new Function("veda", "individual", "container", "template", "mode", "extra", "\"use strict\";" + post_render_src);
    }
    if (pre_render) {
      pre_result = pre_render.call(individual, veda, individual, container, template, mode, extra);
    }
    return (pre_result instanceof Promise ? pre_result : Promise.resolve(pre_result)).then(function () {

      return processTemplate(individual, container, template, mode).then(function (processedTemplate) {

        processedTemplate.trigger(mode);

        if (toEmpty) {
          container.empty();
        }
        container.append(processedTemplate);

        if (post_render) {
          post_render.call(individual, veda, individual, container, processedTemplate, mode, extra);
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
    var ontology = new veda.OntologyModel();
    var specs = $.extend.apply (
      {}, [].concat(
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
    template.on("view edit search save cancel delete recover destroy", syncEmbedded);

    // Define handlers

    var notify = veda.Notify ? new veda.Notify() : function () {};

    function saveHandler (e, parent) {
      if (parent !== individual.id && !individual.isSync()) {
        individual.save().then(function () {
          if (parent) {
            container.trigger("embeddedSaved", individual.id);
          } else {
            var saveSuccess = new veda.IndividualModel("v-s:SaveSuccess");
            saveSuccess.load().then(function (saveSuccess) {
              notify("success", {name: saveSuccess});
            });
          }
        }).catch(function (error) {
          var saveError = new veda.IndividualModel("v-s:SaveError");
          saveError.load().then(function (saveError) {
            notify("danger", {name: saveError});
          });
        });
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
          individual.save().then(function (individual) {
            container.trigger("embeddedSaved", individual.id);
          });
          saveTimeout = undefined;
        });
      }
      e.stopPropagation();
    }
    template.on("embeddedSaved", embeddedSavedHandler);

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
        if ( container && typeof container.prop === "function" && container.prop("id") === "main" && !template.hasClass("deleted") ) {
          var alertModel = new veda.IndividualModel("v-s:DeletedAlert");
          var recoverModel = new veda.IndividualModel("v-s:Recover");
          Promise.all([ alertModel.load(), recoverModel.load() ]).then(function (arr) {
            var alert = arr[0]["rdfs:label"].join(" ");
            var recover = arr[1]["rdfs:label"].join(" ");
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

    function deleteHandler (e, parent) {
      if (parent !== individual.id) {
        individual.delete().then(function () {
          notify("success", {name: "Объект удален"});
        }).catch(function (error) {
          notify("danger", {name: "Объект не удален"});
        });
      }
      template.trigger("view");
      e.stopPropagation();
    }
    template.on("delete", deleteHandler);

    function destroyHandler (e, parent) {
      if (parent !== individual.id) {
        individual.remove().then(function () {
          notify("success", {name: "Объект уничтожен"});
        }).catch(function (error) {
          notify("danger", {name: "Объект не уничтожен"});
        });
      }
      template.trigger("view");
      e.stopPropagation();
    }
    template.on("destroy", destroyHandler);

    function recoverHandler (e, parent) {
      if (parent !== individual.id) {
        individual.recover().then(function () {
          notify("success", {name: "Объект восстановлен"});
        }).catch(function (error) {
          notify("danger", {name: "Объект не восстановлен"});
        });
      }
      template.trigger("view");
      e.stopPropagation();
    }
    template.on("recover", recoverHandler);

    // Valid alert
    function validHandler () {
      if ( this.hasValue("v-s:valid", false) && !this.hasValue("v-s:deleted", true) && mode === "view" ) {
        if ( (container.prop("id") === "main" || container.hasClass("modal-body") ) && !template.hasClass("invalid") ) {
          var alert = new veda.IndividualModel("v-s:InvalidAlert")["rdfs:label"].join(" ");
          var invalidAlert = $(
            '<div id="invalid-alert" class="container sheet margin-lg">\
              <div class="alert alert-danger no-margin clearfix" role="alert">\
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
        var titleIndividual = new veda.IndividualModel(title);
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
        about = new veda.IndividualModel(about_uri);
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
          resource = new veda.IndividualModel(resource_uri),
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
          for (var i = 0, value; i < limit && (value = values[i]); i++) {
            templatesPromises.push( renderRelationValue(about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded) );
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
      return about.present(aboutContainer, aboutTemplate, isEmbedded ? mode : undefined).then(function (aboutTemplate) {
        if (isEmbedded) {
          aboutTemplate.data("isEmbedded", true);
          embedded.push(aboutTemplate);
        }
      });
    }).get();

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
        validationResult.state = Object.keys(validationResult).reduce( function (acc, property_uri) {
          if (property_uri === "state") { return acc; }
          return acc && validationResult[property_uri].state;
        }, true);
        Object.keys(validationResult).map(function (property_uri) {
          if (property_uri === "state") { return; }
          validation[property_uri] = validationResult[property_uri];
        });
        validation.state = validation.state && validationResult.state;
        template.trigger("internal-validated", [validation]);
      }
    }

    // Controls
    template.find("veda-control[property], veda-control[rel]").not("[rel] *").not("[about] *").map( function () {
      var control = $(this),
          property_uri = control.attr("property") || control.attr("rel"),
          type = control.attr("data-type") || "generic",
          spec = specs[property_uri] ? new veda.IndividualModel( specs[property_uri] ) : undefined,
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
          var causesPromises = validation[property_uri].cause.map(function (cause_uri) {
            return new veda.IndividualModel(cause_uri).load();
          });
          Promise.all(causesPromises).then(function (causes) {
            explanation = causes.map(function (cause) {
              return cause["rdfs:comment"].join(", ");
            }).join("\n");
          });
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
    about.get(property_uri).map( function (value, i) {
      var formattedValue = veda.Util.formatValue(value);
      if (isAbout) {
        var prevValue = propertyContainer.text();
        propertyContainer.text( prevValue ? prevValue + " " + formattedValue : formattedValue );
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

  function renderRelationValue(about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded) {
    return value.present(relContainer, relTemplate, isEmbedded ? mode : undefined).then(function (valTemplate) {
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
          about.set( rel_uri, about.get(rel_uri).filter(function (item) { return item.id !== value.id; }) );
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

});
