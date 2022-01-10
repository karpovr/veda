import CommonUtil from '/js/common/util.js';
import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.tooltip({
    container: template,
    placement: 'bottom',
    trigger: 'hover',
    title: individual['rdfs:label'].map(CommonUtil.formatValue).join(' '),
  });
};

export const html = '<a href="#/@"><span class="fa fa-lg fa-user-o"></span></a>';
