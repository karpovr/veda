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
<a href="#/@"><span class="fa fa-lg fa-user-o"></span></a>
`;