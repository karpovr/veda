import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import Util from '/js/common/util.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (individual.hasValue("v-s:hasAspect")) {
    template.attr("href", "#/" + individual["v-s:hasAspect"][0].id);
  }
  return new IndividualModel("v-s:PersonalInfo").load().then(function(personalInfo) {
    template.tooltip({
      container: template,
      placement: "bottom",
      trigger: "hover",
      title: personalInfo["rdfs:label"].map(Util.formatValue).join(" ")
    });
  })
};

export const html = `
<a href="#/@" about="@" property="rdfs:label"></a>
`;