import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('rdfs:label')) {
    $('#label', template).text(individual.id);
  }
};

export const html = `
  <span>
    <span about="@" rel="rdf:type">
      <span about="@" property="rdfs:label"></span>
    </span>:
    <span id="label" about="@" property="rdfs:label"></span>
  </span>
`;
