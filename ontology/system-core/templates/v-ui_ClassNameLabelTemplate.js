import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue("rdfs:label")) {
    $("#label", template).text(individual.id);
  }
};

export const html = `
<span class="label-template"><span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>: <span id="label" about="@" property="rdfs:label"></span></span>
`;