import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $("#press-me", template).click(function () {
    individual.press();
  });
};

export const html = `
<div class="container sheet">
  <h2>Example function instance</h2>
  <span about="v-fe:exampleProperty" property="rdfs:label"></span>
  <div property="v-fe:exampleProperty"></div>
  <button id="press-me" class="btn btn-success">Press me</button>
</div>
`;