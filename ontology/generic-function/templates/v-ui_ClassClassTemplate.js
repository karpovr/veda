import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var propsContainer = $("#props", template);
  var specsContainer = $("#specs", template);
  var tmplContainer = $("#tmpl", template);
  var modal = $($("#notification-modal-template").html());
  var objContainer = $(".holder", modal);
  var labelTemplate = new IndividualModel("v-ui:LabelLinkTemplate");

  var props = veda.ontology.getClassProperties(this.id);
  props.map(function (property_uri) {
    var prop = new IndividualModel(property_uri);
    var li = $("<li></li>").appendTo(propsContainer);
    prop.present(li, labelTemplate).then(function (li) {
      if ( !prop.hasValue("rdfs:domain", individual) ) {
        var small = $("<small class='text-muted'></small>").appendTo(li);
        individual.getSuperClasses().then(function (superClasses) {
          var origin = prop["rdfs:domain"].filter( function (item) {
            return superClasses.indexOf(item) >= 0;
          })[0];
          small.text(origin.id);
        });
      }
    });
  });

  var specs = veda.ontology.getClassSpecifications(this.id);
  for (var property_uri in specs) {
    var spec_uri = specs[property_uri];
    var spec = new IndividualModel(spec_uri);
    var li = $("<li>").appendTo(specsContainer);
    spec.present(li, labelTemplate).then(function (li) {
      if ( !spec.hasValue("v-ui:forClass", individual) ) {
        var small = $("<small class='text-muted'></small>").appendTo(li);
        individual.getSuperClasses().then(function (superClasses) {
          var origin = spec["v-ui:forClass"].filter( function (item) {
            return superClasses.indexOf(item) >= 0;
          })[0];
          small.text(origin.id);
        });
      }
    });
  }

  template.on("click", "a[href][resource]", function (e) {
    e.preventDefault();
    var target = $(this);
    var uri = target.attr("href").split("/").pop();
    var object = new IndividualModel(uri);
    objContainer.empty();
    object.present(objContainer);
    modal.modal("show");
    e.stopPropagation();
  });

  $("#add-template", template).click(function () {
    var _class = new IndividualModel("v-ui:ClassTemplate"),
        classTemplate = new IndividualModel();
    classTemplate["rdf:type"] = [_class];
    classTemplate["v-ui:forClass"] = [ individual ];
    riot.route( ["#", classTemplate.id, "#main", undefined, "edit"].join("/") );
  });

  $("#add-model", template).click(function () {
    var _class = new IndividualModel("v-ui:ClassModel"),
        classTemplate = new IndividualModel();
    classTemplate["rdf:type"] = [_class];
    classTemplate["v-ui:forClass"] = [ individual ];
    riot.route( ["#", classTemplate.id, "#main", undefined, "edit"].join("/") );
  });

  $("#add-property", template).click(function () {
    var _class = new IndividualModel("rdf:Property"),
        classTemplate = new IndividualModel();
    classTemplate["rdf:type"] = [_class];
    classTemplate["rdfs:domain"] = [ individual ];
    riot.route( ["#", classTemplate.id, "#main", undefined, "edit"].join("/") );
  });

  $("#add-specification", template).click(function () {
    var _class = new IndividualModel("v-ui:PropertySpecification"),
        classTemplate = new IndividualModel();
    classTemplate["rdf:type"] = [_class];
    classTemplate["v-ui:forClass"] = [ individual ];
    riot.route( ["#", classTemplate.id, "#main", undefined, "edit"].join("/") );
  });
};

export const html = `
<div class="container sheet">
  <div about="@" data-embedded="true" data-template="v-ui:CommonOntologyTemplate"></div>
  <veda-control rel="rdf:type" data-type="radio" class="-view edit search"></veda-control>
  <br class="-view edit search">
  <h4 about="v-s:SuperClassesBundle" property="rdfs:label"></h4>
  <div rel="rdfs:subClassOf" data-template="v-ui:LabelLinkTemplate" class="view edit search"></div>
  <veda-control rel="rdfs:subClassOf" class="-view edit search fulltext dropdown"></veda-control>
  <br>
  <div class="row">
    <div class="col-md-6">
      <div class="panel panel-default">
        <div class="panel-heading">
          <span about="v-s:PropertiesBundle" property="rdfs:label"></span>
          <button type="button" class="action btn btn-xs btn-default pull-right -view edit -search" id="add-property" about="v-s:CreateBundle" property="rdfs:label"></button>
        </div>
        <div class="panel-body" style="height:400px; overflow:auto;">
          <ol id="props"></ol>
        </div>
      </div>
    </div>
    <div class="col-md-6">
      <div class="panel panel-default">
        <div class="panel-heading">
          <span class="panel-title" about="v-s:SpecificationsBundle" property="rdfs:label"></span>
          <button type="button" class="action btn btn-xs btn-default pull-right -view edit -search" id="add-specification" about="v-s:CreateBundle" property="rdfs:label"></button>
        </div>
        <div class="panel-body" style="height:400px; overflow:auto;">
          <ol id="specs"></ol>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-md-6">
      <h4 about="v-ui:hasTemplate" property="rdfs:label"></h4>
      <div rel="v-ui:hasTemplate" data-template="v-ui:LabelLinkTemplate" class="view -edit -search"></div>
      <veda-control rel="v-ui:hasTemplate" class="-view edit search fulltext dropdown"></veda-control>
      <br>
      <button type="button" class="action btn btn-xs btn-default pull-right -view edit -search" id="add-template" about="v-s:CreateBundle" property="rdfs:label"></button>
    </div>
    <div class="col-md-6">
      <h4 about="v-ui:hasModel" property="rdfs:label"></h4>
      <div rel="v-ui:hasModel" data-template="v-ui:LabelLinkTemplate" class="view -edit -search"></div>
      <veda-control rel="v-ui:hasModel" class="-view edit search fulltext dropdown"></veda-control>
      <br>
      <button type="button" class="action btn btn-xs btn-default pull-right -view edit -search" id="add-model" about="v-s:CreateBundle" property="rdfs:label"></button>
    </div>
  </div>
  <hr>
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete destroy"></span>
  </div>
</div>
`;