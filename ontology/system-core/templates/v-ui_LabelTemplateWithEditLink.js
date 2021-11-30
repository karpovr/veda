import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue("rdfs:label")) {
    $("#label", template).text(individual.id);
  }
};

export const html = `
<span class="label-template">
  # <a href="#/@///edit"><span id="label" property="rdfs:label"></span></a>
</span>
`;