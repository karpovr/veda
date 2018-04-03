// Veda controls implemented as JQuery plugins
"use strict";
;(function( $ ) {

  var defaultDelay = 750;

  // INPUT CONTROLS

  // Generic literal input behaviour
  var veda_literal_input = function( options ) {
    var opts = $.extend( {}, veda_literal_input.defaults, options ),
      control = $(opts.template),
      input = $(".form-control", control),
      spec = opts.spec,
      placeholder = spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].join(" ") : "",
      property_uri = opts.property_uri,
      individual = opts.individual,
      timeout;

    control.isSingle = typeof opts.isSingle !== "undefined" ? opts.isSingle : (spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true);

    input
      .attr({
        "placeholder": placeholder,
        "name": (individual.hasValue("rdf:type") ? individual["rdf:type"].pop().id + "_" + property_uri : property_uri).toLowerCase().replace(/[-:]/g, "_")
      })
      .on("change focusout", changeHandler)
      .keyup( function (e) {
        if (!control.isSingle) { return; }
        if (e.which === 13) { input.change(); }
        if (timeout) { clearTimeout(timeout); }
        timeout = setTimeout(keyupHandler, defaultDelay, e);
      });

    individual.on(property_uri, propertyModifiedHandler);
    control.one("remove", function () {
      individual.off(property_uri, propertyModifiedHandler);
    });
    propertyModifiedHandler();

    function propertyModifiedHandler () {
      if (control.isSingle) {
        var field = input[0];
        var value = veda.Util.formatValue( individual.get(property_uri)[0] );
        value = typeof value !== "undefined" ? value : "";
        try {
          var start = field.selectionStart;
          var end = field.selectionEnd;
          field.value = value;
          field.selectionStart = start;
          field.selectionEnd = end;
        } catch (ex) {
          field.value = value;
          console.log("selectionStart/End error:", property_uri, value, typeof value);
        }
      }
    }
    function changeHandler (e) {
      var value = opts.parser(this.value);
      if (control.isSingle) {
        individual.set(property_uri, [value]);
      } else {
        individual.set(property_uri, individual.get(property_uri).concat(value));
        this.value = "";
      }
    }
    function keyupHandler (e) {
      var input = $(e.target);
      if (
        e.which !== 188
        && e.which !== 190
        && e.which !== 110
        && input.val() !== input.data("prev")
      ) {
        input.data("prev", input.val());
        input.change();
      }
    }

    this.on("veda_focus", function (e) {
      input.trigger("focus");
      e.stopPropagation();
    });

    this.on("view edit search", function (e) {
      e.stopPropagation();
    });

    this.val = function (value) {
      if (!value) return input.val();
      return input.val( veda.Util.formatValue(value) );
    }

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "bottom",
        container: control,
        trigger: "manual",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
      input.on("focusin", function () {
        control.tooltip("show");
      }).on("focusout change", function () {
        control.tooltip("hide");
      });
    }

    return control;
  };
  veda_literal_input.defaults = {
    parser: function (input) {
      return (input || null);
    }
  };

  // Generic input
  $.fn.veda_generic = function( options ) {
    var opts = $.extend( {}, $.fn.veda_generic.defaults, options ),
      control = veda_literal_input.call(this, opts);

    this.append(control);
    return this;
  };
  $.fn.veda_generic.defaults = {
    template: $("#string-control-template").html(),
    isSingle: false,
    parser: function (input) {
      if ( moment(input, ["DD.MM.YYYY HH:mm", "DD.MM.YYYY", "YYYY-MM-DD", "HH:mm"], true).isValid() ) {
        return moment(input, ["DD.MM.YYYY HH:mm", "DD.MM.YYYY", "YYYY-MM-DD", "HH:mm"], true).toDate();
      } else if ( !isNaN( input.split(" ").join("").split(",").join(".") ) ) {
        return parseFloat( input.split(" ").join("").split(",").join(".") );
      } else if ( input === "true" ) {
        return true;
      } else if ( input === "false" ) {
        return false;
      } else {
        var individ = new veda.IndividualModel(input);
        if ( individ.isSync() && !individ.isNew() ) { return individ; }
      }
      return input || null;
    }
  };

  // String input
  $.fn.veda_string = function( options ) {
    var opts = $.extend( {}, $.fn.veda_string.defaults, options ),
      control = veda_literal_input.call(this, opts);
    this.append(control);
    return this;
  };
  $.fn.veda_string.defaults = {
    template: $("#string-control-template").html(),
    parser: function (input) {
      return (input ? new String(input) : null);
    },
    isSingle: true
  };

  // Password input
  $.fn.veda_password = function( options ) {
    var opts = $.extend( {}, $.fn.veda_password.defaults, options ),
      control = veda_literal_input.call(this, opts);
    this.append(control);
    return this;
  };
  $.fn.veda_password.defaults = {
    template: $("#password-control-template").html(),
    parser: function (input) {
      if (input.length === 64) {
        return new String( input );
      } else if (input) {
        return new String( Sha256.hash(input) );
      } else {
        return null;
      }
    },
    isSingle: true
  };

  // Text input
  $.fn.veda_text = function( options ) {
    var opts = $.extend( {}, $.fn.veda_text.defaults, options ),
      control = veda_literal_input.call(this, opts);
    var ta = $("textarea", control);
    ta.attr("rows", this.attr("rows"));
    autosize(ta);
    this.on("edit", function () {
      autosize.update(ta);
    });
    this.on("remove", function () {
      autosize.destroy(ta);
    });
    this.append(control);
    return this;
  };
  $.fn.veda_text.defaults = {
    template: $("#text-control-template").html(),
    parser: function (input) {
      return (input ? new String(input) : null);
    },
    isSingle: true
  };

  // Integer control
  $.fn.veda_integer = function( options ) {
    var opts = $.extend( {}, $.fn.veda_integer.defaults, options ),
      control = veda_literal_input.call(this, opts);
    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "search") {
        control.isSingle = false;
      }
    });
    this.append(control);
    return this;
  };
  $.fn.veda_integer.defaults = {
    template: $("#integer-control-template").html(),
    parser: function (input) {
      var int = parseInt( input.split(" ").join("").split(",").join("."), 10 );
      return !isNaN(int) ? int : null;
    }
  };

  // WorkTime control
  $.fn.veda_worktime = function( options ) {
    var opts = $.extend( {}, $.fn.veda_worktime.defaults, options ),
      control = veda_literal_input.call(this, opts);
    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "search") {
        control.isSingle = false;
      }
    });
    var mainInput=$("input.form-control", control);
    var pseudoInputs=$("div.input-group>input", control).addClass("form-control");
    var summaryText=$("#worktime-summary-text", control).addClass("form-control");
    feelPseudoInput(mainInput.val());
    pseudoInputs.change(feelMainInput);
    function feelMainInput(){
      var count=pseudoInputs[0].value*480 + pseudoInputs[1].value*60 + pseudoInputs[2].value*1;
      mainInput.val(count);
      summaryText.text(count);
      mainInput.change();
    };
    function feelPseudoInput(summaryTime){
      var days=0, hours=0, minutes=0;
      summaryText.text(+summaryTime);
      if (summaryTime!=0){
        days=Math.floor(summaryTime/480);
        summaryTime=summaryTime-days*480;
        if (summaryTime!=0){
          hours=Math.floor(summaryTime/60);
          summaryTime=summaryTime-hours*60;
          if (summaryTime!=0){
            minutes=summaryTime;
          };
        };
      };
      pseudoInputs[0].value=days;
      pseudoInputs[1].value=hours;
      pseudoInputs[2].value=minutes;
    };
    this.append(control);
    return this;
  };
  $.fn.veda_worktime.defaults = {
    template: $("#worktime-control-template").html(),
    parser: function (input) {
      var int = parseInt( input.split(" ").join("").split(",").join("."), 10 );
      return !isNaN(int) ? int : null;
    }
  };

  // Decimal control
  $.fn.veda_decimal = function( options ) {
    var opts = $.extend( {}, $.fn.veda_decimal.defaults, options ),
      control = veda_literal_input.call(this, opts);
    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "search") {
        control.isSingle = false;
      }
    });
    this.append(control);
    return this;
  };
  $.fn.veda_decimal.defaults = {
    template: $("#decimal-control-template").html(),
    parser: function (input) {
      var float = parseFloat( input.split(" ").join("").split(",").join(".") );
      return !isNaN(float) ? float : null;
    }
  };

  // Datetime control
  var veda_dateTime = function (options) {
    var opts = $.extend( {}, veda_dateTime.defaults, options ),
      control = $(opts.template),
      format = opts.format,
      spec = opts.spec,
      placeholder = spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].join(" ") : "",
      property_uri = opts.property_uri,
      individual = opts.individual,
      isSingle = spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true,
      input = $("input", control),
      change;

    input.attr({
      "placeholder": placeholder,
      "name": (individual.hasValue("rdf:type") ? individual["rdf:type"].pop().id + "_" + property_uri : property_uri).toLowerCase().replace(/[-:]/g, "_")
    });

    var singleValueHandler = function (values) {
      if (values.length) {
        input.val( moment(values[0]).format(format) );
      } else {
        input.val("");
      }
    }

    if (isSingle) {
      change = function (value) {
        individual.set(property_uri, [value]);
      };
      if (individual.hasValue(property_uri)) {
        input.val( moment(individual.get(property_uri)[0]).format(format) );
      }
      individual.on(property_uri, singleValueHandler);
      control.one("remove", function () {
        individual.off(property_uri, singleValueHandler);
      });
    } else {
      change = function (value) {
        individual.set(property_uri, individual.get(property_uri).concat(value));
        input.val("");
      }
    }

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "auto left",
        container: control,
        trigger: "manual",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
      input.on("focusin", function () {
        control.tooltip("show");
      }).on("focusout change", function () {
        control.tooltip("hide");
      });
    }

    control.datetimepicker({
      locale: Object.keys(veda.user.language).length === 1 ? Object.keys(veda.user.language)[0] : 'EN',
      allowInputToggle: true,
      format: format,
      sideBySide: true,
      useCurrent: true
    });

    input.on("change focusout", function () {
      var value = opts.parser( this.value );
      change(value);
    });

    this.on("veda_focus", function (e) {
      input.trigger("focus");
      e.stopPropagation();
    });

    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "search") {
        change = function (value) {
          individual.set(property_uri, individual.get(property_uri).concat(value));
          input.val("");
        }
      }
    });

    this.val = function (value) {
      if (!value) return input.val();
      return input.val(value);
    }

    this.on("remove", function () {
      control.data("DateTimePicker").destroy();
    });

    return control;
  };
  veda_dateTime.defaults = {
    template: $("#datetime-control-template").html(),
    parser: function (input) {
      if (input) {
        var timestamp = moment(input, "DD.MM.YYYY HH:mm").toDate();
        return new Date(timestamp);
      }
      return null;
    },
    format: "DD.MM.YYYY HH:mm"
  };

  // Date control
  $.fn.veda_date = function( options ) {
    var opts = $.extend( {}, $.fn.veda_date.defaults, options ),
      control = veda_dateTime.call(this, opts);
    this.append(control);
    return this;
  };
  $.fn.veda_date.defaults = {
    template: $("#datetime-control-template").html(),
    parser: function (input) {
      if (input) {
        var timestamp = moment(input, "DD.MM.YYYY").toDate();
        return new Date(timestamp);
      }
      return null;
    },
    format: "DD.MM.YYYY"
  };

  // Time control
  $.fn.veda_time = function( options ) {
    var opts = $.extend( {}, $.fn.veda_time.defaults, options ),
      control = veda_dateTime.call(this, opts);
    this.append(control);
    return this;
  };
  $.fn.veda_time.defaults = {
    template: $("#datetime-control-template").html(),
    parser: function (input) {
      if (input) {
        var timestamp = moment(input, "HH:mm").toDate();
        var result = new Date(timestamp);
        result.setFullYear(1970);
        result.setMonth(0);
        result.setDate(1);
        return result;
      }
      return null;
    },
    format: "HH:mm"
  };

  // Date-Time control
  $.fn.veda_dateTime = function( options ) {
    var opts = $.extend( {}, $.fn.veda_dateTime.defaults, options ),
      control = veda_dateTime.call(this, opts);
    this.append(control);
    return this;
  };
  $.fn.veda_dateTime.defaults = {
    template: $("#datetime-control-template").html(),
    parser: function (input) {
      if (input) {
        var timestamp = moment(input, "DD.MM.YYYY HH:mm").toDate();
        return new Date(timestamp);
      }
      return null;
    },
    format: "DD.MM.YYYY HH:mm"
  };


  // MULTILINGUAL INPUT CONTROLS

  // Generic multilingual input behaviour
  var veda_multilingual = function( options ) {
    var opts = $.extend( {}, veda_multilingual.defaults, options ),
      control = $(opts.template),
      inputTemplate = control.children().remove(),
      individual = opts.individual,
      property_uri = opts.property_uri,
      spec = opts.spec,
      placeholder = spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].join(" ") : "",
      timeout;

    Object.keys(veda.user.language).map(function (language_name) {
      var localedInput = inputTemplate.clone();

      localedInput.find(".language-tag").text(language_name);

      var formControl = localedInput.find(".form-control");
      formControl
        .attr({
          "lang": language_name,
          "placeholder": placeholder,
          "name": (individual.hasValue("rdf:type") ? individual["rdf:type"].pop().id + "_" + property_uri : property_uri).toLowerCase().replace(/[-:]/g, "_")
        })
        .on("change focusout", function () {
          var values = control.find(".form-control").map(function () {
            return opts.parser( this.value, this );
          }).get();
          individual.set(property_uri, values);
        })
        .keyup( function (e) {
          if (e.which === 13) { formControl.change(); }
          if (timeout) { clearTimeout(timeout); }
          timeout = setTimeout(keyupHandler, defaultDelay, e);
        });

      individual.get(property_uri).forEach(function (value) {
        if ( value.language === language_name || !value.language ) {
          formControl.val(value);
        }
      });

      control.append( localedInput );
    });

    var input = control.find(".form-control");

    individual.on(property_uri, handler);
    control.one("remove", function () {
      individual.off(property_uri, handler);
    });

    function keyupHandler (e) {
      var input = $(e.target);
      if (
        e.which !== 188
        && e.which !== 190
        && e.which !== 110
        && input.val() !== input.data("prev")
      ) {
        input.data("prev", input.val());
        input.change();
      }
    }

    function handler (values) {
      input.each(function () {
        var that = this;
        var lang = this.lang;
        individual.get(property_uri).forEach(function (value) {
          if ( value.language === lang || !value.language ) {
            try {
              if (that === document.activeElement) {
                var start = that.selectionStart;
                var end = that.selectionEnd;
                that.value = value;
                that.selectionStart = start;
                that.selectionEnd = end;
              } else {
                that.value = value;
              }
            } catch (ex) {
              that.value = value;
              console.log("selectionStart/End error:", property_uri, value, typeof value);
            }
          }
        });
      });
    }

    this.on("veda_focus", function (e, value) {
      input.each(function () {
        if ( value.language === this.lang || !value.language ) {
          $(this).trigger("focus");
        }
      });
      e.stopPropagation();
    });

    this.on("view edit search", function (e) {
      e.stopPropagation();
    });

    this.val = function (value) {
      if (!value) {
        return parser( input.val() );
      }
      input.each(function () {
        if (value.language === this.lang || !value.language) {
          this.value = value.toString();
        }
      });
    }

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "bottom",
        container: control,
        trigger: "manual",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
      input.on("focusin", function () {
        control.tooltip("show");
      }).on("focusout change", function () {
        control.tooltip("hide");
      });
    }

    return control;
  };
  veda_multilingual.defaults = {
    parser: function (input, el) {
      if (input) {
        var value = new String(input);
        value.language = $(el).attr("lang") || undefined;
        return value;
      }
      return null;
    }
  };

  // Multilingual string control
  $.fn.veda_multilingualString = function (options) {
    var opts = $.extend( {}, $.fn.veda_multilingualString.defaults, options ),
        $this = $(this);
    init();
    veda.on("language:changed", init);
    $this.one("remove", function () {
      veda.off("language:changed", init);
    });
    function init() {
      $this.empty();
      $this.append( veda_multilingual.call($this, opts) );
    }
    return this;
  };
  $.fn.veda_multilingualString.defaults = {
    template: $("#multilingual-string-control-template").html(),
  };

  // Multilingual text control
  $.fn.veda_multilingualText = function (options) {
    var opts = $.extend( {}, $.fn.veda_multilingualText.defaults, options ),
      $this = $(this);
    init();
    veda.on("language:changed", init);
    $this.one("remove", function () {
      veda.off("language:changed", init);
    });
    function init() {
      $this.empty();
      var control = veda_multilingual.call($this, opts);
      var ta = $("textarea", control);
      ta.attr("rows", $this.attr("rows"));
      autosize(ta);
      $this.on("edit", function () {
        autosize.update(ta);
      });
      $this.on("remove", function () {
        autosize.destroy(ta);
      });
      $this.append(control);
    }
    return this;
  };
  $.fn.veda_multilingualText.defaults = {
    template: $("#multilingual-text-control-template").html(),
  };

  // BOOLEAN CONTROL
  $.fn.veda_boolean = function( options ) {
    var opts = $.extend( {}, $.fn.veda_boolean.defaults, options ),
      control = $( opts.template ),
      input = $("input", control),
      individual = opts.individual,
      property_uri = opts.property_uri,
      spec = opts.spec;

    function handler (doc_property_uri) {
      if (individual.hasValue(property_uri)) {
        if (individual.get(property_uri)[0] === true) {
          input.prop("checked", true).prop("readonly", false).prop("indeterminate", false);
        } else {
          input.prop("checked", false).prop("readonly", false).prop("indeterminate", false);
        }
      } else {
        input.prop("readonly", true).prop("indeterminate", true);
      }
    }
    handler();

    individual.on(property_uri, handler);
    this.one("remove", function () {
      individual.off(property_uri, handler);
    });

    input.click( function () {
      if ( input.prop("readonly") ) {
        individual.set(property_uri, [false]);
      } else if ( !input.prop("checked") ) {
        individual.set(property_uri, []);
      } else {
        individual.set(property_uri, [true]);
      }
    });

    if ( input.closest(".checkbox.disabled").length ) {
      input.attr("disabled", "disabled");
    }

    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "view") {
        input.attr("disabled", "disabled")
        control.parents("label").tooltip("destroy");
      } else {
        if ( input.closest(".checkbox.disabled").length ) {
          input.attr("disabled", "disabled");
        } else {
          input.removeAttr("disabled");
        }
        if (spec && spec.hasValue("v-ui:tooltip")) {
          control.parents("label").tooltip({
            title: spec["v-ui:tooltip"].join(", "),
            placement: "bottom",
            container: control,
            trigger: "hover",
            animation: false
          });
        }
      }
    });
    this.append(control);
    return this;
  };
  $.fn.veda_boolean.defaults = {
    template: $("#boolean-control-template").html(),
  };

  // SELECT CONTROL

  $.fn.veda_select = function (options) {
    var opts = $.extend( {}, $.fn.veda_select.defaults, options ),
      control = $(opts.template),
      individual = opts.individual,
      property_uri = opts.property_uri || opts.rel_uri,
      spec = opts.spec,
      isSingle = spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true,
      select = $("select", control),
      first_opt = $("option", control),
      rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
      range = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(property_uri))["rdfs:range"],
      queryPrefix = spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0] : range.map(function (item) {return "'rdf:type'==='" + item.id + "'"}).join(" && "),
      placeholder = spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].join(" ") : (new veda.IndividualModel("v-s:SelectValueBundle"))["rdfs:label"].join(" "),
      source = this.attr("data-source") || undefined,
      template = this.attr("data-template") || undefined,
      options = [];

    populate();

    select.change(function () {
      var value = $("option:selected", select).data("value");
      if (isSingle) {
        individual.set(property_uri, [value]);
      } else {
        if ( !individual.hasValue(property_uri, value) ) {
          individual.set(property_uri, individual.get(property_uri).concat( value ));
        }
        $(this).children(":first").prop("selected", true);
      }
    });

    individual.on(property_uri, handler);
    control.one("remove", function () {
      individual.off(property_uri, handler);
    });

    if (template) {
      this.removeAttr("data-template");
    }

    function renderValue (value) {
      if (value instanceof veda.IndividualModel) {
        return value.load().then(function (individual) {
          if (template) {
            return template.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); })
          } else {
            return individual.toString();
          }
        });
      } else {
        return veda.Util.formatValue(value);
      }
    }

    function populate() {
      if (spec && spec.hasValue("v-ui:optionValue")) {
        options = spec["v-ui:optionValue"];
      } else if (source) {
        source.replace(/{\s*([^{}]+)\s*}/g, function (match) {
          return options = eval(match);
        });
      } else if (queryPrefix) {
        queryPrefix = queryPrefix.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); });
        ftQuery(queryPrefix).then(renderOptions);
        return;
      }
      renderOptions(options);
    }

    function renderOptions(options) {
      select.empty();
      first_opt.text(placeholder).data("value", null).appendTo(select);
      options.map(function (value, index) {
        if (index >= 100) { return; }
        var opt = first_opt.clone().appendTo(select);
        opt.text( renderValue(value) ).data("value", value);
        if ( isSingle && individual.hasValue(property_uri, value) ) {
          opt.prop("selected", true);
        }
      });
    }

    function handler() {
      if (isSingle) {
        $("option", control).each(function () {
          var value = $(this).data("value");
          var hasValue = individual.hasValue(property_uri, value);
          $(this).prop("selected", hasValue);
        });
      }
    }

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "top",
        container: control,
        trigger: "hover",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
    }

    this.on("view edit search", function (e) {
      e.stopPropagation();
    });
    this.val = function (value) {
      if (!value) return $("select", this).val();
      return $("select", this).val( renderValue(value) );
    }
    this.populate = function () {
      populate();
      return this;
    }
    this.append(control);
    return this;
  };
  $.fn.veda_select.defaults = {
    template: $("#select-control-template").html(),
  }

  // CHECKBOX GROUP CONTROL

  $.fn.veda_checkbox = function (options) {
    var opts = $.extend( {}, $.fn.veda_checkbox.defaults, options ),
      control = $(opts.template),
      individual = opts.individual,
      property_uri = opts.property_uri || opts.rel_uri,
      parser = opts.parser,
      spec = opts.spec,
      holder = $(".checkbox", control),
      rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
      range = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(property_uri))["rdfs:range"],
      queryPrefix = spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0] : range.map(function (item) {return "'rdf:type'==='" + item.id + "'"}).join(" && "),
      source = this.attr("data-source") || undefined,
      template = this.attr("data-template") || undefined,
      options = [];

    populate();

    individual.on(property_uri, handler);
    this.one("remove", function () {
      individual.off(property_uri, handler);
    });

    if (template) {
      this.removeAttr("data-template");
    }

    function renderValue (value) {
      if (value instanceof veda.IndividualModel) {
        return value.load().then(function (individual) {
          if (template) {
            return template.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); })
          } else {
            return individual.toString();
          }
        });
      } else {
        return veda.Util.formatValue(value);
      }
    }

    function populate() {
      if (spec && spec.hasValue("v-ui:optionValue")) {
        options = spec["v-ui:optionValue"];
      } else if (source) {
        source.replace(/{\s*([^{}]+)\s*}/g, function (match) {
          return options = eval(match);
        });
      } else if (queryPrefix) {
        queryPrefix = queryPrefix.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); });
        ftQuery(queryPrefix).then(renderOptions);
        return;
      }
      renderOptions(options);
    }

    function renderOptions(options) {
      control.empty();
      options.map(function (value, index) {
        if (index >= 100) { return; }
        var hld = holder.clone().appendTo(control);
        var lbl = $("label", hld).append( renderValue(value) );
        var chk = $("input", lbl).data("value", value);
        var hasValue = individual.hasValue(property_uri, value);
        chk.prop("checked", hasValue);
        chk.change(function () {
          if ( chk.is(":checked") ) {
            individual.set(property_uri, individual.get(property_uri).concat( chk.data("value") ));
          } else {
            individual.set(property_uri, individual.get(property_uri).filter( function (i) {
              return i.valueOf() !== chk.data("value").valueOf();
            }));
          }
        });
      });
    }

    function handler(doc_property_uri) {
      $("input", control).each(function () {
        var value = $(this).data("value");
        var hasValue = individual.hasValue(property_uri, value);
        $(this).prop("checked", hasValue);
      });
    }

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "bottom",
        container: control,
        trigger: "hover",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
    }

    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "view") {
        $("div.checkbox", control).addClass("disabled");
        $("input", control).attr("disabled", "true");
      } else {
        $("div.checkbox", control).removeClass("disabled");
        $("input", control).removeAttr("disabled");
      }
    });
    this.val = function (value) {
      if (!value) return $("input", this).map(function () { return this.value });
      populate();
      return this;
    }
    this.populate = function () {
      populate();
      return this;
    }
    this.append(control);
    return this;
  };
  $.fn.veda_checkbox.defaults = {
    template: $("#checkbox-control-template").html(),
  }

  // RADIO GROUP CONTROL

  $.fn.veda_radio = function (options) {
    var opts = $.extend( {}, $.fn.veda_radio.defaults, options ),
      control = $(opts.template),
      individual = opts.individual,
      property_uri = opts.property_uri || opts.rel_uri,
      parser = opts.parser,
      spec = opts.spec,
      holder = $(".radio", control),
      rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
      range = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(property_uri))["rdfs:range"],
      queryPrefix = spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0] : range.map(function (item) {return "'rdf:type'==='" + item.id + "'"}).join(" && "),
      source = this.attr("data-source") || undefined,
      template = this.attr("data-template") || undefined,
      options = [];

    populate();

    individual.on(property_uri, handler);
    this.one("remove", function () {
      individual.off(property_uri, handler);
    });

    if (template) {
      this.removeAttr("data-template");
    }

    function renderValue (value) {
      if (value instanceof veda.IndividualModel) {
        return value.load().then(function (individual) {
          if (template) {
            return template.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); })
          } else {
            return individual.toString();
          }
        });
      } else {
        return veda.Util.formatValue(value);
      }
    }

    function populate() {
      if (spec && spec.hasValue("v-ui:optionValue")) {
        options = spec["v-ui:optionValue"];
      } else if (source) {
        source.replace(/{\s*([^{}]+)\s*}/g, function (match) {
          return options = eval(match);
        });
      } else if (queryPrefix) {
        queryPrefix = queryPrefix.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); });
        ftQuery(queryPrefix).then(renderOptions);
        return;
      }
      renderOptions(options);
    }

    function renderOptions(options) {
      control.empty();
      options.map(function (value, index) {
        if (index >= 100) { return; }
        var hld = holder.clone().appendTo(control);
        var lbl = $("label", hld).append( renderValue(value) );
        var rad = $("input", lbl).data("value", value);
        var hasValue = individual.hasValue(property_uri, value);
        rad.prop("checked", hasValue);
        rad.change(function () {
          if ( rad.is(":checked") ) {
            individual.set(property_uri, [rad.data("value")]);
          } else {
            individual.set(property_uri, individual.get(property_uri).filter( function (i) {
              return i.valueOf() !== rad.data("value").valueOf();
            }));
          }
        });
      });
    }

    function handler() {
      $("input", control).each(function () {
        var value = $(this).data("value");
        var hasValue = individual.hasValue(property_uri, value);
        $(this).prop("checked", hasValue);
      });
    }

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "bottom",
        container: control,
        trigger: "hover",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
    }

    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "view") {
        $("div.radio", control).addClass("disabled");
        $("input", control).attr("disabled", "true");
      } else {
        $("div.radio", control).removeClass("disabled");
        $("input", control).removeAttr("disabled");
      }
    });
    this.val = function (value) {
      if (!value) return $("input", this).map(function () { return this.value });
      populate();
      return this;
    }
    this.populate = function () {
      populate();
      return this;
    }
    this.append(control);
    return this;
  };
  $.fn.veda_radio.defaults = {
    template: $("#radio-control-template").html(),
  }

  // Numeration control
  $.fn.veda_numeration = function( options ) {
    var opts = $.extend( {}, $.fn.veda_numeration.defaults, options ),
      control = $(opts.template),
      spec = opts.spec,
      placeholder = spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].join(" ") : "",
      isSingle = spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true,
      property_uri = opts.property_uri,
      individual = opts.individual,
      input = $(".form-control", control),
      button = $(".get-numeration-value", control);

    input.attr({
      "placeholder": placeholder,
      "name": (individual.hasValue("rdf:type") ? individual["rdf:type"].pop().id + "_" + property_uri : property_uri).toLowerCase().replace(/[-:]/g, "_")
    });

    function singleValueHandler (values) {
      input.val( values[0] );
    }

    var change = function (value) {
      individual.set(property_uri, [value]);
    };

    input.val(individual.get(property_uri)[0]);
    individual.on(property_uri, singleValueHandler);
    control.one("remove", function () {
      individual.off(property_uri, singleValueHandler);
    });

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "bottom",
        container: control,
        trigger: "manual",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
      input.on("focusin", function () {
        control.tooltip("show");
      }).on("focusout change", function () {
        control.tooltip("hide");
      });
    }

    input.on("change focusout", function () {
      var value = opts.parser( this.value, this );
      change(value);
    });

    this.on("view edit search", function (e) {
      e.stopPropagation();
    });

    this.val = function (value) {
      if (!value) return input.val();
      return input.val(value);
    }

    button.on("click", function () {
      var prop = new veda.IndividualModel(property_uri);
      if (prop['v-s:hasNumerationMapper']) {
        for (var mapkey in prop['v-s:hasNumerationMapper']) {
          var map = prop['v-s:hasNumerationMapper'][mapkey];
          if (map['v-s:numerationClass'][0].id == individual['rdf:type'][0].id) {
            var numertor = map['v-s:hasNumerationRule'][0];
              var scope = eval(numertor['v-s:numerationScope'][0].toString())(null, individual);
              var nextValue = eval(numertor['v-s:numerationGetNextValue'][0].toString())(null, scope);
              individual.set(property_uri, [nextValue]);
          }
        }
      }
    });

    this.append(control);
    return this;
  };
  $.fn.veda_numeration.defaults = {
    template: $("#numeration-control-template").html(),
    parser: function (input) {
      var int = parseInt( input.split(" ").join("").split(",").join("."), 10 );
      return !isNaN(int) ? "" + int : null;
    }
  };

  // SOURCE CODE CONTROL
  $.fn.veda_source = function (options) {
    var self = this,
        opts = $.extend( {}, $.fn.veda_source.defaults, options ),
        control = $(opts.template),
        individual = opts.individual,
        property_uri = opts.property_uri,
        editorEl = control.get(0);

    opts.value = individual.hasValue(property_uri) ? individual.get(property_uri)[0].toString() : "";
    opts.change = function (value) {
      individual.set(property_uri, [value]);
    }
    if (typeof self.attr('data-mode') !== "undefined") opts.sourceMode = self.attr('data-mode');
    if (property_uri === "v-s:script") opts.sourceMode = "javascript";
    if (property_uri === "v-ui:template") opts.sourceMode = "htmlmixed";
    var editor = CodeMirror(editorEl, {
      value: opts.value,
      mode: opts.sourceMode,
      lineWrapping: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      matchTags: true,
      autoCloseTags: true,
      lineNumbers: true,
      extraKeys: {
        "F9": function(cm) {
          cm.setOption("fullScreen", !cm.getOption("fullScreen"));
        },
        "Esc": function(cm) {
          if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
        },
        "Tab": function(cm) {
          var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
          cm.replaceSelection(spaces);
        }
      }
    });

    setTimeout( function () {
      editor.refresh();
    }, 100);
    this.on("view edit search", function (e) {
      e.stopPropagation();
      editor.refresh();
      e.type === "view"   ? ( editor.setOption("readOnly", "nocursor") ) :
      e.type === "edit"   ? ( editor.setOption("readOnly", false) ) :
      e.type === "search" ? ( editor.setOption("readOnly", false) ) :
      true;
    });

    editor.on("change", function () {
      var value = opts.parser( editor.doc.getValue() );
      opts.change(value);
    });
    function handler(values) {
      var doc = editor.getDoc();
      var value = doc.getValue();
      if (!values.length || values[0].toString() !== value) {
        var cursor = doc.getCursor();
        doc.setValue( values.length ? values[0].toString() : "" );
        doc.setCursor(cursor);
      }
    }
    individual.on(property_uri, handler );
    this.on("remove", function () {
      individual.off(property_uri, handler);
    });

    this.append(control);
    return this;
  }
  $.fn.veda_source.defaults = {
    value: "",
    template: $("#source-control-template").html(),
    mode: "javascript",
    parser: function (input) {
      return (input || null);
      //return new String(input);
    }
  };

  // FILE UPLOAD CONTROL
  function uploadFile(file, acceptedFileType, success, progress) {
    var notify = new veda.Notify();
    if (file instanceof File) {
      var ext = file.name.match(/\.\w+$/); ext = ( ext ? ext[0] : ext );
      if (acceptedFileType && acceptedFileType.split(",").indexOf(ext) < 0) {
        return notify("danger", {message: "Тип файла не разрешен (" + acceptedFileType + ")"});
      }
    }
    var url = "/files",
        xhr = new XMLHttpRequest(),
        d = new Date(),
        path = ["", d.getFullYear(), d.getMonth() + 1, d.getDate()].join("/"),
        uri = veda.Util.guid(),
        fd = new FormData();
    xhr.open("POST", url, true);
    xhr.upload.onprogress = progress;
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          success(file, path, uri);
        } else {
          notify("danger", {code: xhr.status, message: "File upload error"});
        }
      }
    };
    xhr.onerror = function() {
      notify("danger", {message: "File upload error"});
    };
    fd.append("path", path);
    fd.append("uri", uri);
    if (file instanceof File) {
      fd.append("file", file);
    } else {
      fd.append("content", file);
    }
    xhr.send(fd);
  }

  function resize (image, maxWidth, success) {
    var cnvs1 = document.createElement("canvas"),
        ctx1 = cnvs1.getContext("2d"),
        cnvs2 = document.createElement("canvas"),
        ctx2 = cnvs2.getContext("2d"),
        reader = new FileReader();
    reader.onload = function(event) {
      var img = new Image();
      img.onload = function() {
        var ratio = maxWidth / img.width;
        var width = img.width * ratio >> 0;
        var height = img.height * ratio >> 0;
        cnvs1.width = width;
        cnvs1.height = height;
        cnvs2.width = img.width * 2;
        cnvs2.height = img.height * 2;
        ctx2.drawImage(img, 0, 0, img.width, img.height, 0, 0, width * 2, height * 2);
        ctx1.drawImage(cnvs2, 0, 0, width * 2, height * 2, 0, 0, width, height);
        var thumbnail = cnvs1.toDataURL("image/jpeg");
        success(thumbnail);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(image);
  }

  $.fn.veda_file = function( options ) {
    var opts = $.extend( {}, $.fn.veda_file.defaults, options ),
      control = $(opts.template),
      spec = opts.spec,
      individual = opts.individual,
      rel_uri = opts.rel_uri,
      rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
      range = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(rel_uri))["rdfs:range"],
      isSingle = spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true,
      acceptedFileType = this.attr("accept");

    var fileInput = $(".file", control);
    if (!isSingle) fileInput.attr("multiple", "multiple");
    var btn = $(".btn", control),
        indicatorPercentage = $(".indicator-percentage", control),
        indicatorSpinner = $(".indicator-spinner", control);
    btn.click(function (e) {
      fileInput.click();
    });
    var files = [], n;
    var uploaded = function (file, path, uri) {
      var f = new veda.IndividualModel();
      f["rdf:type"] = range;
      f["v-s:fileName"] = [ file.name ];
      f["rdfs:label"] = [ file.name ];
      f["v-s:fileSize"] = [ file.size ];
      f["v-s:fileUri"] = [ uri ];
      f["v-s:filePath"] = [ path ];
      f["v-s:parent"] = [ individual ]; // v-s:File is subClassOf v-s:Embedded
      if ( (/^(?!thumbnail-).+\.(jpg|jpeg|gif|png|tiff|tif|bmp)$/i).test(file.name) ) {
        resize(file, 256, function (thumbnail) {
          uploadFile(thumbnail, undefined, function (_, path, uri) {
            var t = new veda.IndividualModel();
            t["rdf:type"] = range;
            t["v-s:fileName"] = [ "thumbnail-" + file.name ];
            t["rdfs:label"] = [ "thumbnail-" + file.name ];
            t["v-s:fileUri"] = [ uri ];
            t["v-s:filePath"] = [ path ];
            t["v-s:parent"] = [ f ]; // v-s:File is subClassOf v-s:Embedded
            t.save();
            f["v-s:thumbnail"] = [ t ];
            f.save();
            files.push(f);
            if (files.length === n) {
              if (isSingle) {
                individual.set(rel_uri, files);
              } else {
                individual.set(rel_uri, individual.get(rel_uri).concat(files));
              }
            }
            indicatorSpinner.empty().hide();
            indicatorPercentage.empty().hide();
          });
        });
      } else {
        f.save();
        files.push(f);
        if (files.length === n) {
          if (isSingle) {
            individual.set(rel_uri, files);
          } else {
            individual.set(rel_uri, individual.get(rel_uri).concat(files));
          }
        }
        indicatorSpinner.empty().hide();
        indicatorPercentage.empty().hide();
      }
    };
    var progress = function (progressEvent) {
      if (progressEvent.lengthComputable) {
        var percentComplete = Math.round(progressEvent.loaded / progressEvent.total * 100);
        indicatorPercentage.text(percentComplete + "%").show();
      } else {
        indicatorSpinner.show();
      }
    };
    fileInput.change(function () {
      files = [];
      n = this.files.length;
      for (var i = 0, file; (file = this.files && this.files[i]); i++) {
        uploadFile(file, acceptedFileType, uploaded, progress);
      }
    });
    this.on("view edit search", function (e) {
      e.stopPropagation();
    });
    this.append(control);
    return this;
  }
  $.fn.veda_file.defaults = {
    template: $("#file-control-template").html()
  };

  // OBJECT PROPERTY CONTROL
  $.fn.veda_link = function( options ) {
    var opts = $.extend( {}, $.fn.veda_link.defaults, options ),
      control = $(opts.template),
      template = this.attr("data-template") || "{individual['rdfs:label'].join(', ')}",
      individual = opts.individual,
      spec = opts.spec,
      placeholder = this.data("placeholder") || ( spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].join(" ") : (new veda.IndividualModel("v-s:StartTypingBundle"))["rdfs:label"].join(" ") ),
      queryPrefix = this.data("query-prefix") || ( spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0].toString() : undefined ),
      sort = this.data("sort") || spec && spec.hasValue("v-ui:sort") ? spec["v-ui:sort"][0].toString() : "'rdfs:label_ru' desc , 'rdfs:label_en' desc , 'rdfs:label' desc",
      rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
      rel_uri = opts.rel_uri,
      isSingle = ( spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true ) || this.data("single");

    this.removeAttr("data-template");
    function renderTemplate (individual) {
      return template.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); });
    }

    if (queryPrefix) {
      queryPrefix = queryPrefix.replace(/{\s*([^{}]+)\s*}/g, function (match) { return eval(match); });
    } else {
      var relRange = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(rel_uri))["rdfs:range"];
      if ( relRange && relRange.length && (relRange.length > 1 || relRange[0].id !== "rdfs:Resource") ) {
        var types = relRange.map(function (i) { return "'rdf:type' == '" + i.id + "'";})
        queryPrefix = "(" + types.join(" || ") + ")";
      }
    }

    // Select value
    function select(selected) {
      selected = selected instanceof Array ? selected : [ selected ];
      if (isSingle) {
        individual.set(rel_uri, [ selected[0] ]);
      } else {
        var filtered = selected.filter( function (i) {
          return individual.get(rel_uri).indexOf(i) < 0;
        });
        individual.set(rel_uri, individual.get(rel_uri).concat(filtered));
      }
    }

    function createValue() {
      var newVal = new veda.IndividualModel();
      newVal["rdf:type"] = rangeRestriction ? [ rangeRestriction ] : [ (new veda.IndividualModel(rel_uri))["rdfs:range"][0] ];
      return newVal;
    }

    // Create feature
    var create = $(".create", control);
    if ( this.hasClass("create") || this.hasClass("full") ) {
      var inModal = this.hasClass("create-modal");
      var rel_range = rangeRestriction ? rangeRestriction : (new veda.IndividualModel(rel_uri))["rdfs:range"][0];
      rel_range.rights.then(function (rights) {
        if ( !rights.hasValue("v-s:canCreate", true) ) {
          create.addClass("disabled");
          create.off("click");
        } else {
          create.click( function (e) {
            var newVal = createValue();
            if ( inModal ) {
              var modal = $("#individual-modal-template").html();
              modal = $(modal).modal({"show": false});
              $("body").append(modal);
              modal.modal("show");
              create.one("remove", function () {
                modal.modal("hide").remove();
                $(document).off("keyup", escHandler);
              });
              var ok = $("#ok", modal).click(function (e) {
                select(newVal);
                $(document).off("keyup", escHandler);
              });
              var close = $(".close", modal).click(function (e) {
                newVal.delete();
                $(document).off("keyup", escHandler);
              });
              var escHandler = function (e) {
                if (e.keyCode === 27) {
                  close.click();
                }
              };
              $(document).on("keyup", escHandler);
              var cntr = $(".modal-body", modal);
              newVal.one("beforeReset", function () {
                modal.modal("hide").remove();
              });
              newVal.one("afterSave", function () {
                select(newVal);
                modal.modal("hide").remove();
              });
              var tmpl = newVal["rdf:type"][0].hasValue("v-ui:hasTemplate") ? $( newVal["rdf:type"][0]["v-ui:hasTemplate"][0]["v-ui:template"][0].toString() ) : undefined;
              if (tmpl) {
                $(".action", tmpl).remove();
              }
              newVal.present(cntr, tmpl, "edit");
              var template = cntr.children("[resource]");
              template.on("internal-validated", function (e, validation) {
                validation.state ? ok.removeAttr("disabled") : ok.attr("disabled", "disabled");
              });
            } else {
              select(newVal);
            }
          });
        }
      });


      // Hide create button for single value relations if value exists
      if (isSingle) {
        var singleValueHandler = function (values) {
          if (values.length) {
            create.hide();
          } else {
            create.show();
          }
        };
        individual.on(rel_uri, singleValueHandler);
        create.one("remove", function () {
          individual.off(rel_uri, singleValueHandler);
        });
        singleValueHandler(individual.get(rel_uri));
      }

    } else {
      create.remove();
    }

    // Tree feature
    var tree = $(".tree", control);
    if ( this.hasClass("tree") || this.hasClass("full") ) {
      var root = spec && spec.hasValue("v-ui:treeRoot") ? spec["v-ui:treeRoot"] : undefined,
          inProperty = spec && spec.hasValue("v-ui:treeInProperty") ? spec["v-ui:treeInProperty"] : undefined,
          outProperty = spec && spec.hasValue("v-ui:treeOutProperty") ? spec["v-ui:treeOutProperty"] : undefined,
          allowedClass = spec && spec.hasValue("v-ui:treeAllowedClass") ? spec["v-ui:treeAllowedClass"] : undefined,
          selectableClass = spec && spec.hasValue("v-ui:treeSelectableClass") ? spec["v-ui:treeSelectableClass"] : undefined,
          selectableFilter = spec && spec.hasValue("v-ui:treeSelectableFilter") ? spec["v-ui:treeSelectableFilter"] : undefined,
          displayedProperty = spec && spec.hasValue("v-ui:treeDisplayedProperty") ? spec["v-ui:treeDisplayedProperty"] : [ new veda.IndividualModel("rdfs:label") ];

      if (root && (inProperty || outProperty)) {
        var treeConfig = {
          root: root,
          inProperty: inProperty,
          outProperty: outProperty,
          sort: sort,
          allowedClass: allowedClass,
          selectableClass: selectableClass,
          selectableFilter: selectableFilter,
          displayedProperty: displayedProperty,
          targetRel_uri: rel_uri,
          isSingle: isSingle
        };
        var treeTmpl = new veda.IndividualModel("v-ui:TreeTemplate");
        var modal = $("#individual-modal-template").html();
        tree.click(function () {
          individual.treeConfig = treeConfig;
          var $modal = $(modal);
          var cntr = $(".modal-body", $modal);
          $modal.on('hidden.bs.modal', function (e) {
            $modal.remove();
            delete individual.treeConfig;
          });
          $modal.modal();
          $("body").append($modal);
          individual.present(cntr, treeTmpl);
        });
      } else {
        tree.remove();
      }
    } else {
      tree.remove();
    }

    // Fulltext search feature
    var fulltext = $(".fulltext", control);
    var fulltextMenu = $(".fulltext-menu", control);
    if ( this.hasClass("fulltext") || this.hasClass("full") ) {

      fulltext.attr({
        "placeholder": placeholder,
        "name": (individual.hasValue("rdf:type") ? individual["rdf:type"][0].id + "_" + rel_uri : rel_uri).toLowerCase().replace(/[-:]/g, "_")
      });

      autosize(fulltext);
      this.on("edit", function () {
        autosize.update(fulltext);
      });
      this.on("remove", function () {
        autosize.destroy(fulltext);
      });

      var header = $(".header", control);
      Promise.all([
        new veda.IndividualModel("v-s:SelectAll").load(),
        new veda.IndividualModel("v-s:CancelSelection").load(),
        new veda.IndividualModel("v-s:InvertSelection").load(),
        new veda.IndividualModel("v-s:Ok").load()
      ]).then(function (actions) {
        header.find(".select-all")
          .click(function () { suggestions.children(":not(.selected)").click(); })
          .text( actions[0] );
        header.find(".cancel-selection")
          .click(function () { suggestions.children(".selected").click(); })
          .text( actions[1] );
        header.find(".invert-selection")
          .click(function () { suggestions.children().click(); })
          .text( actions[2] );
        header.find(".close-menu")
          .click(function () {
            fulltextMenu.hide();
            individual.set(rel_uri, selected);
          })
          .text( actions[3] );
      });
      if (isSingle) {
        header.hide();
      }

      this.on("view edit search", function (e) {
        e.stopPropagation();
        if (e.type === "search") {
          var isSingle = false || $(this).data("single");
          if (isSingle) {
            header.hide();
          } else {
            header.show();
          }
        }
      });

      var keyupHandler = (function () {
        var timeout;
        var minLength = 3;
        return function (e) {
          if (timeout) { clearTimeout(timeout); }
          var value = e.target.value;
          if (value.length >= minLength) {
            timeout = setTimeout(performSearch, defaultDelay, e, value);
          } else if (!value.length)  {
            if (isSingle) {
              individual.set(rel_uri, []);
            }
            suggestions.empty();
            fulltextMenu.hide();
          }
        }
      }());

      fulltext
        .on("keyup", keyupHandler)
        .on("triggerSearch", performSearch);

      function performSearch (e, value) {
        ftQuery(queryPrefix, value, sort)
          .then(renderResults)
          .catch(function (error) {
            console.log("Fulltext query error", error);
          });
      }

      var suggestionTmpl = '<div class="suggestion" about="@" property="rdfs:label"></div>';
      var selected = [];

      function renderResults(results) {
        selected = individual.get(rel_uri);
        if (results.length) {
          var tmp = $("<div></div>");
          var renderedPromises = results.map(function (result) {
            return result.present(tmp, suggestionTmpl).then(function (tmpl) {
              if (individual.hasValue(rel_uri, result)) {
                tmpl.addClass("selected");
              }
              return tmpl;
            });
          });
          Promise.all(renderedPromises).then(function (rendered) {
            suggestions.empty().append(rendered);
            fulltextMenu.show();
            $(document).click(clickOutsideMenuHandler);
            tmp.remove();
          });
        } else {
          suggestions.empty();
          fulltextMenu.hide();
        }
      }

      var suggestions = $(".suggestions", control);
      suggestions.on("click", ".suggestion", function (e) {
        var tmpl = $(this);
        var suggestion_uri = tmpl.attr("resource");
        var suggestion = new veda.IndividualModel(suggestion_uri);
        tmpl.toggleClass("selected");
        if ( selected.indexOf(suggestion) >= 0 ) {
          if (isSingle) {
            individual
              .set(rel_uri, [])
              .set(rel_uri, [suggestion]);
            fulltextMenu.hide();
          } else {
            selected = selected.filter(function (value) {
              return value !== suggestion;
            });
          }
        } else {
          if (isSingle) {
            individual.set(rel_uri, [suggestion]);
            fulltextMenu.hide();
          } else {
            selected = selected.filter(function (value) {
              return value !== suggestion;
            }).concat(suggestion);
          }
        }
      });

      function clickOutsideMenuHandler(event) {
        if( !$(event.target).closest(fulltextMenu).length ) {
          if( fulltextMenu.is(":visible") ) {
            fulltextMenu.hide();
            removeClickOutsideMenuHandler();
          }
        }
      }
      function removeClickOutsideMenuHandler() {
        if (control.is(":visible")) {
          individual.set(rel_uri, selected);
        }
        $(document).off("click", clickOutsideMenuHandler);
      }

      function propertyModifiedHandler () {
        if ( isSingle && individual.hasValue(rel_uri) ) {
          fulltext.val( renderTemplate( individual.get(rel_uri)[0]) );
        } else if ( isSingle ) {
          fulltext.val("");
        }
      }
      individual.on(rel_uri, propertyModifiedHandler);
      control.one("remove", function () {
        individual.off(rel_uri, propertyModifiedHandler);
      });
      propertyModifiedHandler(rel_uri);

    } else {
      fulltext.remove();
      fulltextMenu.remove();
    }

    // Dropdown feature
    var dropdown = $(".dropdown", control);
    if ( (this.hasClass("dropdown") && this.hasClass("fulltext") || this.hasClass("full")) && queryPrefix ) {
      dropdown.click(function () {
        if ( !fulltextMenu.is(":visible") ) {
          fulltext.trigger("triggerSearch", [""]);
        }
      });
    } else {
      dropdown.remove();
    }

    if ( !$(".fulltext", control).length ) {
      $(".input-group", control).toggleClass("input-group btn-group");
      $(".input-group-addon", control).toggleClass("input-group-addon btn-default btn-primary");
    }

    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "search") {
        isSingle = false || $(this).data("single");
      }
    });

    if (spec && spec.hasValue("v-ui:tooltip")) {
      control.tooltip({
        title: spec["v-ui:tooltip"].join(", "),
        placement: "top",
        container: control,
        trigger: "manual",
        animation: false
      });
      control.one("remove", function () {
        control.tooltip("destroy");
      });
      $("input", control).on("focusin", function () {
        control.tooltip("show");
      }).on("focusout change", function () {
        control.tooltip("hide");
      });
    }

    this.append(control);
    return this;
  };
  $.fn.veda_link.defaults = {
    template: $("#link-control-template").html()
  };

/* UTILS */

  function ftQuery(prefix, input, sort) {
    var queryString = "";
    if ( input ) {
      var lines = input.split("\n");
      var lineQueries = lines.map(function (line) {
        var words = line.trim().replace(/[-*\s]+/g, " ").split(" ");
        return words.map(function (word) { return "'*' == '" + word + "*'" }).join(" && ");
      });
      queryString = lineQueries.join(" || ");
    }
    if (prefix) {
      queryString = queryString ? "(" + prefix + ") && (" + queryString + ")" : prefix ;
    }

    return veda.Backend.query({
      ticket: veda.ticket,
      query: queryString,
      sort: sort ? sort : "'rdfs:label_ru' asc , 'rdfs:label_en' asc , 'rdfs:label' asc",
      top: 100,
      limit: 1000
    }).then(function (queryResult) {

      var toLoad = [];
      var resultIndividuals = queryResult.result.map(function (uri) {
        var individual = new veda.IndividualModel(uri);
        if ( !individual.isLoaded() ) {
          toLoad.push(uri);
        }
        return individual;
      });

      if (!toLoad.length) { return resultIndividuals; }

      return veda.Backend.get_individuals({
        ticket: veda.ticket,
        uris: toLoad
      }).then(function (individuals) {
        individuals.map( function (json) {
          return new veda.IndividualModel(json);
        });
        return resultIndividuals;
      });
    });
  }

})( jQuery );
