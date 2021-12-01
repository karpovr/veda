import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Clear output on save
  individual.on("beforeSave", clearOutput);
  template.one("remove", function () {
    individual.off("beforeSave", clearOutput);
  });
  function clearOutput () {
    this["v-s:output"] = [];
  }

  var nativeConsole = window.console;
  var nativePrint = window.print;
  var _print = function () {
    var output = individual["v-s:output"][0] || "";
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i] ;
      var argString = typeof arg !== "undefined" ? arg.toString() : "undefined" ;
      if (i === 0) {
        output += argString;
      } else {
        output += " " + argString;
      }
    }
    output += String.fromCharCode(13, 10);
    individual["v-s:output"] = [output];
  }
  var _console = {
    log: _print,
    error: _print,
    info: _print,
    time: function (timer) {
      this[timer] = new Date();
    },
    timeEnd: function (timer) {
      var delta = new Date() - this[timer];
      this.log(timer, delta, "msec");
    }
  };

  window.console = _console;
  window.print = _print;
  template.one("remove", function () {
    window.console = nativeConsole;
    window.print = nativePrint;
  });

  $(".action#run", template).click(function () {
    if ( individual.hasValue("v-s:executeAt", "Server") ) {
      individual["v-s:toBeRun"] = [ true ];
      individual.save(true);
    } else {
      individual["v-s:lastRun"] = [ new Date() ];
      individual["v-s:output"] = [];
      var script = new Function("veda", individual["v-s:script"][0] || "return;");
      try {
        script(veda);
      } catch (err) {
        print(err);
      }
    }
  });
  $(".action#clear", template).click(function () {
    individual["v-s:output"] = [];
  });
};

export const html = `
<div class="container sheet">
  <div about="@" data-embedded="true" data-template="v-ui:CommonOntologyTemplate"></div>
  <div class="row">
    <div class="col-md-2 view -edit -search">
      <em about="v-s:lastRun" property="rdfs:label"></em>
      <div about="@" property="v-s:lastRun"></div>
    </div>
    <div class="col-md-2 view -edit -search">
      <em about="v-s:updateCounter" property="rdfs:label"></em>
      <div about="@" property="v-s:updateCounter"></div>
    </div>
    <div class="col-md-2 view -edit -search">
      <div class="checkbox">
        <label>
          <veda-control property="v-s:toBeRun" data-type="boolean"></veda-control>
          <em about="v-s:toBeRun" property="rdfs:label"></em>
        </label>
      </div>
    </div>
    <div class="col-md-2 view edit -search">
      <em about="v-s:executeAt" property="rdfs:label"></em>
      <div property="v-s:executeAt" class="view -edit -search"></div>
      <veda-control property="v-s:executeAt" data-type="radio" class="-view edit search"></veda-control>
    </div>
  </div>
  <hr>
  <div class="row">
    <div class="col-md-6">
      <em about="v-s:script" property="rdfs:label" class="view edit -search"></em>
      <veda-control property="v-s:script" data-type="source" class="view edit -search"></veda-control>
    </div>
    <div class="col-md-6">
      <em about="v-s:output" property="rdfs:label" class="view edit -search"></em>
      <pre about="@" property="v-s:output" class="view edit -search" style="height:300px; overflow:auto"></pre>
    </div>
  </div>
  <hr>
  <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  <br>
  <div class="actions view edit -search clearfix">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete destroy"></span>
    <div class="pull-right">
      <button type="button" class="action btn btn-warning view -edit -search" id="run" about="v-s:RunBundle" property="rdfs:label"></button>
      <button type="button" class="action btn btn-default -view edit -search" id="clear" about="v-s:ClearBundle" property="rdfs:label"></button>
    </div>
  </div>
</div>
`;