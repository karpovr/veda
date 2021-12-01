import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue("v-fw:variableScope")) $("#variableScope", template).remove();
  var valHolder = $("#values", template);
  individual["v-wf:variableValue"].map( function (value) {
    var el = $("<li>");
    if (value instanceof IndividualModel) {
      value.present(el, new IndividualModel("v-ui:ClassNameLabelLinkTemplate"));
    } else {
      el.text(value.toString());
    }
    valHolder.append(el);
  });
  $(".zoomIn.glyphicon-zoom-in", template).click(function(e){
    e.preventDefault();
    riot.route( ["#", individual.id, "/v-ui:ttl"].join("/") );
  })
};

export const html = `
<span>
  <a href="#" class="zoomIn glyphicon glyphicon-zoom-in margin-sm-h"></a>
  <strong><span property="v-wf:variableName"></span> =</strong>
  <ul id="values"></ul>
  <div id="variableScope">
    <em about="v-wf:variableScope" property="rdfs:label"></em>
    <ul><li rel="v-wf:variableScope" data-template="v-ui:ClassNameLabelLinkTemplate"></li></ul>
  </div>
</span>
`;