import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (mode == 'search') {
    $('.remove-panel-search', template).removeClass('panel panel-default panel-body');
  }

  template.on('validate', function () {
    const result = {};

    if (individual.hasValue('v-s:dateToPlan') && individual.hasValue('v-s:hasPeriod')) {
      const dateToPlan = individual['v-s:dateToPlan'][0];
      const period = individual['v-s:hasPeriod'][0].id;
      let isDateToPlanValid = true;
      const now = new Date();
      let delta;
      if (period == 'd:jsc4p8dq5u4fm1sumekuifkw7r') { //час
        delta = 86400000/24;
      } else if (period == 'd:z8r34mi5y8rl8m4kbo3q69uw5d') { // день
        delta = 86400000;
      } else if (period == 'd:a21t5y3pswuewm8ohjexiqtxscr') { // неделя
        delta = 86400000*7;
      } if (period == 'd:fb27kxa3r98ilnkvmy99xc11p1') { // 2 недели
        delta = 86400000*14;
      } else if (period == 'd:pqauzdiqyls7pzrawelnh2zwj3') { // месяц
        delta = 86400000*30;
      } else if (period == 'd:d2cloqhm8yqaq8t68zi9iepc69') { // 2 месяца
        delta = 86400000*61;
      } else if (period == 'd:a28m44dm9yw04j7hf69r4i40sn5') { // квартал
        delta = 86400000*121;
      } if (period == 'd:p699yrkgnd7bamjaqwx305o5hi') { // год
        delta = 86400000*365;
      } else if (period == 'd:q3qlurph45v2trm8kfmmdqtj04') { // 2 года
        delta = 86400000*730;
      }
      if (+dateToPlan < +now + delta) {
        result['v-s:dateToPlan'] = {
          state: false,
          cause: ['v-ui:minCardinality']
        }
      }
    }

    if (individual.hasValue("v-s:propertyInDocument")) {
      result["v-s:responsible"] = {
        state: true
      }
    } 
    
    if (individual.hasValue("v-s:responsible")) {
      result["v-s:propertyInDocument"] = {
        state: true
      };

      result["v-s:type"] = {
        state: true
      };
      
      result["v-s:linkedObject"] = {
        state: true
      };
    } 
    
    if (individual.hasValue("v-s:propertyInDocument") && individual.hasValue("v-s:responsible")) {
      result['v-s:propertyInDocument'] = {
        state: false,
        cause: ['v-ui:maxCardinality']
      };
      result["v-s:responsible"] = {
        state: false,
        cause: ['v-ui:maxCardinality']
      }
    }

    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  $('.action', template).click(function (e) {
    e.preventDefault();
    template[0].dispatchEvent(new Event(this.id));
  });
};

export const post = function (individual, template, container, mode, extra) {
  individual.on('v-s:responsible', () => {individual['v-s:type'] = []});
  individual.on('v-s:linkedObject', uploadResponsibleProps);
  individual.on('v-s:propertyInDocument', updateResponsible);
  individual.on('propertyModified', handler)
  updateResponsible();
  async function uploadResponsibleProps () {
    if (!individual.hasValue("v-s:linkedObject")) return;
    const linkedDoc = await individual["v-s:linkedObject"][0].load();
    let propList = await getDocumentResponsibleProps(linkedDoc);
    if (propList.length == 0) return;
    const queryPrefix = "(" + propList.map( item => `'@' == '${item}'`).join("||") + " ) && 'rdf:type' == 'owl:ObjectProperty'";
    $('#propertyInDocumentControl', template).attr('data-query-prefix', queryPrefix);
  }

  async function updateResponsible () {
    const cntr = $('#calculatedResponsible', template);
    if (individual.hasValue('v-s:linkedObject') && individual.hasValue('v-s:propertyInDocument')) {
      const subDoc = await individual["v-s:linkedObject"][0].load();
      let responsibles = subDoc[individual['v-s:propertyInDocument'][0].id];
      cntr.empty();
      responsibles.forEach(resp => { resp.present(cntr, "v-ui:LabelTemplate", "view")});
    } else {
      cntr.empty();
    }
  }

  async function getDocumentResponsibleProps (document) {
    await document.load();
    if (!document instanceof IndividualModel) return;
    let propList = [];

    for (let prop in document.toJson() ) {
      try {
        if (prop == "@" || prop == "v-s:creator" || prop == "v-s:lastEditor") continue;
        if ( document[prop][0] instanceof IndividualModel) {
          const subDoc = await document[prop][0].load();
          if ((subDoc.hasValue("rdf:type", "v-s:Position") || subDoc.hasValue("rdf:type", "v-s:Appointment")) && ! subDoc.hasValue("v-s:deleted", true)) {
            propList.push(prop);
          }
        }
      } catch (error) {
        console.log(error)
      }
    }
    return propList
  }

  async function handler (propertyUri) {
    if (propertyUri == "v-s:type") {
      individual["v-s:linkedObject"] = [];
    }
    if (propertyUri == "v-s:linkedObject") {
      individual['v-s:propertyInDocument'] = [];
    }
  }
}

export const html = `
<div class="container sheet">
  <div class="remove-panel-search panel panel-default" style="margin-top: 20px">
    <div class="remove-panel-search panel-body">
      <h2 class="-view -edit search">
        <span about="v-s:ScheduledAction" property="rdfs:label"></span>
        <small about="@" property="rdfs:label"></small>
      </h2>
      <em about="v-s:description" property="rdfs:label"></em>
      <div property="v-s:description" class="view -edit search"></div>
      <veda-control data-type="text" rows="1" property="v-s:description" class="-view edit search"></veda-control>
      <div class="row" style="margin-top: 15px;">
        <div class="col-md-6">
          <div class="panel panel-default panel-body" id="calculatedResponsibleContainer">
            <span about="v-s:ResponsibleSelectSingleBundle" property="rdfs:label"></span>
          <em about="v-s:responsible" property="rdfs:label"></em>
          <div rel="v-s:responsible" data-template="v-ui:LabelTemplate" class="view edit search"></div>
          <veda-control data-type="link" rel="v-s:responsible" class="-view edit search fulltext"></veda-control>
          </div>
        </div>
        <div class="col-md-6">
          <div class="panel panel-default panel-body" id="calculatedResponsibleContainer">
            <span about="v-s:ResponsibleSelectFromDocBundle" property="rdfs:label"></span>
          <em about="v-s:LinkedDocTypeBundle" property="rdfs:label"></em>
          <div rel="v-s:type" data-template="v-ui:LabelTemplate" class="view -edit search"></div>
          <veda-control data-type="link" rel="v-s:type" data-query-prefix="'rdfs:subClassOf'==='v-s:UserSearchableDocument'" class="dropdown -view edit search fulltext"></veda-control>

          <em about="v-s:linkedObject" property="rdfs:label"></em>
          <div rel="v-s:linkedObject" data-template="v-ui:LabelTemplate"  class="view -edit search"></div>
          <veda-control data-type="link" rel="v-s:linkedObject" data-query-prefix="'rdf:type'=='{@.v-s:type.id}'" class="dropdown -view edit search fulltext"></veda-control>

          <em about="v-s:propertyInDocument" property="rdfs:label" class="-view edit -search"></em>
          <div rel="v-s:propertyInDocument" data-template="v-ui:LabelTemplate" class="view -edit search"></div>
          <veda-control data-type="link" data-query-prefix="'rdf:type' == 'owl:ObjectProperty'" id="propertyInDocumentControl" rel="v-s:propertyInDocument" data-dynamic-query-prefix="true" class="dropdown -view edit -search fulltext"></veda-control>

          <em about="v-s:CalculatedResponsibleBundle" property="rdfs:label" class="view edit -search"></em>
          <div id="calculatedResponsible" class="view edit -search"></div>
          </div>
        </div> 
        <div class="col-md-12">
          <em about="v-s:controller" property="rdfs:label"></em>
          <div rel="v-s:controller" data-template="v-ui:LabelTemplate" class="view -edit search"></div>
          <veda-control data-type="link" rel="v-s:controller" class="-view edit search fulltext"></veda-control>
        </div>
        <div class="col-md-6">
          <em about="v-s:TaskPeriodBundle" property="rdfs:label"></em>
          <div rel="v-s:hasPeriod" class="view edit search" data-template="v-ui:LabelTemplate"></div>
          <veda-control data-type="link" rel="v-s:hasPeriod" class="-view edit search fulltext dropdown"></veda-control>
        </div>
        <div class="col-md-6 -view edit -search">
          <em about="v-s:TaskDateBundle" property="rdfs:label"></em>
          <div property="v-s:dateToPlan" class="view -edit -search"></div>
          <veda-control data-type="dateTime" property="v-s:dateToPlan" class="-view edit -search"></veda-control>
        </div>
        <div class="col-md-6 view search -edit">
          <em about="v-s:TaskGiveAwatDateBundle" property="rdfs:label"></em>
          <div property="v-s:dateToFact" class="view edit search"></div>
          <veda-control data-type="dateTime" property="v-s:dateToFact" class="-view -edit search"></veda-control>
        </div>
        <div class="col-md-6 view search -edit">
          <em about="v-s:hasStatus" property="rdfs:label"></em>
          <div rel="v-s:hasStatus" data-template="v-ui:LabelTemplate" class="view edit search"></div>
          <veda-control
            data-type="link"
            rel="v-s:hasStatus"
            class="dropdown -view -edit search fulltext"
            data-query-prefix="'@'=='v-s:StatusProcessed' || '@'=='v-s:StatusPartiallyProcessed'"></veda-control>
        </div>
      </div>
      <br />
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save edit cancel delete"></span>
    </div>
  </div>
</div>
`;
