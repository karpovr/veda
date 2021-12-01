import CommonUtil from '/js/common/util.js';
import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.tooltip({
    container: template,
    placement: "bottom",
    trigger: "hover",
    title: individual["rdfs:label"].map(CommonUtil.formatValue).join(" ")
  });
};

export const html = `
<a href="#/@" data-toggle="tooltip" data-trigger="hover" data-placement="bottom">
  <span class="fa fa-newspaper-o fa-lg"></span> <span class="label label-default" id="news-counter"></span>
</a>
`;