import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  $("#memberOf", template).change(function() {
    var uri = $(this).val();
    if (uri) {
      individual["v-s:memberOf"] = [new IndividualModel(uri)];
    } else {
      individual["v-s:memberOf"] = [];
    }
  });

  $("#resource", template).change(function() {
    var uri = $(this).val();
    if (uri) {
      individual["v-s:resource"] = [new IndividualModel(uri)];
    } else {
      individual["v-s:resource"] = [];
    }
  });
};

export const html = `
<div class="container sheet">
  <h2 about="v-s:Membership" property="rdfs:label"></h2>
  <hr>
  <em about="rdfs:label" property="rdfs:label"></em>
  <div property="rdfs:label" class="view -edit -search"></div>
  <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>

  <em about="rdfs:comment" property="rdfs:label"></em>
  <div property="rdfs:comment" class="view -edit -search"></div>
  <veda-control data-type="text" rows="2" property="rdfs:comment" class="-view edit search"></veda-control>

  <em about="v-s:memberOf" property="rdfs:label"></em>
  <div rel="v-s:memberOf" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
  <input id="memberOf" type="text" class="-view edit search form-control"/>

  <em about="v-s:resource" property="rdfs:label"></em>
  <div rel="v-s:resource" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
  <input id="resource" type="text" class="-view edit search form-control"/>

  <em about="v-s:updateCounter" property="rdfs:label"></em>
  <div property="v-s:updateCounter" class="view edit search"></div>
  <veda-control data-type="integer" property="v-s:updateCounter" class="-view edit search"></veda-control>

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
  <div about="@" data-template="v-ui:SystemPropertiesNewTemplate" data-embedded="true"></div>
</div>
`;