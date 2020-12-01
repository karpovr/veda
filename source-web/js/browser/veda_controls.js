// Veda controls implemented as JQuery plugins

"use strict"

import veda from "../common/veda.js";

import jQuery from "jquery";

import autosize from "autosize";

import Util from "../common/util.js";

// INPUT CONTROLS

// Generic literal input behaviour
var veda_literal_input = function( options ) {
  var opts = $.extend( {}, veda_literal_input.defaults, options ),
    input = $(opts.template),
    spec = opts.spec,
    placeholder = this.attr("placeholder") || (spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].map(Util.formatValue).join(" ") : ""),
    property_uri = opts.property_uri,
    individual = opts.individual,
    timeout;

  input.isSingle = typeof opts.isSingle !== "undefined" ? opts.isSingle : (spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true);

  input
    .attr({
      "placeholder": placeholder,
      "name": (individual.hasValue("rdf:type") ? individual["rdf:type"].pop().id + "_" + property_uri : property_uri).toLowerCase().replace(/[-:]/g, "_")
    })
    .on("change focusout", changeHandler)
    .keyup( function (e) {
      if (!input.isSingle) { return; }
      if (e.which === 13) { input.change(); }
      if (timeout) { clearTimeout(timeout); }
      timeout = setTimeout(keyupHandler, 50, e);
    });

  individual.on(property_uri, propertyModifiedHandler);
  input.one("remove", function () {
    individual.off(property_uri, propertyModifiedHandler);
  });
  propertyModifiedHandler();

  function propertyModifiedHandler () {
    if (input.isSingle) {
      var field = input[0];
      var value = veda.Util.formatValue( individual.get(property_uri)[0] );
      value = typeof value !== "undefined" ? value : "";
      if (field.value != value) {
        try {
          var start_shift = field.selectionStart - field.value.length;
          var end_shift = field.selectionEnd - field.value.length;
          field.value = value;
          field.selectionStart = value.length + start_shift;
          field.selectionEnd = value.length + end_shift;
        } catch (ex) {
          field.value = value;
          console.log("selectionStart/End error:", property_uri, value, typeof value);
        }
      }
    }
  }
  function changeHandler (e) {
    var value = opts.parser(this.value);
    if (input.isSingle) {
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
    if (e.which !== 9) { input.focus(); }
  }
  this.on("view edit search", function (e) {
    e.stopPropagation();
  });
  this.val = function (value) {
    if (!value) return input.val();
    return input.val( veda.Util.formatValue(value) );
  };
  if (spec && spec.hasValue("v-ui:tooltip")) {
    input.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "bottom",
      container: "body",
      trigger: "manual",
      animation: false
    }).one("remove", function () {
      input.tooltip("destroy");
    }).on("focusin", function () {
      input.tooltip("show");
    }).on("focusout change", function () {
      input.tooltip("hide");
    });
  }
  return input;
};
veda_literal_input.defaults = {
  template: $("#string-control-template").html(),
  parser: function (input) {
    return (input || null);
  }
};

// Generic input
$.fn.veda_generic = function( options ) {
  var opts = $.extend( {}, $.fn.veda_generic.defaults, options ),
    control = veda_literal_input.call(this, opts);

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  }

  this.append(control);
  return this;
};
$.fn.veda_generic.defaults = {
  template: $("#string-control-template").html(),
  parser: function (input) {
    if (!input || !input.trim()) {
      return null;
    } else if ( Date.parse(input) && (/^\d{4}-\d{2}-\d{2}.*$/).test(input) ) {
      return new Date(input);
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
    return input;
  }
};

// String input
$.fn.veda_string = function( options ) {
  var opts = $.extend( {}, $.fn.veda_string.defaults, options ),
    control = veda_literal_input.call(this, opts);

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  }

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

// Uri input
$.fn.veda_uri = function( options ) {
  var opts = $.extend( {}, $.fn.veda_uri.defaults, options ),
      control = $( opts.template ),
      individual = opts.individual,
      property_uri = opts.property_uri,
      spec = opts.spec,
      timeout;

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  };

  this.on("view edit search", function (e) {
    e.stopPropagation();
  });

  control.attr({
    "placeholder": individual.id
  }).on("change focusout", changeHandler);

  function changeHandler() {
    if (control.val()) {
      individual.id = control.val();
    };
  }

  individual.on("idChanged", function() {
    control.attr("placeholder", individual.id);
  });

  this.append(control);
  return this;
};
$.fn.veda_uri.defaults = {
  template: $("#string-control-template").html()
};

// Text input
$.fn.veda_text = function( options ) {
  var opts = $.extend( {}, $.fn.veda_text.defaults, options ),
    control = veda_literal_input.call(this, opts);

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  }

  control.attr("rows", this.attr("rows"));
  autosize(control);
  this.on("edit", function () {
    autosize.update(control);
  });
  this.one("remove", function () {
    autosize.destroy(control);
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

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  }

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
      mainInput = veda_literal_input.call(this, opts);

  this.append( mainInput.hide() );
  this.append( $("#worktime-control-template").html() );

  var pseudoInputs = $("div.input-group>input", this);
  var summaryText = $("#worktime-summary-text", this);
  fillPseudoInput(mainInput.val());
  pseudoInputs.change(fillMainInput);
  function fillMainInput() {
    var count = pseudoInputs[0].value*480 + pseudoInputs[1].value*60 + pseudoInputs[2].value*1;
    mainInput.val(count);
    summaryText.text(veda.Util.formatValue(count));
    mainInput.change();
  }
  function fillPseudoInput(summaryTime) {
    if (summaryTime) {
      summaryText.text(summaryTime);
      summaryTime = parseInt( summaryTime.split(" ").join("").split(",").join("."), 10 );
      var days = 0, hours = 0, minutes = 0;
      if (summaryTime != 0){
        days = Math.floor(summaryTime/480);
        summaryTime = summaryTime-days*480;
        if (summaryTime != 0){
          hours = Math.floor(summaryTime/60);
          summaryTime = summaryTime-hours*60;
          if (summaryTime != 0){
            minutes = summaryTime;
          }
        }
      }
      pseudoInputs[0].value = days;
      pseudoInputs[1].value = hours;
      pseudoInputs[2].value = minutes;
    }
  }
  this.on("view edit search", function (e) {
    e.stopPropagation();
  });
  return this;
};
$.fn.veda_worktime.defaults = {
  parser: function (input) {
    var int = parseInt( input.split(" ").join("").split(",").join("."), 10 );
    return !isNaN(int) ? int : null;
  }
};

// Decimal control
$.fn.veda_decimal = function( options ) {
  var opts = $.extend( {}, $.fn.veda_decimal.defaults, options ),
    control = veda_literal_input.call(this, opts);

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  }

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

System.import("moment").then(function (module) {
  var moment = module.default;
  System.import("datetimepicker/js/bootstrap-datetimepicker.min.js").then(function () {
    System.import("datetimepicker/css/bootstrap-datetimepicker.min.css").then(function (module) {
      var styleSheet = module.default;
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
    });

    // Datetime control
    var veda_dateTime = function (options) {
      var opts = $.extend( {}, veda_dateTime.defaults, options ),
        control = $(opts.template),
        format = opts.format,
        spec = opts.spec,
        placeholder = this.attr("placeholder") || (spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].map(Util.formatValue).join(" ") : ""),
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
      };

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
        };
      }

      if (spec && spec.hasValue("v-ui:tooltip")) {
        control.tooltip({
          title: spec["v-ui:tooltip"].join(", "),
          placement: "auto left",
          container: "body",
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
        locale: Object.keys(veda.user.preferences.language).length === 1 ? Object.keys(veda.user.preferences.language)[0] : 'EN',
        allowInputToggle: true,
        format: format,
        sideBySide: true,
        useCurrent: true,
        widgetPositioning: {
          horizontal: "auto",
          vertical: "bottom"
        }
      });

      input.on("change focusout", function () {
        var value = opts.parser( this.value );
        change(value);
      });

      this.on("view edit search", function (e) {
        e.stopPropagation();
        if (e.type === "search") {
          change = function (value) {
            individual.set(property_uri, individual.get(property_uri).concat(value));
            input.val("");
          };
        }
      });

      this.val = function (value) {
        if (!value) return input.val();
        return input.val(value);
      };

      this.one("remove", function () {
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

      var tabindex = this.attr("tabindex");
      if (tabindex) {
        this.removeAttr("tabindex");
        control.find("input").attr("tabindex", tabindex);
      }

      this.append(control);
      return this;
    };
    $.fn.veda_date.defaults = {
      template: $("#datetime-control-template").html(),
      parser: function (input) {
        if (input) {
          var timestamp = moment(input, "DD.MM.YYYY").toDate();
          var symbolicDate = new Date(timestamp);
          var d = symbolicDate.getDate();
          var m = symbolicDate.getMonth();
          var y = symbolicDate.getFullYear();
          symbolicDate.setUTCFullYear(y, m ,d);
          symbolicDate.setUTCHours(0, 0, 0, 0);
          return symbolicDate;
        }
        return null;
      },
      format: "DD.MM.YYYY"
    };

    // Time control
    $.fn.veda_time = function( options ) {
      var opts = $.extend( {}, $.fn.veda_time.defaults, options ),
        control = veda_dateTime.call(this, opts);

      var tabindex = this.attr("tabindex");
      if (tabindex) {
        this.removeAttr("tabindex");
        control.find("input").attr("tabindex", tabindex);
      }

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

      var tabindex = this.attr("tabindex");
      if (tabindex) {
        this.removeAttr("tabindex");
        control.find("input").attr("tabindex", tabindex);
      }

      this.append(control);
      return this;
    };
    $.fn.veda_dateTime.defaults = {
      template: $("#datetime-control-template").html(),
      parser: function (input) {
        if (input) {
          var timestamp = moment(input, "DD.MM.YYYY HH:mm").toDate();
          var absolutDate = new Date(timestamp);
          absolutDate.setMilliseconds(1);
          return absolutDate;
        }
        return null;
      },
      format: "DD.MM.YYYY HH:mm"
    };
  });
});

// MULTILINGUAL INPUT CONTROLS

// Generic multilingual input behaviour
var veda_multilingual = function( options ) {
  var opts = $.extend( {}, veda_multilingual.defaults, options ),
    that = this,
    individual = opts.individual,
    property_uri = opts.property_uri,
    spec = opts.spec,
    placeholder = this.attr("placeholder") || (spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].map(Util.formatValue).join(" ") : ""),
    timeout;

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    this.find("input").attr("tabindex", tabindex);
  }

  Object.keys(veda.user.preferences.language).map(function (language_name) {
    var localedInput = $(opts.template);

    localedInput.find(".language-tag").text(language_name);

    var formControl = localedInput.find(".form-control");
    formControl
      .attr({
        "lang": language_name,
        "placeholder": placeholder,
        "name": (individual.hasValue("rdf:type") ? individual["rdf:type"].pop().id + "_" + property_uri : property_uri).toLowerCase().replace(/[-:]/g, "_")
      })
      .on("change focusout", function () {
        var values = that.find(".form-control").map(function () {
          return opts.parser( this.value, this );
        }).get();
        individual.set(property_uri, values);
      })
      .keyup( function (e) {
        if (e.which === 13) { formControl.change(); }
        if (timeout) { clearTimeout(timeout); }
        timeout = setTimeout(keyupHandler, 50, e);
      });

    individual.get(property_uri).forEach(function (value) {
      if ( value.language === language_name || !value.language ) {
        formControl.val(value);
      }
    });

    that.append( localedInput );
  });

  var input = that.find(".form-control");

  individual.on(property_uri, handler);
  that.one("remove", function () {
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
    if (e.which !== 9) { input.focus(); }
  }

  function handler (values) {
    input.each(function () {
      var that = this;
      var lang = this.lang;
      individual.get(property_uri).forEach(function (value) {
        if ( value.language === lang || !value.language && that.value != value) {
          try {
            if (that === document.activeElement) {
              var start_shift = that.selectionStart - that.value.length;
              var end_shift = that.selectionEnd - that.value.length;
              that.value = value;
              that.selectionStart = value.length + start_shift;
              that.selectionEnd = value.length + end_shift;
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

  that.on("view edit search", function (e) {
    e.stopPropagation();
  });

  that.val = function (value) {
    if (!value) {
      return parser( input.val() );
    }
    input.each(function () {
      if (value.language === this.lang || !value.language) {
        this.value = value.toString();
      }
    });
  };

  if (spec && spec.hasValue("v-ui:tooltip")) {
    that.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "bottom",
      container: "body",
      trigger: "manual",
      animation: false
    }).one("remove", function () {
      that.tooltip("destroy");
    });
    input.on("focusin", function () {
      that.tooltip("show");
    }).on("focusout change", function () {
      that.tooltip("hide");
    });
  }

  return that;
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
      that = $(this);
  init();
  veda.on("language:changed", init);
  that.one("remove", function () {
    veda.off("language:changed", init);
  });
  function init() {
    that.empty();
    veda_multilingual.call(that, opts);
  }
  return this;
};
$.fn.veda_multilingualString.defaults = {
  template: $("#multilingual-string-control-template").html(),
};

// Multilingual text control
$.fn.veda_multilingualText = function (options) {
  var opts = $.extend( {}, $.fn.veda_multilingualText.defaults, options ),
    that = $(this);
  init();
  veda.on("language:changed", init);
  that.one("remove", function () {
    veda.off("language:changed", init);
  });
  function init() {
    that.empty();
    veda_multilingual.call(that, opts);
    var ta = $("textarea", that);
    ta.attr("rows", that.attr("rows"));
    autosize(ta);
    that.on("edit", function () {
      autosize.update(ta);
    });
    that.one("remove", function () {
      autosize.destroy(ta);
    });
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
    individual = opts.individual,
    property_uri = opts.property_uri,
    spec = opts.spec;

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  }

  function handler (doc_property_uri) {
    if (individual.hasValue(property_uri)) {
      if (individual.get(property_uri)[0] === true) {
        control.prop("checked", true).prop("readonly", false).prop("indeterminate", false);
      } else {
        control.prop("checked", false).prop("readonly", false).prop("indeterminate", false);
      }
    } else {
      control.prop("readonly", true).prop("indeterminate", true);
    }
  }
  handler();

  individual.on(property_uri, handler);
  this.one("remove", function () {
    individual.off(property_uri, handler);
  });

  control.click( function () {
    if ( control.prop("readonly") ) {
      individual.set(property_uri, [false]);
    } else if ( !control.prop("checked") ) {
      individual.set(property_uri, []);
    } else {
      individual.set(property_uri, [true]);
    }
  });

  if ( control.closest(".checkbox.disabled").length ) {
    control.attr("disabled", "disabled");
  }

  this.on("view edit search", function (e) {
    e.stopPropagation();
    if (e.type === "view") {
      control.attr("disabled", "disabled");
    } else {
      if ( control.closest(".checkbox.disabled").length ) {
        control.attr("disabled", "disabled");
      } else {
        control.removeAttr("disabled");
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

// ACTOR CONTROL
$.fn.veda_actor = function( options ) {
  var opts = $.extend( {}, $.fn.veda_actor.defaults, options ),
    control = $( opts.template ),
    individual = opts.individual,
    rel_uri = opts.property_uri,
    spec = opts.spec,
    placeholder = this.data("placeholder") || ( spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].map(Util.formatValue).join(" ") : new veda.IndividualModel("v-s:StartTypingBundle") ),
    specQueryPrefix = this.data("query-prefix") || ( spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0].toString() : undefined),
    queryPrefix,
    sort = this.data("sort") || ( spec && spec.hasValue("v-ui:sort") ? spec["v-ui:sort"][0].toString() : "'rdfs:label_ru' asc , 'rdfs:label_en' asc , 'rdfs:label' asc" ),
    actorType = this.data("actor-type") || "v-s:Appointment v-s:Person v-s:Position v-s:Department",
    complex = this.data("complex") || false,
    isSingle = this.data("single") || ( spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true ),
    withDeleted = false || this.attr("data-deleted"),
    chosenActorType,
    fullName,
    onlyDeleted;

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.find("textarea").attr("tabindex", tabindex);
  }

  // Fulltext search feature
  var fulltext = $(".fulltext", control);
  var fulltextMenu = $(".fulltext-menu", control);

  // Disable closing actor type dropdown on click
  $(".dropdown-menu", control).click(function (e) {
    e.stopPropagation();
  });

  // Close actor type dropdown on input click
  fulltext.click(function () {
    $(".dropdown-toggle", control).attr("aria-expanded", false).parent().removeClass("open");
  });

  // Filter allowed actor types, set label & handler
  $("[name='actor-type']", control).filter(function () {
    if (actorType.indexOf(this.value) < 0) {
      $(this).closest(".radio").remove();
      return false;
    } else {
      $(this).parent().append( new veda.IndividualModel(this.value).toString() );
      return true;
    }
  }).change(function () {
    $(".tree", control).hide();
    if ( $(this).is(":checked") ) {
      chosenActorType = this.value;
      if ( chosenActorType === "v-s:Appointment" || chosenActorType === "v-s:Person" || chosenActorType === "v-s:Position" ) {
        $("[name='full-name']", control).parent().parent().show();
        queryPrefix = "'rdf:type' === 'v-s:Appointment'";
      } else if (chosenActorType === "v-s:Department") {
        $("[name='full-name']", control).parent().parent().hide();
        queryPrefix = "'rdf:type' === 'v-s:Appointment' || 'rdf:type' === 'v-s:Department'";
        $(".tree", control).show();
      }
      queryPrefix = specQueryPrefix || queryPrefix ;
      var ftValue = $(".fulltext", control).val();
      if (ftValue) {
        performSearch(ftValue);
      }
    }
  }).first().prop("checked", "checked").change();

  // Full name check label & handler
  $("[name='full-name']", control).each(function () {
    var label = new veda.IndividualModel(this.value);
    var that = this;
    label.load().then(function (label) {
      $(that).parent().append( new veda.IndividualModel(that.value).toString() );
    });
  }).change(function () {
    fullName = $(this).is(":checked") ? true : false;
    var ftValue = $(".fulltext", control).val();
    if (ftValue) {
      performSearch(ftValue);
    }
  });

  $("[name='only-deleted']", control).each(function () {
    var label = new veda.IndividualModel(this.value);
    var that = this;
    label.load().then(function (label) {
      $(that).parent().append( new veda.IndividualModel(that.value).toString() );
    });
  }).change(function () {
    onlyDeleted = $(this).is(":checked") ? true : false;
    var ftValue = $(".fulltext", control).val();
    if (ftValue) {
      performSearch(ftValue);
    }
  });

  $(".clear", control).on("click keydown", function (e) {
    if (isSingle) {
      if (e.type !== "click" && e.which !== 13 && e.which !== 32) { return; }
      e.preventDefault();
      e.stopPropagation();
      individual.clearValue(rel_uri);
      if ( complex ) {
        individual.clearValue(rel_uri + ".v-s:employee");
        individual.clearValue(rel_uri + ".v-s:occupation");
      }
    }
    fulltextMenu.hide();
    $(document).off("click", clickOutsideMenuHandler);
    $(document).off("keydown", arrowHandler);
    fulltext.val("").focus();
  });

  // Tree feature
  $(".tree", control).on("click keydown", function (e) {
    var treeTmpl = new veda.IndividualModel("v-ui:TreeTemplate");
    var modal = $("#individual-modal-template").html();
    if (e.type !== "click" && e.which !== 13 && e.which !== 32) { return; }
    e.preventDefault();
    e.stopPropagation();
    var $modal = $(modal);
    var cntr = $(".modal-body", $modal);
    $modal.on('hidden.bs.modal', function (e) {
      $modal.remove();
    });
    $modal.modal();
    $("body").append($modal);

    var extra = {
      target: individual,
      target_rel_uri: rel_uri,
      isSingle: isSingle,
      withDeleted: withDeleted,
      sort: sort
    };
    spec.present(cntr, treeTmpl, undefined, extra);
  });

  if (placeholder instanceof veda.IndividualModel) {
    placeholder.load().then(function (placeholder) {
      fulltext.attr({
        "placeholder": placeholder.toString(),
        "name": (individual.hasValue("rdf:type") ? individual["rdf:type"][0].id + "_" + rel_uri : rel_uri).toLowerCase().replace(/[-:]/g, "_")
      });
    });
  } else {
    fulltext.attr({
      "placeholder": placeholder,
      "name": (individual.hasValue("rdf:type") ? individual["rdf:type"][0].id + "_" + rel_uri : rel_uri).toLowerCase().replace(/[-:]/g, "_")
    });
  }

  fulltext.on("input change focus blur", function (e) {
    var fulltext = $(e.target);
    var value = fulltext.val();
    if (value) {
      var rows = value.split("\n").length;
      fulltext.prop("rows", rows);
    } else {
      fulltext.prop("rows", 1);
    }
  });

  var header = $(".header", control);
  Promise.all([
    new veda.IndividualModel("v-s:SelectAll").load(),
    new veda.IndividualModel("v-s:CancelSelection").load(),
    new veda.IndividualModel("v-s:InvertSelection").load()
  ]).then(function (actions) {
    header.find(".select-all")
      .click(function () { suggestions.children(":not(.selected)").click(); })
      .text( actions[0].toString() );
    header.find(".cancel-selection")
      .click(function () { suggestions.children(".selected").click(); })
      .text( actions[1].toString() );
    header.find(".invert-selection")
      .click(function () { suggestions.children().click(); })
      .text( actions[2].toString() );
    header.find(".close-menu")
      .click(function () {
        individual.set(rel_uri, selected);
        fulltextMenu.hide();
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
      })
      .text( "Ok" );
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

  var inputHandler = (function () {
    var timeout;
    var minLength = 3;
    var nav_keys = [37, 38, 39, 40, 9, 16]; // Arrows, shift, tab
    return function (e) {
      if (timeout) { clearTimeout(timeout); }
      if (nav_keys.indexOf(e.which) >= 0) { return; }
      timeout = setTimeout(function () {
        var value = e.target.value;
        if (value.length >= minLength) {
          performSearch(value);
        } else if (!value.length) {
          if (isSingle) {
            individual.clearValue(rel_uri);
          }
          suggestions.empty();
          fulltextMenu.hide();
          $(document).off("click", clickOutsideMenuHandler);
          $(document).off("keydown", arrowHandler);
        }
      }, 750);
    };
  }());
  fulltext.on("keydown", inputHandler);

  function performSearch(value) {
    if ( chosenActorType === "v-s:Appointment" || chosenActorType === "v-s:Person" || chosenActorType === "v-s:Position" ) {
      if ( fullName ) {
        value = value.trim().split("\n").map(function (line) {
          var fullNameProps = ["v-s:employee.v-s:lastName", "v-s:employee.v-s:firstName",  "v-s:employee.v-s:middleName"];
          var fullNameInput = line.trim().replace(/\s+/g, " ").split(" ");
          var fullNameQuery = fullNameInput.map(function (token, i) {
            if (i < 3 && token) {
              return "'" + fullNameProps[i] + "'=='" + token + "*'";
            }
          }).filter(Boolean).join(" && ");
          return fullNameQuery;
        }).join("\n");
      }
    }
    var ftQueryPromise;
    if (onlyDeleted) {
      ftQueryPromise = ftQuery(queryPrefix + " && 'v-s:deleted'=='true'", value, sort, withDeleted);
    } else {
      ftQueryPromise = ftQuery(queryPrefix, value, sort, withDeleted);
    }
    ftQueryPromise
      .then(renderResults)
      .catch(function (error) {
        console.log("Fulltext query error", error);
      });
  }

  var selected = [];

  function renderResults(results) {
    selected = individual.get(rel_uri).concat(individual.get(rel_uri + ".v-s:employee"), individual.get(rel_uri + ".v-s:occupation"), individual.get(rel_uri + ".v-s:parentUnit"));
    if (results.length) {
      var renderedPromises = results.map(function (result) {
        var cont = $("<a href='#' class='suggestion'></a>").attr("resource", result.id);
        if (individual.hasValue(rel_uri, result) || individual.hasValue(rel_uri + ".v-s:employee", result) || individual.hasValue(rel_uri + ".v-s:occupation", result) || individual.hasValue(rel_uri + ".v-s:parentUnit", result)) {
          cont.addClass("selected");
        }
        var tmpl;
        if ( chosenActorType === "v-s:Department" && result.hasValue("rdf:type", "v-s:Appointment") ) {
          tmpl = "<span about='@' rel='v-s:parentUnit' data-template='v-ui:LabelTemplate'></span>"
        } else {
          tmpl = "<span about='@' property='rdfs:label'></span>"
        }
        return result.present(cont, tmpl)
          .then(function () {
            return cont;
          });
      });
      Promise.all(renderedPromises).then(function (rendered) {
        rendered = rendered.sort(function (a, b) {
          return a.text() < b.text() ? -1 : 1;
        }).reduce(function (acc, curr) {
          if ( !acc.length || acc[acc.length - 1].text() !== curr.text() ) {
            acc.push(curr);
          }
          return acc;
        }, []);
        suggestions.empty().append(rendered);
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
        fulltextMenu.show();
        $(document).on("click", clickOutsideMenuHandler);
        $(document).on("keydown", arrowHandler);
      }).catch(console.log);
    } else {
      suggestions.empty();
      fulltextMenu.hide();
      $(document).off("click", clickOutsideMenuHandler);
      $(document).off("keydown", arrowHandler);
    }
  }

  var suggestions = $(".suggestions", control);
  var dblTimeout;
  suggestions.on("click", ".suggestion", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.originalEvent) {
      clickHandler(e);
    } else if (dblTimeout) {
      dblclickHandler(e);
    } else {
      clickHandler(e);
    }
  }).on("keydown", ".suggestion", function (e) {
    if (e.which === 32) {
      e.preventDefault();
      e.stopPropagation();
      clickHandler(e);
    } else if (e.which === 13) {
      e.preventDefault();
      e.stopPropagation();
      dblclickHandler(e);
    }
  }).on("dblclick", ".suggestion", function (e) {
    e.preventDefault();
  });

  function clickHandler(e) {
    e.preventDefault();
    var tmpl = $(e.currentTarget);
    var suggestion_uri = tmpl.attr("resource");
    if (!suggestion_uri) { return; }
    var suggestion = new veda.IndividualModel(suggestion_uri);
    tmpl.toggleClass("selected");
    if (isSingle) { tmpl.siblings().removeClass("selected"); }
    if ( selected.indexOf(suggestion) >= 0 ) {
      if (isSingle) {
        selected = [suggestion];
        setValue(selected);
        fulltextMenu.hide();
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
      } else {
        selected = selected.filter(function (value) {
          return value !== suggestion;
        });
      }
    } else {
      if (isSingle) {
        selected = [suggestion];
        setValue(selected);
        fulltextMenu.hide();
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
      } else {
        selected.push(suggestion);
      }
    }
    dblTimeout = setTimeout(function () {
      dblTimeout = undefined;
    }, 300);
    fulltext.focus();
  }

  function dblclickHandler(e) {
    e.preventDefault();
    if ( !$(e.target).hasClass("selected") ) {
      clickHandler(e);
    }
    dblTimeout = clearTimeout(dblTimeout);
    setValue(selected);
    fulltextMenu.hide();
    $(document).off("click", clickOutsideMenuHandler);
    $(document).off("keydown", arrowHandler);
    fulltext.focus();
  }

  function clickOutsideMenuHandler(e) {
    if( !$(e.target).closest(fulltextMenu).length && e.target !== fulltext[0] ) {
      if( fulltextMenu.is(":visible") ) {
        if ( selected.length ) {
          setValue(selected);
        }
        fulltextMenu.hide();
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
      }
    }
  }

  function arrowHandler(e) {
    if ( e.which === 40 ) { // Down
      e.preventDefault();
      e.stopPropagation();
      var active = suggestions.find(".active").removeClass("active");
      var next = active.next();
      if ( next.length ) {
        next.addClass("active").focus();
      } else {
        suggestions.children().first().addClass("active").focus();
      }
    } else if ( e.which === 38 ) { // Up
      e.preventDefault();
      e.stopPropagation();
      var active = suggestions.find(".active").removeClass("active");
      var prev = active.prev();
      if ( prev.length ) {
        prev.addClass("active").focus();
      } else {
        suggestions.children().last().addClass("active").focus();
      }
    } else if ( e.which === 32 && fulltextMenu.find(":focus").length ) { // Space
      e.preventDefault(); // Prevent scrolling on space
    }
  }

  function setValue(values) {
    if ( complex ) {
      individual.clearValue(rel_uri);
      individual.clearValue(rel_uri + ".v-s:employee");
      individual.clearValue(rel_uri + ".v-s:occupation");
      individual.clearValue(rel_uri + ".v-s:parentUnit");
      if (chosenActorType === "v-s:Appointment") {
        individual.set(rel_uri, values);
      } else if (chosenActorType === "v-s:Person") {
        Promise.all(values.map(function (value) {
          if ( value.hasValue("rdf:type", "v-s:Appointment") ) {
            return value["v-s:employee"][0].load();
          } else if ( value.hasValue("rdf:type", "v-s:Person") ) {
            return value;
          }
        })).then(function (persons) {
          individual.set(rel_uri + ".v-s:employee", persons);
        });
      } else if (chosenActorType === "v-s:Position") {
        Promise.all(values.map(function (value) {
          if ( value.hasValue("rdf:type", "v-s:Appointment") ) {
            return value["v-s:occupation"][0].load();
          } else if ( value.hasValue("rdf:type", "v-s:Position") ) {
            return value;
          }
        })).then(function (positions) {
          individual.set(rel_uri + ".v-s:occupation", positions);
        });
      } else if (chosenActorType === "v-s:Department") {
        Promise.all(values.map(function (value) {
          if ( value.hasValue("rdf:type", "v-s:Appointment") ) {
            return value["v-s:parentUnit"][0].load();
          } else if ( value.hasValue("rdf:type", "v-s:Department") ) {
            return value;
          }
        })).then(function (departments) {
          individual.set(rel_uri + ".v-s:parentUnit", departments);
        });
      }
    } else {
      individual.clearValue(rel_uri);
      if (chosenActorType === "v-s:Appointment") {
        individual.set(rel_uri, values);
      } else if (chosenActorType === "v-s:Person") {
        Promise.all(values.map(function (value) {
          if ( value.hasValue("rdf:type", "v-s:Appointment") ) {
            return value["v-s:employee"][0].load();
          } else if ( value.hasValue("rdf:type", "v-s:Person") ) {
            return value;
          }
        })).then(function (persons) {
          individual.set(rel_uri, persons);
        });
      } else if (chosenActorType === "v-s:Position") {
        Promise.all(values.map(function (value) {
          if ( value.hasValue("rdf:type", "v-s:Appointment") ) {
            return value["v-s:occupation"][0].load();
          } else if ( value.hasValue("rdf:type", "v-s:Position") ) {
            return value;
          }
        })).then(function (positions) {
          individual.set(rel_uri, positions);
        });
      } else if (chosenActorType === "v-s:Department") {
        Promise.all(values.map(function (value) {
          if ( value.hasValue("rdf:type", "v-s:Appointment") ) {
            return value["v-s:parentUnit"][0].load();
          } else if ( value.hasValue("rdf:type", "v-s:Department") ) {
            return value;
          }
        })).then(function (departments) {
          individual.set(rel_uri, departments);
        });
      }
    }
  }

  function propertyModifiedHandler(values) {
    if ( isSingle && (individual.hasValue(rel_uri) || individual.hasValue(rel_uri + ".v-s:employee") || individual.hasValue(rel_uri + ".v-s:occupation") || individual.hasValue(rel_uri + ".v-s:parentUnit")) ) {
      var value = individual.get(rel_uri).concat(individual.get(rel_uri + ".v-s:employee"), individual.get(rel_uri + ".v-s:occupation"), individual.get(rel_uri + ".v-s:parentUnit")).filter(Boolean)[0];
      value.load().then(function(value) {
        var newValueStr = value.toString();
        var oldValueStr = fulltext.val();
        if (newValueStr != oldValueStr) {
          fulltext.val(newValueStr);
        }
      });
    } else {
      fulltext.val("");
    }
  }
  individual.on( [rel_uri, rel_uri + ".v-s:employee", rel_uri + ".v-s:occupation", rel_uri + ".v-s:parentUnit"].join(" ") , propertyModifiedHandler);
  control.one("remove", function () {
    individual.off( [rel_uri, rel_uri + ".v-s:employee", rel_uri + ".v-s:occupation", rel_uri + ".v-s:parentUnit"].join(" ") , propertyModifiedHandler);
  });
  propertyModifiedHandler();

  this.on("view edit search", function (e) {
    e.stopPropagation();
  });
  this.append(control);
  return this;
};
$.fn.veda_actor.defaults = {
  template: $("#actor-control-template").html(),
};

// SELECT CONTROL

$.fn.veda_select = function (options) {
  var opts = $.extend( {}, $.fn.veda_select.defaults, options ),
    control = $(opts.template),
    individual = opts.individual,
    property_uri = opts.property_uri || opts.rel_uri,
    spec = opts.spec,
    first_opt = $("option", control),
    rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
    range = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(property_uri))["rdfs:range"],
    queryPrefix = this.attr("data-query-prefix") || ( spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0] : range.map(function (item) { return "'rdf:type'==='" + item.id + "'"; }).join(" || ") ),
    sort = this.attr("data-sort") || ( spec && spec.hasValue("v-ui:sort") ? spec["v-ui:sort"][0].toString() : "'rdfs:label_ru' asc , 'rdfs:label_en' asc , 'rdfs:label' asc" ),
    placeholder = this.attr("placeholder") || ( spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].map(Util.formatValue).join(" ") : new veda.IndividualModel("v-s:SelectValueBundle") ),
    source = this.attr("data-source") || undefined,
    template = this.attr("data-template") || undefined,
    options = [],
    isSingle = ( spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true ) || this.data("single"),
    withDeleted = false || this.data("deleted");

  if (placeholder instanceof veda.IndividualModel) {
    placeholder.load().then(function (placeholderLoaded) {
      placeholder = placeholderLoaded.toString();
      populate();
    });
  } else {
    populate();
  }

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.attr("tabindex", tabindex);
  }

  control.on("mousedown", function (e) {
    populate();
  });

  control.change(function () {
    var value = $("option:selected", control).data("value");
    if (isSingle) {
      individual.set(property_uri, [value]);
    } else {
      if ( !individual.hasValue(property_uri, value) ) {
        individual.addValue(property_uri, value);
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
          return interpolate(template);
        } else {
          return individual.toString();
        }
      });
    } else {
      return Promise.resolve(veda.Util.formatValue(value));
    }
  }

  function interpolate (str) {
    try {
      var result = str.replace(/{\s*.*?\s*}/g, function (match) {
        return eval(match);
      });
      return Promise.resolve(result);
    } catch (error) {
      console.log("Interpolation error", str);
      return Promise.reject(error);
    }
  }

  function populate() {
    if (spec && spec.hasValue("v-ui:optionValue")) {
      options = spec["v-ui:optionValue"];
      return renderOptions(options);
    } else if (source) {
      return Promise.resolve(eval(source))
        .then(renderOptions)
        .catch(function (error) {
          console.log("Source error", source);
        });
    } else if (queryPrefix) {
      return interpolate(queryPrefix)
        .then(function (queryPrefix) {
          return ftQuery(queryPrefix, undefined, sort, withDeleted);
        })
        .then(renderOptions)
        .catch(function (error) {
          console.log("Query prefix error", queryPrefix);
        });
    }
  }

  function renderOptions(options) {
    control.empty();
    first_opt.text(placeholder).data("value", null).appendTo(control);
    var optionsPromises = options.map(function (value, index) {
      if (index >= 100) { return; }
      var opt = first_opt.clone().appendTo(control);
      return renderValue(value).then(function (rendered) {
        opt.text(rendered).data("value", value);
        if (value instanceof veda.IndividualModel && value.hasValue("v-s:deleted", true)) {
          opt.addClass("deleted");
        }
        if ( isSingle && individual.hasValue(property_uri, value) ) {
          opt.prop("selected", true);
        }
        return rendered;
      });
    });
    return Promise.all(optionsPromises);
  }

  function handler() {
    if (isSingle) {
      populate().then(function () {
        $("option", control).each(function () {
          var value = $(this).data("value");
          var hasValue = !!value && individual.hasValue(property_uri, value);
          $(this).prop("selected", hasValue);
        });
      });
    }
  }

  if (spec && spec.hasValue("v-ui:tooltip")) {
    control.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "top",
      container: "body",
      trigger: "hover",
      animation: false
    });
    control.one("remove", function () {
      control.tooltip("destroy");
    });
  }

  this.on("view edit search", function (e) {
    e.stopPropagation();
    if (e.type === "search") {
      var dataDeleted = $(this).data("deleted");
      withDeleted = typeof dataDeleted === "boolean" ? dataDeleted : true;
    }
  });
  this.on("update", function (e) {
    e.stopPropagation();
    populate();
  });
  this.append(control);
  return this;
};
$.fn.veda_select.defaults = {
  template: $("#select-control-template").html(),
};

// CHECKBOX GROUP CONTROL

$.fn.veda_checkbox = function (options) {
  var opts = $.extend( {}, $.fn.veda_checkbox.defaults, options ),
    that = this,
    individual = opts.individual,
    property_uri = opts.property_uri || opts.rel_uri,
    parser = opts.parser,
    spec = opts.spec,
    rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
    range = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(property_uri))["rdfs:range"],
    queryPrefix = this.attr("data-query-prefix") || ( spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0] : range.map(function (item) { return "'rdf:type'==='" + item.id + "'"; }).join(" || ") ),
    sort = this.attr("data-sort") || ( spec && spec.hasValue("v-ui:sort") ? spec["v-ui:sort"][0].toString() : "'rdfs:label_ru' asc , 'rdfs:label_en' asc , 'rdfs:label' asc" ),
    source = this.attr("data-source") || undefined,
    template = this.attr("data-template") || undefined,
    options = [],
    withDeleted = false || this.data("deleted");

  populate();

  individual.on(property_uri, handler);
  this.one("remove", function () {
    individual.off(property_uri, handler);
  });

  if (template) {
    this.removeAttr("data-template");
  }

  function interpolate (str) {
    try {
      var result = str.replace(/{\s*.*?\s*}/g, function (match) {
        return eval(match);
      });
      return Promise.resolve(result);
    } catch (error) {
      console.log("Interpolation error", str);
      return Promise.reject(error);
    }
  }

  function renderValue (value) {
    if (value instanceof veda.IndividualModel) {
      return value.load().then(function (individual) {
        if (template) {
          return interpolate(template);
        } else {
          return individual.toString();
        }
      });
    } else {
      return Promise.resolve(veda.Util.formatValue(value));
    }
  }

  function populate() {
    if (spec && spec.hasValue("v-ui:optionValue")) {
      options = spec["v-ui:optionValue"];
      return renderOptions(options);
    } else if (source) {
      return Promise.resolve(eval(source))
        .then(renderOptions)
        .catch(function (error) {
          console.log("Source error", source);
        });
    } else if (queryPrefix) {
      return interpolate(queryPrefix)
        .then(function (queryPrefix) {
          return ftQuery(queryPrefix, undefined, sort, withDeleted);
        })
        .then(renderOptions)
        .catch(function (error) {
          console.log("Query prefix error", queryPrefix);
        });
    }
  }

  function renderOptions(options) {
    that.empty();
    var optionsPromises = options.map(function (value, index) {
      if (index >= 100) { return; }
      var hld = $(opts.template).appendTo(that);
      return renderValue(value).then(function (rendered) {
        var lbl = $("label", hld).append( rendered );
        var chk = $("input", lbl).data("value", value);
        if (value instanceof veda.IndividualModel && value.hasValue("v-s:deleted", true)) {
          hld.addClass("deleted");
        }
        var hasValue = individual.hasValue(property_uri, value);
        chk.prop("checked", hasValue);
        chk.change(function () {
          if ( chk.is(":checked") ) {
            individual.addValue(property_uri, value);
          } else {
            individual.removeValue(property_uri, value);
          }
        });
        if (opts.mode === "view") {
          hld.addClass("disabled");
          chk.attr("disabled", "disabled");
        }
      });
    });
    return Promise.all(optionsPromises);
  }

  function handler(doc_property_uri) {
    $("input", that).each(function () {
      var value = $(this).data("value");
      var hasValue = individual.hasValue(property_uri, value);
      $(this).prop("checked", hasValue);
    });
  }

  if (spec && spec.hasValue("v-ui:tooltip")) {
    this.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "left",
      container: "body",
      trigger: "hover",
      animation: false
    }).one("remove", function () {
      $(this).tooltip("destroy");
    });
  }

  this.on("update", function (e) {
    e.stopPropagation();
    populate();
  });

  this.on("view edit search", function (e) {
    e.stopPropagation();
    if (e.type === "view") {
      $(this).children().addClass("disabled");
      $("input", this).attr("disabled", "true");
    } else {
      $(this).children().removeClass("disabled");
      $("input", this).removeAttr("disabled");
    }
    if (e.type === "search") {
      var dataDeleted = $(this).data("deleted");
      withDeleted = typeof dataDeleted === "boolean" ? dataDeleted : true;
    }
  });
  return this;
};
$.fn.veda_checkbox.defaults = {
  template: $("#checkbox-control-template").html(),
};

// RADIO GROUP CONTROL

$.fn.veda_radio = function (options) {
  var opts = $.extend( {}, $.fn.veda_radio.defaults, options ),
    that = this,
    individual = opts.individual,
    property_uri = opts.property_uri || opts.rel_uri,
    parser = opts.parser,
    spec = opts.spec,
    rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
    range = rangeRestriction ? [ rangeRestriction ] : (new veda.IndividualModel(property_uri))["rdfs:range"],
    queryPrefix = this.attr("data-query-prefix") || ( spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0] : range.map(function (item) { return "'rdf:type'==='" + item.id + "'"; }).join(" || ") ),
    sort = this.attr("data-sort") || ( spec && spec.hasValue("v-ui:sort") ? spec["v-ui:sort"][0].toString() : "'rdfs:label_ru' asc , 'rdfs:label_en' asc , 'rdfs:label' asc" ),
    source = this.attr("data-source") || undefined,
    template = this.attr("data-template") || undefined,
    options = [],
    withDeleted = false || this.data("deleted");

  populate();

  individual.on(property_uri, changeHandler);
  this.one("remove", function () {
    individual.off(property_uri, changeHandler);
  });

  if (template) {
    this.removeAttr("data-template");
  }

  function interpolate (str) {
    try {
      var result = str.replace(/{\s*.*?\s*}/g, function (match) {
        return eval(match);
      });
      return Promise.resolve(result);
    } catch (error) {
      console.log("Interpolation error", str);
      return Promise.reject(error);
    }
  }

  function renderValue (value) {
    if (value instanceof veda.IndividualModel) {
      return value.load().then(function (individual) {
        if (template) {
          return interpolate(template);
        } else {
          return individual.toString();
        }
      });
    } else {
      return Promise.resolve(veda.Util.formatValue(value));
    }
  }

  function populate() {
    if (spec && spec.hasValue("v-ui:optionValue")) {
      options = spec["v-ui:optionValue"];
      return renderOptions(options);
    } else if (source) {
      return Promise.resolve(eval(source))
        .then(renderOptions)
        .catch(function (error) {
          console.log("Source error", source);
        });
    } else if (queryPrefix) {
      return interpolate(queryPrefix)
        .then(function (queryPrefix) {
          return ftQuery(queryPrefix, undefined, sort, withDeleted);
        })
        .then(renderOptions)
        .catch(function (error) {
          console.log("Query prefix error", queryPrefix);
        });
    }
  }

  function renderOptions(options) {
    that.empty();
    var optionsPromises = options.map(function (value, index) {
      if (index >= 100) { return; }
      var hld = $(opts.template).appendTo(that);
      return renderValue(value).then(function (rendered) {
        var lbl = $("label", hld).append( rendered );
        var rad = $("input", lbl).data("value", value);
        if (value instanceof veda.IndividualModel && value.hasValue("v-s:deleted", true)) {
          hld.addClass("deleted");
        }
        var hasValue = individual.hasValue(property_uri, value);
        rad.prop("checked", hasValue);
        rad.change(function () {
          if ( rad.is(":checked") ) {
            individual.set(property_uri, [value]);
          } else {
            individual.removeValue(property_uri, value);
          }
        });
        if (opts.mode === "view") {
          hld.addClass("disabled");
          rad.attr("disabled", "disabled");
        }
      });
    });
  }

  function changeHandler() {
    $("input", that).each(function () {
      var value = $(this).data("value");
      var hasValue = individual.hasValue(property_uri, value);
      $(this).prop("checked", hasValue);
    });
  }

  if (spec && spec.hasValue("v-ui:tooltip")) {
    this.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "left",
      container: "body",
      trigger: "hover",
      animation: false
    }).one("remove", function () {
      $(this).tooltip("destroy");
    });
  }

  this.on("update", function (e) {
    e.stopPropagation();
    populate();
  });

  this.on("view edit search", function (e) {
    e.stopPropagation();
    if (e.type === "view") {
      $("div.radio", this).addClass("disabled");
      $("input", this).attr("disabled", "true");
    } else {
      $("div.radio", this).removeClass("disabled");
      $("input", this).removeAttr("disabled");
    }
    if (e.type === "search") {
      var dataDeleted = $(this).data("deleted");
      withDeleted = typeof dataDeleted === "boolean" ? dataDeleted : true;
    }
  });
  return this;
};
$.fn.veda_radio.defaults = {
  template: $("#radio-control-template").html(),
};

//BOOLEAN RADIO

$.fn.veda_booleanRadio = function (options) {
  var opts = $.extend( {}, $.fn.veda_booleanRadio.defaults, options ),
    that = this,
    individual = opts.individual,
    property_uri = opts.property_uri || opts.rel_uri,
    spec = opts.spec,
    trueOption = {
      label: spec && spec.hasValue("v-ui:trueLabel") ?
        Promise.resolve(spec.get("v-ui:trueLabel").map(Util.formatValue).join(" ")) :
        (new veda.IndividualModel("v-s:YesBundle")).load().then(function(loaded) {
          return loaded.get("rdfs:label").map(Util.formatValue).join(" ");
        }),
      value: true
    },
    falseOption = {
      label: spec && spec.hasValue("v-ui:falseLabel") ?
        Promise.resolve(spec.get("v-ui:falseLabel").map(Util.formatValue).join(" ")) :
        (new veda.IndividualModel("v-s:NoBundle")).load().then(function(loaded) {
          return loaded.get("rdfs:label").map(Util.formatValue).join(" ");
        }),
      value: false
    },
    options = [trueOption, falseOption];

  renderOptions();

  individual.on(property_uri, changeHandler);
  this.one("remove", function () {
    individual.off(property_uri, changeHandler);
  });

  function renderOptions() {
    that.empty();
    options.map(function (option) {
      var hld = $(opts.template).appendTo(that);
      option.label.then(function(label) {
        var lbl = $("label", hld).append( label );
        var rad = $("input", lbl).data("value", option.value);
        var hasValue = individual.hasValue(property_uri, option.value);
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
    });
  }

  function changeHandler() {
    $("input", that).each(function () {
      var value = $(this).data("value");
      var hasValue = individual.hasValue(property_uri, value);
      $(this).prop("checked", hasValue);
    });
  }

  if (spec && spec.hasValue("v-ui:tooltip")) {
    this.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "left",
      container: "body",
      trigger: "hover",
      animation: false
    }).one("remove", function () {
      $(this).tooltip("destroy");
    });
  }

  this.on("update", function (e) {
    e.stopPropagation();
    renderOptions();
  });

  this.on("view edit search", function (e) {
    e.stopPropagation();
    if (e.type === "view") {
      $("div.radio", this).addClass("disabled");
      $("input", this).attr("disabled", "true");
      $(this).removeClass("has-error");
    } else {
      $("div.radio", this).removeClass("disabled");
      $("input", this).removeAttr("disabled");
    }
  });
  return this;
};
$.fn.veda_booleanRadio.defaults = {
  template: $("#radio-control-template").html(),
};

// Numeration control
$.fn.veda_numeration = function( options ) {
  var opts = $.extend( {}, $.fn.veda_numeration.defaults, options ),
    that = this,
    control = $(opts.template),
    spec = opts.spec,
    placeholder = this.attr("placeholder") || (spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].map(Util.formatValue).join(" ") : ""),
    isSingle = spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true,
    property_uri = opts.property_uri,
    individual = opts.individual,
    input = $(".form-control", control),
    button = $(".get-numeration-value", control);

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.find(".form-control").attr("tabindex", tabindex);
  }

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
  this.one("remove", function () {
    individual.off(property_uri, singleValueHandler);
  });

  if (spec && spec.hasValue("v-ui:tooltip")) {
    this.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "bottom",
      container: "body",
      trigger: "manual",
      animation: false
    }).one("remove", function () {
      $(this).tooltip("destroy");
    });
    input.on("focusin", function () {
      that.tooltip("show");
    }).on("focusout change", function () {
      that.tooltip("hide");
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
  };

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
  };

  if (typeof self.attr('data-mode') !== "undefined") opts.sourceMode = self.attr('data-mode');
  if (property_uri === "v-s:script") opts.sourceMode = "ace/mode/javascript";
  if (property_uri === "v-ui:template") opts.sourceMode = "ace/mode/html";

  System.import("ace").then(function (module) {
    var ace = module.default;

    var editor = ace.edit(editorEl, {
      mode: opts.sourceMode,
      readOnly: opts.mode === "view",
      selectionStyle: "text",
      fontSize: 14,
      value: opts.value
    });

    self.on("view edit search", function (e) {
      e.stopPropagation();
      e.type === "view"   ? ( editor.setReadOnly(true) ) :
      e.type === "edit"   ? ( editor.setReadOnly(false) ) :
      e.type === "search" ? ( editor.setReadOnly(false) ) :
      true;
    });

    editor.session.on("change", function(delta) {
      var value = opts.parser( editor.session.getValue() );
      opts.change(value);
    });

    function handler(values) {
      var value = opts.parser( editor.session.getValue() );
      if (!values.length || values[0].toString() !== value) {
        editor.setValue( values.length ? values[0].toString() : "" );
      }
    }
    individual.on(property_uri, handler );
    self.one("remove", function () {
      individual.off(property_uri, handler);
      editor.destroy();
    });
  });

  this.on("view edit search", function (e) {
    e.stopPropagation();
  });

  this.append(control);
  return self;
};
$.fn.veda_source.defaults = {
  value: "",
  template: $("#source-control-template").html(),
  mode: "javascript",
  parser: function (input) {
    return (input || null);
  }
};

// FILE UPLOAD CONTROL

function loadImage(imageFile) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var image = new Image();
      image.onload = function() {
        resolve(image);
      };
      image.onerror = function () {
        reject( new Error("Image load error") );
      };
      image.src = e.target.result;
    };
    reader.onerror = function () {
      reject( new Error("File reader error") );
    };
    reader.readAsDataURL(imageFile);
  });
}

function resizeImage (image, maxWidth) {
  return new Promise(function (resolve, reject) {
    if (image.width <= maxWidth) {
      resolve(image);
    } else {
      var temp = $("<div></div>").append(image);
      System.import("cropper/cropper.min.js").then(function (module) {
        var Cropper = module.default;
        System.import("cropper/cropper.min.css").then(function () {
          var cropper = new Cropper(image, {
            autoCrop: false,
            ready: function (event) {
              console.log("Crop ready");
              var ratio = image.height / image.width;
              var resized = new Image();
              resized.src = cropper.getCroppedCanvas({
                maxWidth: maxWidth,
                maxHeight: Math.floor(maxWidth * ratio),
              }).toDataURL("image/jpeg");
              resolve(resized);
              cropper.destroy();
            }
          });
        });
      });
    }
  });
}

function cropImage(imageForCrop, ratio, maxWidth){
  var modal = $( $("#confirm-modal-template").html() );
  modal.modal();
  $("body").append(modal);
  var container = $(".modal-body", modal);
  imageForCrop.style.cssText = "display:block; width:100%";
  var temp = $("<div></div>").append(imageForCrop);
  container.append(temp);

  return new Promise(function (resolve, reject) {
    System.import("cropper/cropper.min.js").then(function (module) {
      var Cropper = module.default;
      System.import("cropper/cropper.min.css").then(function () {

        //in templates ratio=h/w, in crop ratio=w/h
        var cropper = new Cropper(imageForCrop, {
          aspectRatio: 1 / ratio,
          movable: false,
          rotable: false,
          scalable: false,
          ready: function (event) {
            console.log("Crop ready");
          }
        });

        $(".modal-footer > .ok", modal).click(function () {
          var img = new Image();
          img.src = cropper.getCroppedCanvas({
            maxWidth: maxWidth,
            maxHeight: Math.floor(maxWidth*ratio),
          }).toDataURL("image/jpeg");
          resolve(img);
          cropper.destroy();
        });
        $(".modal-footer > .cancel", modal).click(function () { resolve(false); });
        modal.on("hidden.bs.modal", function () {
          modal.remove();
          resolve(false);
          cropper.destroy();
        });
      });
    });
  });
};

$.fn.veda_file = function( options ) {
  var opts = $.extend( {}, $.fn.veda_file.defaults, options ),
      control = $(opts.template),
      browseButton = $(control[0]),
      fileInput = $(control[1]),
      indicatorPercentage = $(".indicator-percentage", browseButton),
      indicatorSpinner = $(".indicator-spinner", browseButton),
      spec = opts.spec,
      individual = opts.individual,
      rel_uri = opts.property_uri,
      rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
      range = rangeRestriction ? [ rangeRestriction ] : new veda.IndividualModel(rel_uri)["rdfs:range"],
      isSingle = spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true,
      accept = this.attr("accept"),
      maxWidth = this.data("max-width") || 2048,
      targetRatio = this.data("ratio");

  if (!isSingle) { fileInput.attr("multiple", "multiple"); }
  if (accept) { fileInput.attr("accept", accept); }

  browseButton.on("click", function (e) {
    fileInput.click();
  }).on("keyup", function (e) {
    if ( e.which === 13 ) {
      $(this).click();
    }
  });

  var notify = new veda.Notify();

  function progress (progressEvent) {
    if (progressEvent.lengthComputable) {
      try {
        var percentComplete = Math.round(progressEvent.loaded / progressEvent.total * 100);
        indicatorPercentage.text(percentComplete + "%").show();
      } catch (err) {
        console.log("Progress indicator error", error);
      }
    } else {
      indicatorSpinner.show();
    }
  }

  fileInput.click(function (e) {
    e.stopPropagation();
  }).change(function (e) {
    var that = this;
    var fileIndividualPromises = [];
    for (var i = 0, n = this.files.length, file; (file = this.files && this.files[i]); i++) {
      var fileIndividualPromise = createFileIndividual(file, undefined, individual);
      fileIndividualPromises.push(fileIndividualPromise);
    }
    if (!fileIndividualPromises.length) { return; }
    browseButton.attr("disabled", "disabled");
    Promise.all(fileIndividualPromises).then(function (fileIndividuals) {
      browseButton.removeAttr("disabled");
      that.value = "";
      indicatorSpinner.empty().hide();
      indicatorPercentage.empty().hide();
      if (isSingle) {
        individual.set(rel_uri, fileIndividuals);
      } else {
        individual.addValue(rel_uri, fileIndividuals);
      }
    }).catch(function (error) {
      browseButton.removeAttr("disabled");
      console.log(error);
    });
  });

  function createFileIndividual (file, name, parent) {
    var fileName = file.name || name;
    var uri = veda.Util.guid();
    var path = "/" + new Date().toISOString().substring(0, 10).split("-").join("/");
    var fileIndividual = new veda.IndividualModel();
    fileIndividual["rdf:type"] = range;
    fileIndividual["v-s:fileName"] = [ fileName ];
    fileIndividual["rdfs:label"] = [ fileName ];
    fileIndividual["v-s:fileSize"] = [ file.size ];
    fileIndividual["v-s:fileUri"] = [ uri ];
    fileIndividual["v-s:filePath"] = [ path ];
    fileIndividual["v-s:parent"] = [ parent ];
    return new Promise(function (resolve, reject) {
      // If file is image && !thumbnail
      if ( file.name && (/^(?!thumbnail-).+\.(jpg|jpeg|gif|png|bmp|svg)$/i).test(file.name) ) {
        loadImage(file)
        .then(function (image) {
          if (targetRatio) {
            var curRatio =  image.height / image.width;
            console.log("curRatio: ", curRatio);
            if ( !((targetRatio - 0.1) < curRatio && curRatio < (targetRatio + 0.1)) ) {
              return cropImage(image, targetRatio, maxWidth);
            };
          };
          return image;
        }).then(function(image) {
          if (image === false) {
            reject("Cropper canceled");
          } else {
            file = image;
            return resizeImage(image, 256).then(function(thumbnail) {
              createFileIndividual(thumbnail, "thumbnail-" + fileName, fileIndividual)
              .then(function (thumbnailIndividual) {
                fileIndividual["v-s:thumbnail"] = [ thumbnailIndividual ];
                resolve(fileIndividual);
              });
            });
          };
        });
      } else {
        resolve(fileIndividual);
      }
    }).then(function () {
      return veda.Backend.uploadFile({
        file: file,
        path: path,
        uri: uri,
        progress: progress
      });
    }).then(function () {
      return fileIndividual.save();
    }).catch(function (error) {
      console.log(error);
    });
  }

  this.on("view edit search", function (e) {
    e.stopPropagation();
  });
  this.append(control);
  return this;
};

$.fn.veda_file.defaults = {
  template: $("#file-control-template").html()
};

// OBJECT PROPERTY CONTROL
$.fn.veda_link = function( options ) {
  var opts = $.extend( {}, $.fn.veda_link.defaults, options ),
    control = $(opts.template),
    template = this.attr("data-template") || "{individual['rdfs:label'].map(Util.formatValue).join(' ')}",
    individual = opts.individual,
    spec = opts.spec,
    placeholder = this.attr("placeholder") || ( spec && spec.hasValue("v-ui:placeholder") ? spec["v-ui:placeholder"].map(Util.formatValue).join(" ") : new veda.IndividualModel("v-s:StartTypingBundle") ),
    rel_uri = opts.property_uri,
    rangeRestriction = spec && spec.hasValue("v-ui:rangeRestriction") ? spec["v-ui:rangeRestriction"][0] : undefined,
    range = rangeRestriction ? [ rangeRestriction ] : new veda.IndividualModel(rel_uri)["rdfs:range"],
    queryPrefix = this.attr("data-query-prefix") || ( spec && spec.hasValue("v-ui:queryPrefix") ? spec["v-ui:queryPrefix"][0].toString() : range.map(function (item) { return "'rdf:type'==='" + item.id + "'"; }).join(" || ") ),
    source = this.attr("data-source") || undefined,
    sort = this.attr("data-sort") || ( spec && spec.hasValue("v-ui:sort") ? spec["v-ui:sort"][0].toString() : "'rdfs:label_ru' asc , 'rdfs:label_en' asc , 'rdfs:label' asc" ),
    isSingle = this.data("single") || ( spec && spec.hasValue("v-ui:maxCardinality") ? spec["v-ui:maxCardinality"][0] === 1 : true ),
    withDeleted = false || this.attr("data-deleted");

  var tabindex = this.attr("tabindex");
  if (tabindex) {
    this.removeAttr("tabindex");
    control.find("textarea").attr("tabindex", tabindex);
  }

  this.removeAttr("data-template");
  function renderTemplate (individual) {
    return template.replace(/{\s*.*?\s*}/g, function (match) {
      try {
        return eval(match);
      } catch (error) {
        console.log(error);
        return "";
      }
    });
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
      if ( !rights.hasValue("v-s:canCreate", true) && opts.mode !== "search" ) {
        create.addClass("disabled");
        create.off("click keyup");
      } else {
        create.on("click keydown", function (e) {
          if (e.type !== "click" && e.which !== 13 && e.which !== 32) { return; }
          e.preventDefault();
          e.stopPropagation();
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
            newVal.present(cntr, undefined, "edit").then(function (tmpl) {
              $(".action", tmpl).remove();
              var validation = tmpl.data("validation");
              if ( validation && validation.state ) {
                ok.removeAttr("disabled");
              } else {
                ok.attr("disabled", "disabled");
              }
              tmpl.on("internal-validated", function (e, validation) {
                if (validation.state) {
                  ok.removeAttr("disabled")
                } else {
                  ok.attr("disabled", "disabled");
                }
              });
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

    var treeTmpl = new veda.IndividualModel("v-ui:TreeTemplate");
    var modal = $("#individual-modal-template").html();
    tree.on("click keydown", function (e) {
      if (e.type !== "click" && e.which !== 13 && e.which !== 32) { return; }
      e.preventDefault();
      e.stopPropagation();
      var $modal = $(modal);
      var cntr = $(".modal-body", $modal);
      $modal.on('hidden.bs.modal', function (e) {
        $modal.remove();
      });
      $modal.modal();
      $("body").append($modal);

      var extra = {
        target: individual,
        target_rel_uri: rel_uri,
        isSingle: isSingle,
        withDeleted: withDeleted,
        sort: sort
      };
      spec.present(cntr, treeTmpl, undefined, extra);
    });
  } else {
    tree.remove();
  }

  // Fulltext search feature
  var fulltext = $(".fulltext", control);
  var fulltextMenu = $(".fulltext-menu", control);
  if ( this.hasClass("fulltext") || this.hasClass("full") ) {

    if (placeholder instanceof veda.IndividualModel) {
      placeholder.load().then(function (placeholder) {
        fulltext.attr({
          "placeholder": placeholder.toString(),
          "name": (individual.hasValue("rdf:type") ? individual["rdf:type"][0].id + "_" + rel_uri : rel_uri).toLowerCase().replace(/[-:]/g, "_")
        });
      });
    } else {
      fulltext.attr({
        "placeholder": placeholder,
        "name": (individual.hasValue("rdf:type") ? individual["rdf:type"][0].id + "_" + rel_uri : rel_uri).toLowerCase().replace(/[-:]/g, "_")
      });
    }

    fulltext.on("input change focus blur", function (e) {
      var fulltext = $(e.target);
      var value = fulltext.val();
      if (value) {
        var rows = value.split("\n").length;
        fulltext.prop("rows", rows);
      } else {
        fulltext.prop("rows", 1);
      }
    });

    var header = $(".header", control);
    Promise.all([
      new veda.IndividualModel("v-s:SelectAll").load(),
      new veda.IndividualModel("v-s:CancelSelection").load(),
      new veda.IndividualModel("v-s:InvertSelection").load()
    ]).then(function (actions) {
      header.find(".select-all")
        .click(function () { suggestions.children(":not(.selected)").click(); })
        .text( actions[0].toString() );
      header.find(".cancel-selection")
        .click(function () { suggestions.children(".selected").click(); })
        .text( actions[1].toString() );
      header.find(".invert-selection")
        .click(function () { suggestions.children().click(); })
        .text( actions[2].toString() );
      header.find(".close-menu")
        .click(function () {
          individual.set(rel_uri, selected);
          fulltextMenu.hide();
          $(document).off("click", clickOutsideMenuHandler);
          $(document).off("keydown", arrowHandler);
        })
        .text( "Ok" );
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

    var evalQueryPrefix = function () {
      return new Promise(function (resolve, reject) {
        try {
          var result = queryPrefix.replace(/{\s*.*?\s*}/g, function (match) {
            return eval(match);
          });
          resolve(result);
        } catch (error) {
          console.log("Query prefix evaluation error", error);
          reject(error);
        }
      });
    };

    var performSearch = function (value) {
      if (source) {
        return Promise.resolve(eval(source))
          .then(renderResults)
          .catch(function (error) {
            console.log("Source error", source);
          });
      } else {
        evalQueryPrefix().then(function (queryPrefix) {
          ftQuery(queryPrefix, value, sort, withDeleted)
            .then(renderResults)
            .catch(function (error) {
              console.log("Fulltext query error", error);
            });
        });
      }
    };

    var inputHandler = (function () {
      var timeout;
      var minLength = 3;
      var nav_keys = [37, 38, 39, 40, 9, 16]; // Arrows, shift, tab
      return function (e) {
        if (timeout) { clearTimeout(timeout); }
        if (nav_keys.indexOf(e.which) >= 0) { return; }
        timeout = setTimeout(function () {
          var value = e.target.value;
          if (value.length >= minLength) {
            performSearch(value);
          } else if (!value.length) {
            if (isSingle) {
              individual.clearValue(rel_uri);
            }
            suggestions.empty();
            fulltextMenu.hide();
            $(document).off("click", clickOutsideMenuHandler);
            $(document).off("keydown", arrowHandler);
          }
        }, 750);
      };
    }());
    fulltext.on("keydown", inputHandler);

    var selected = [];

    var renderResults = function (results) {
      suggestions.empty();
      selected = individual.get(rel_uri);
      if (results.length) {
        var rendered = results.map(function (result) {
          var tmpl = $("<a href='#' class='suggestion'></a>")
            .text( renderTemplate(result) )
            .attr("resource", result.id);
          if (individual.hasValue(rel_uri, result)) {
            tmpl.addClass("selected");
          }
          if (result.hasValue("v-s:deleted", true)) {
            tmpl.addClass("deleted");
          }
          if (result.hasValue("v-s:valid", false) && !result.hasValue("v-s:deleted", true) ) {
            tmpl.addClass("invalid");
          }
          return tmpl;
        });
        suggestions.append(rendered);
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
        fulltextMenu.show();
        $(document).on("click", clickOutsideMenuHandler);
        $(document).on("keydown", arrowHandler);
      } else {
        fulltextMenu.hide();
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
      }
    };

    var suggestions = $(".suggestions", control);
    var dblTimeout;
    suggestions.on("click", ".suggestion", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.originalEvent) {
        clickHandler(e);
      } else if (dblTimeout) {
        dblclickHandler(e);
      } else {
        clickHandler(e);
      }
    }).on("keydown", ".suggestion", function (e) {
      if (e.which === 32) {
        e.preventDefault();
        e.stopPropagation();
        clickHandler(e);
      } else if (e.which === 13) {
        e.preventDefault();
        e.stopPropagation();
        dblclickHandler(e);
      }
    }).on("dblclick", ".suggestion", function (e) {
      e.preventDefault();
    });

    var clickHandler = function (e) {
      e.preventDefault();
      var tmpl = $(e.target);
      var suggestion_uri = tmpl.attr("resource");
      if (!suggestion_uri) { return; }
      var suggestion = new veda.IndividualModel(suggestion_uri);
      tmpl.toggleClass("selected");
      if (isSingle) { tmpl.siblings().removeClass("selected"); }
      if ( selected.indexOf(suggestion) >= 0 ) {
        if (isSingle) {
          individual.set(rel_uri, [suggestion]);
          fulltextMenu.hide();
          $(document).off("click", clickOutsideMenuHandler);
          $(document).off("keydown", arrowHandler);
        } else {
          selected = selected.filter(function (value) {
            return value !== suggestion;
          });
        }
      } else {
        if (isSingle) {
          selected = [suggestion];
          individual.set(rel_uri, selected);
          fulltextMenu.hide();
          $(document).off("click", clickOutsideMenuHandler);
          $(document).off("keydown", arrowHandler);
        } else {
          selected.push(suggestion);
        }
      }
      dblTimeout = setTimeout(function () {
        dblTimeout = undefined;
      }, 300);
      fulltext.focus();
    };

    var dblclickHandler = function (e) {
      e.preventDefault();
      if ( !$(e.target).hasClass("selected") ) {
        clickHandler(e);
      }
      dblTimeout = clearTimeout(dblTimeout);
      individual.set(rel_uri, selected);
      fulltextMenu.hide();
      $(document).off("click", clickOutsideMenuHandler);
      $(document).off("keydown", arrowHandler);
      fulltext.focus();
    };

    var clickOutsideMenuHandler = function (e) {
      if( !$(e.target).closest(fulltextMenu).length ) {
        if( fulltextMenu.is(":visible") ) {
          individual.set(rel_uri, selected);
          fulltextMenu.hide();
          $(document).off("click", clickOutsideMenuHandler);
          $(document).off("keydown", arrowHandler);
        }
      }
    };

    var arrowHandler = function(e) {
      if ( e.which === 40 ) { // Down
        e.preventDefault();
        var active = suggestions.find(".active").removeClass("active");
        var next = active.next();
        if ( next.length ) {
          next.addClass("active").focus();
        } else {
          suggestions.children().first().addClass("active").focus();
        }
      } else if ( e.which === 38 ) { // Up
        e.preventDefault();
        var active = suggestions.find(".active").removeClass("active");
        var prev = active.prev();
        if ( prev.length ) {
          prev.addClass("active").focus();
        } else {
          suggestions.children().last().addClass("active").focus();
        }
      } else if ( e.which === 32 && fulltextMenu.find(":focus").length ) { // Space
        e.preventDefault(); // Prevent scrolling on space
      }
    };

    var propertyModifiedHandler = function (value) {
      if ( isSingle && individual.hasValue(rel_uri) ) {
        individual.get(rel_uri)[0].load().then(function(loaded) {
          var rendered = renderTemplate( loaded );
          var value = fulltext.val();
          if (value != rendered) {
            fulltext.val(rendered);
          }
        });
      } else {
        fulltext.val("");
      }
    };

    individual.on(rel_uri, propertyModifiedHandler);
    control.one("remove", function () {
      individual.off(rel_uri, propertyModifiedHandler);
    });
    propertyModifiedHandler();

  } else {
    fulltext.remove();
    fulltextMenu.remove();
  }

  // Clear feature
  if (isSingle && opts.mode !== "search" && ( this.hasClass("fulltext") || this.hasClass("full") ) ) {
    $(".clear", control).on("click keydown", function (e) {
      if (e.type !== "click" && e.which !== 13 && e.which !== 32) { return; }
      e.preventDefault();
      e.stopPropagation();
      selected = [];
      suggestions.empty();
      individual.clearValue(rel_uri);
      fulltext.val("").focus();
    });
    this.on("view edit search", function (e) {
      e.stopPropagation();
      if (e.type === "search") {
        var isSingle = false || $(this).data("single");
        if (!isSingle) {
          $(".clear", control).remove();
        }
      }
    });
  } else {
    $(".clear", control).remove();
  }

  // Dropdown feature
  var dropdown = $(".dropdown", control);
  if ( this.hasClass("dropdown") && this.hasClass("fulltext") || this.hasClass("full") ) {
    dropdown.on("click keydown", function (e) {
      if (e.type !== "click" && e.which !== 13 && e.which !== 32) { return; }
      e.preventDefault();
      e.stopPropagation();
      if ( suggestions.is(":empty") ) {
        performSearch();
      } else if ( fulltextMenu.is(":visible") ) {
        fulltextMenu.hide();
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
      } else {
        $(document).off("click", clickOutsideMenuHandler);
        $(document).off("keydown", arrowHandler);
        fulltextMenu.show();
        $(document).on("click", clickOutsideMenuHandler);
        $(document).on("keydown", arrowHandler);
      }
    });
    var downHandler = function (e) {
      if ( e.which === 40) {
        e.stopPropagation();
        dropdown.click();
      }
    }
    fulltext.on("focus", function (e) {
      fulltext.off("keydown", downHandler).one("keydown", downHandler);
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
      var dataDeleted = $(this).data("deleted");
      withDeleted = typeof dataDeleted === "boolean" ? dataDeleted : true;
    }
  });

  if (spec && spec.hasValue("v-ui:tooltip")) {
    control.tooltip({
      title: spec["v-ui:tooltip"].join(", "),
      placement: "top",
      container: "body",
      trigger: "manual",
      animation: false
    });
    control.one("remove", function () {
      control.tooltip("destroy");
    });
    $("textarea", control).on("focusin", function () {
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

function ftQuery(prefix, input, sort, withDeleted) {
  input = input ? input.trim() : "";
  var queryString = "";
  if ( input ) {
    var lines = input.split("\n").filter(Boolean);
    var lineQueries = lines.map(function (line) {
      var special = line && line.indexOf("==") > 0 ? line : false;
      if (special) { return special; }
      var words = line.trim().replace(/[-*\s]+/g, " ").split(" ");
      return words.filter(Boolean).map(function (word) { return "'*' == '" + word + "*'"; }).join(" && ");
    });
    queryString = lineQueries.filter(Boolean).join(" || ");
  }
  if (prefix) {
    queryString = queryString ? "(" + prefix + ") && (" + queryString + ")" : "(" + prefix + ")" ;
  }

  var result = [];

  return incrementalSearch(0, 100, [])
  .then(function (results) {
    if (withDeleted) {
      queryString = queryString + " && ('v-s:deleted' == true )";
      return incrementalSearch(0, 100, results);
    } else {
      return results;
    }
  })
  .then(function (results) {
    results = veda.Util.unique( results );
    var getList = results.filter( function (uri, i) {
      var cached = veda.cache.get(uri);
      if ( cached ) {
        result[i] = cached.load();
        return false;
      } else {
        return true;
      }
    });
    if (getList.length) {
      return veda.Backend.get_individuals({
        ticket: veda.ticket,
        uris: getList
      });
    } else {
      return [];
    }
  })
  .then(function (individuals) {
    for (var i = 0, j = 0, length = individuals.length; i < length; i++) {
      while(result[j++]); // Fast forward to empty element
      result[j-1] = new veda.IndividualModel(individuals[i]).init();
    }
    return Promise.all(result)
  }).then(function (fulfilled) {
    return fulfilled.filter(Boolean);
  });

  function incrementalSearch(cursor, limit, results) {
    return veda.Backend.query({
      ticket: veda.ticket,
      query: queryString,
      sort: sort ? sort : "'rdfs:label_ru' asc , 'rdfs:label_en' asc , 'rdfs:label' asc",
      from: cursor,
      top: 10,
      limit: 1000
    }).then(function (queryResult) {
      results = results.concat(queryResult.result);
      var cursor = queryResult.cursor;
      var estimated = queryResult.estimated;
      if (results.length >= limit || cursor >= estimated) {
        return results;
      } else {
        return incrementalSearch(cursor, limit, results);
      }
    });
  }
}
