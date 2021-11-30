import $ from 'jquery';
import Util from '/js/common/util.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  template.tooltip({
    container: template,
    placement: "bottom",
    trigger: "hover",
    title: individual["rdfs:label"].map(Util.formatValue).join(" ")
  });
  template.click(function(e) {
    e.preventDefault();
  });
};

export const html = `
<a id="logout" class="logout" href="#" data-toggle="tooltip" data-trigger="hover" data-placement="bottom">
  <span class="glyphicon glyphicon-log-out"></span> <span class="label label-default"></span>
</a>
`;