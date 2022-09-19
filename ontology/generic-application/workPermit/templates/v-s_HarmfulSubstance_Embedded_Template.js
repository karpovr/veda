import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('rdfs:label')) {
    $('#label', template).text(individual.id);
  }
};

export const html = `
  <div><span about="@" property="v-s:shortLabel"></span> | <span id="label" about="@" property="rdfs:label"></span> | <span about="@" property="v-s:description"></span></div>
`;
