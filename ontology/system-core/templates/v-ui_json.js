import $ from 'jquery';
import Notify from '/js/browser/notify.js';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  var pre = $("pre", template),
      textarea = $("textarea", template),
      json = individual.properties;
  var formatted = format(json);
  var anchorized = anchorize(formatted);
  var height = $("#copyright").offset().top - container.offset().top - 120;
  pre.css("height", height);
  pre.html(anchorized);
  textarea.val(formatted);
  textarea.css("min-height", height);
  var notify = Notify ? new Notify() : function () {};
  var original = individual.properties;
  var validationState = true;
  textarea.on("keyup", function () {
    try {
      formatted = textarea.val();
      json = JSON.parse(formatted);
      if (validationState === false) {
        notify("success", {name: "JSON ok"});
      }
      template[0].dispatchEvent(new CustomEvent("internal-validated", {detail: {state: true}}));
      validationState = true;
    } catch (error) {
      formatted = format(original);
      json = JSON.parse(formatted);
      if (validationState === true) {
        notify("danger", {name: "JSON error"});
      }
      template[0].dispatchEvent(new CustomEvent("internal-validated", {detail: {state: false}}));
      validationState = false;
    }
    anchorized = anchorize(formatted);
    pre.html(anchorized);
    individual.properties = json;
    individual.isSync(false);
  });

  // Mark not sync to force update on save
  template.on("edit", function () {
    individual.isSync(false);
  });

  individual.on("afterReset", resetView);
  template.one("remove", function () {
    individual.off("afterReset", resetView);
  });
  function resetView() {
    var formatted = format(individual.properties);
    var anchorized = anchorize(formatted);
    pre.html(anchorized);
    textarea.val(formatted);
  }

  function format (json) {
    var ordered = {};
    Object.keys(json).sort().forEach(function(key) {
      ordered[key] = json[key];
    });
    return JSON.stringify(ordered, null, 2);
  };

  function sanitize(string) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    var reg = /[&<>"'/]/ig;
    return string.replace(reg, function (match) { return map[match]; });
  }

  function anchorize (string) {
    var sanitized = sanitize(string);
    var anchorized = sanitized.replace(/(&quot;)([a-zA-Z][\w-]*:[\w-]*)(&quot;)/gi, "$1<a class='text-black' href='#/$2//v-ui:json'>$2</a>$3");
    return anchorized;
  };
};

export const html = `
<div class="container sheet">
  <pre class="view -edit -search" style="border:none;background-color:#fff;"></pre>
  <textarea class="form-control -view edit search" style='font-family:Menlo,Monaco,Consolas,"Courier New",monospace;font-size:13px;color:black;'></textarea>
  <br>
  <div class="pull-right">
    <a id="default" class="btn btn-info" href="#/@" about="v-s:Default" property="rdfs:label"></a>
    <a id="generic" class="btn btn-default" href="#/@//v-ui:generic">generic</a>
    <a id="json" class="disabled btn btn-default" href="#/@//v-ui:json">json</a>
    <a id="ttl" class="btn btn-default" href="#/@//v-ui:ttl">ttl</a>
  </div>
  <div class="actions pull-left">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete destroy journal task rights"></span>
  </div>
</div>
`;