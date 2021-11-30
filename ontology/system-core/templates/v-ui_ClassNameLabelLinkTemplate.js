import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue("rdfs:label")) {
    $("#label", template).text(individual.id);
  }
};

export const html = `
<a class="label-template" href="#/@">
  <span about="@" rel="rdf:type">
    <span>
      <span about="@" property="rdfs:label"></span>
    </span>
  </span>:
  <span id="label" about="@" property="rdfs:label"></span>
</a>
`;