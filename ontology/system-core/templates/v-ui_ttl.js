import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  individual.on('afterReset', render);
  template.one('remove', function () {
    individual.off('afterReset', render);
  });
  render();

  function render() {
    var list = [individual];
    BrowserUtil.toTTL(list, function (error, ttl) {
      var pre = $('pre', template),
        sanitized = sanitize(ttl),
        anchored = sanitized.replace(/([a-zA-Z][\w-]*:[\w-]*)(\,|\s|\;|\.)/gi, "<a class='text-black' href='#/$1//v-ui:ttl'>$1</a>$2");
      pre.html(anchored);
    });
  }

  function sanitize(string) {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    var reg = /[&<>"'/]/gi;
    return string.replace(reg, function (match) {
      return map[match];
    });
  }
};

export const html = `
  <div class="container sheet">
    <pre style="border:none;background-color:#fff;"></pre>
    <div class="actions pull-left">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="delete destroy journal task rights"></span>
    </div>
    <div class="pull-right">
      <a id="default" class="btn btn-info" href="#/@" about="v-s:Default" property="rdfs:label"></a>
      <a id="generic" class="btn btn-default" href="#/@//v-ui:generic">generic</a>
      <a id="json" class="btn btn-default" href="#/@//v-ui:json">json</a>
      <a id="ttl" class="disabled btn btn-default" href="#/@//v-ui:ttl">ttl</a>
    </div>
  </div>
`;
