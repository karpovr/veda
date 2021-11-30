import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  $(".action", template).click(function (e) {
    e.preventDefault();
    template[0].dispatchEvent(new Event(this.id));
  });
};

export const html = `
<div class="panel panel-default" style="margin-top: 20px">
  <div class="panel-body">
    <em about="v-s:description" property="rdfs:label"></em>
    <div property="v-s:description" class="view -edit -search"></div>
    <veda-control data-type="text" rows="1" property="v-s:description" class="-view edit -search"></veda-control>
    <div class="row">
      <div class="col-md-5">
        <em about="v-s:responsible" property="rdfs:label"></em>
        <div rel="v-s:responsible" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
        <veda-control data-type="link" rel="v-s:responsible" class="-view edit -search fulltext"></veda-control>

        <em about="v-s:controller" property="rdfs:label"></em>
        <div rel="v-s:controller" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
        <veda-control data-type="link" rel="v-s:controller" class="-view edit -search fulltext"></veda-control>
      </div>
      <div class="col-md-7">
        <div class="col-md-7">
          <em about="v-s:TaskPeriodBundle" property="rdfs:label"></em>
          <div rel="v-s:hasPeriod" class="view edit -search" data-template="v-ui:LabelTemplate"></div>
          <veda-control data-type="link" rel="v-s:hasPeriod" class="-view edit search fulltext dropdown"></veda-control>
        </div>
        <div class="col-md-5">
          <em about="v-s:TaskDateBundle" property="rdfs:label"></em>
          <div property="v-s:dateToPlan" class="view -edit -search"></div>
          <veda-control data-type="dateTime" property="v-s:dateToPlan" class="-view edit -search"></veda-control>
        </div>
        <div class="col-md-7">
          <em about="v-s:TaskGiveAwatDateBundle" property="rdfs:label"></em>
          <div property="v-s:dateToFact" class="view edit -search"></div>
        </div>
        <div class="col-md-5">
          <em about="v-s:hasStatus" property="rdfs:label"></em>
          <div rel="v-s:hasStatus" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
        </div>
      </div>
    </div>
    <br>
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save edit cancel delete"></span>
  </div>
</div>
`;