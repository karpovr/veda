import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  return veda.user.isMemberOf('cfg:SuperUser').then(function (isSuperUser) {
    if (!isSuperUser) {
      template.hide();
    } else {
      template.tooltip({
        container: template,
        placement: 'bottom',
        trigger: 'hover',
        title: individual['rdfs:label'].map(CommonUtil.formatValue).join(' '),
      });
    }
  });
};

export const html = `
  <a href="#/v-s:AdministrationAspect" data-toggle="tooltip" data-trigger="hover" data-placement="bottom">
    <span class="fa fa-cog fa-lg"></span> <span class="label label-default"></span>
  </a>
`;
