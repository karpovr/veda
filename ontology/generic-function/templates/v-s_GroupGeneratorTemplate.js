import $ from 'jquery';
import Sha256 from 'sha256';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  System.import("sha256").then(function (module) {
    var Sha256 = module.default;

    $("#authClass", template).change(function() {
      var uri = $(this).val();
      if (uri) {
        individual["v-s:authClass"] = [new IndividualModel(uri)];
      } else {
        individual["v-s:authClass"] = [];
      }
    });

    $("#authProperty", template).change(function() {
      var uri = $(this).val();
      if (uri) {
        individual["v-s:authProperty"] = [new IndividualModel(uri)];
      } else {
        individual["v-s:authProperty"] = [];
      }
    });

    individual.on("propertyModified", handler);
    template.one("remove", function () {
      individual.off("propertyModified", handler);
    });
    handler();

    function handler() {
      var $groupUri = $(".group-uri", template);
      if ( individual.hasValue("v-s:authValue") ) {
        var group_concat_uri = individual.id + " " + individual["v-s:authValue"][0].toString();
        var hash = Sha256.hash(group_concat_uri).substring(32);
        var group_uri = "d:grp-" + hash;
        $groupUri.text(group_uri);
      } else {
        $groupUri.text("");
      }
    }

  });
};

export const html = `
<div class="container sheet">
  <h2 about="v-s:GroupGenerator" property="rdfs:label"></h2>
  <hr>
  <em about="rdfs:label" property="rdfs:label"></em>
  <div property="rdfs:label" class="view -edit -search"></div>
  <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>

  <em about="rdfs:comment" property="rdfs:label"></em>
  <div property="rdfs:comment" class="view -edit -search"></div>
  <veda-control data-type="text" rows="2" property="rdfs:comment" class="-view edit search"></veda-control>

  <em about="v-s:authClass" property="rdfs:label"></em>
  <div about="@" rel="v-s:authClass" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
  <div rel="v-s:authClass" data-template="v-ui:LabelTemplate" class="-view -edit search"></div>
  <input id="authClass" type="text" class="-view edit search form-control"/>

  <em about="v-s:authProperty" property="rdfs:label"></em>
  <div about="@" rel="v-s:authProperty" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
  <div rel="v-s:authProperty" data-template="v-ui:LabelTemplate" class="-view -edit search"></div>
  <input id="authProperty" type="text" class="-view edit search form-control"/>

  <em about="v-s:authFunction" property="rdfs:label"></em>
  <div property="v-s:authFunction" class="view -edit -search"></div>
  <veda-control data-type="text" rows="2" property="v-s:authFunction" class="-view edit search"></veda-control>

  <em about="v-s:authValue" property="rdfs:label"></em>
  <div property="v-s:authValue" class="view -edit -search"></div>
  <veda-control data-type="generic" property="v-s:authValue" class="-view edit search"></veda-control>

  <em about="v-s:authGroupFunction" property="rdfs:label"></em>
  <div property="v-s:authGroupFunction" class="view -edit -search"></div>
  <veda-control data-type="text" rows="2" property="v-s:authGroupFunction" class="-view edit search"></veda-control>

  <em about="v-s:GroupGeneratorUri" property="rdfs:label"></em>
  <code class="group-uri"></code>
  <hr>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:canCreate" data-type="boolean"></veda-control>
      <em about="v-s:canCreate" property="rdfs:label"></em>
    </label>
  </div>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:canRead" data-type="boolean"></veda-control>
      <em about="v-s:canRead" property="rdfs:label"></em>
    </label>
  </div>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:canUpdate" data-type="boolean"></veda-control>
      <em about="v-s:canUpdate" property="rdfs:label"></em>
    </label>
  </div>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:canDelete" data-type="boolean"></veda-control>
      <em about="v-s:canDelete" property="rdfs:label"></em>
    </label>
  </div>
  <br>
  <div class="actions view edit -search">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
  </div>
</div>
`;