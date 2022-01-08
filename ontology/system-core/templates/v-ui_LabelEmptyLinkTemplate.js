import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('rdfs:label')) {
    template.text(individual.id);
  }
};

export const html = ` <a href="#" property="rdfs:label"></a> `;
