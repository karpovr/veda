import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('rdfs:label')) {
    $('#label', template).text(individual.id);
  }
};

export const html = `
  <div><a id="label" href="#/@" property="rdfs:label"></a></div>
`;
