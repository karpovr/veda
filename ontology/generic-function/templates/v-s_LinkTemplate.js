import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if(individual.hasValue("v-s:mutualMembership")){
  $('#mutualMembership', template).removeClass('hidden');
}
else if (individual.hasValue("v-s:fromMemberOfTo")) {
  $('#fromMemberOfTo', template).removeClass('hidden');
}
else if (individual.hasValue("v-s:toMemberOfFrom")) {
  $('#toMemberOfFrom', template).removeClass('hidden');
}
else {
  $('#empty', template).removeClass('hidden');
}
};

export const html = `
<div class="container sheet">
  <h3 about="v-s:Link" property="rdfs:label"></h3>
  <div class="row">
    <div class="col-md-3">
      <em about="v-s:MainDocumentBundle" property="rdfs:label"></em>
      <div about="@" rel="v-s:from" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
    </div>
    <div class="col-md-1">
        <em about="v-s:RigthsBundle" property="rdfs:label"></em>
        <span id="mutualMembership" class="glyphicon glyphicon-resize-horizontal hidden"></span>
        <span id="fromMemberOfTo" class="glyphicon glyphicon-arrow-right hidden"></span>
        <span id="toMemberOfFrom" class="glyphicon glyphicon-arrow-left hidden"></span>
        <span id="empty" class="glyphicon glyphicon-ban-circle hidden"></span>
    </div>
    <div class="col-md-3">
      <em about="v-s:LinkedDocumentBundle" property="rdfs:label"></em>
      <div about="@" rel="v-s:to" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
    </div>
    <div class="col-md-3">
      <em about="rdfs:comment" property="rdfs:label"></em>
      <div about="@" property="rdfs:comment" class="view -edit -search"></div>
      <veda-control data-type="string" property="rdfs:comment" class="-view edit search"></veda-control>
    </div>
  </div>
  <div about="@" data-template="v-ui:SystemPropertiesNewTemplate" data-embedded="true"></div><br>
<!-- BUTTONS -->
<div class="actions view edit -search">
  <span about="@" class="pull-left" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
</div>
</div>
`;