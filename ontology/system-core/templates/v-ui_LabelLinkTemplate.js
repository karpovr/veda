import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('rdfs:label')) {
    template.children().first().text(individual.id);
  }
};

export const html = ` <a class="label-template" href="#/@"><span about="@" property="rdfs:label"></span></a> `;
