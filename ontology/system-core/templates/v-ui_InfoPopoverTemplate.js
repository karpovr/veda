import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.popover({
    content: individual['v-ui:info'].map(Util.formatValue).join(' '),
    container: template.parent(),
    trigger: 'focus',
    placement: 'top',
    animation: false,
  });
};

export const html = ' <span tabindex="0" role="button" class="glyphicon glyphicon-info-sign text-primary"></span> ';
