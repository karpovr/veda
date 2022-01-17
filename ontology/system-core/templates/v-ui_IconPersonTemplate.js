import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('v-s:hasAspect')) {
    template.attr('href', '#/' + individual['v-s:hasAspect'][0].id);
  }
  return new IndividualModel('v-s:PersonalInfo').load().then(function (personalInfo) {
    template.tooltip({
      container: template,
      placement: 'bottom',
      trigger: 'hover',
      title: personalInfo['rdfs:label'].map(CommonUtil.formatValue).join(' '),
    });
  });
};

export const html = `
  <a href="#/@" about="@" property="rdfs:label"></a>
`;
