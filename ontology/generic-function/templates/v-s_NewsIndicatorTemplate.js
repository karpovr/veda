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
};

export const html = `
<a href="#/@" data-toggle="tooltip" data-trigger="hover" data-placement="bottom">
  <span class="fa fa-newspaper-o fa-lg"></span> <span class="label label-default" id="news-counter"></span>
</a>
`;