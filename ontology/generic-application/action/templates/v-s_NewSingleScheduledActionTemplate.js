import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

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
    }
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  $('.action', template).click(function (e) {
    e.preventDefault();
    template[0].dispatchEvent(new Event(this.id));
  });
};

export const post = function (individual, template, container, mode, extra) {
  if (individual.hasValue('v-s:hasStatus', 'v-s:StatusProcessed')) {
    $('#edit', template).remove();
  }

  individual.on('v-s:linkedObject', uploadResponsibleProps);
  individual.on('v-s:propertyInDocument', updateResponsible);
  individual.on('propertyModified', handler)
  updateResponsible();
  async function uploadResponsibleProps () {
    if (!individual.hasValue("v-s:linkedObject")) return;
    const linkedDoc = await individual["v-s:linkedObject"][0].load();
    let propList = await getDocumentResponsibleProps(linkedDoc);

    const queryPrefix = propList.map( item => `'@' == '${item}'`).join("||");
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
      if (prop == "@" || prop == "v-s:creator" || prop == "v-s:lastEditor") continue;
      if ( document[prop][0] instanceof IndividualModel) {
        const subDoc = await document[prop][0].load();
        if ((subDoc.hasValue("rdf:type", "v-s:Position") || subDoc.hasValue("rdf:type", "v-s:Appointment")) && ! subDoc.hasValue("v-s:deleted", true)) {
          propList.push(prop);
        }
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
  <div>
    <div class="container sheet">
      <h3 class="margin-sm">
        <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span><br />
        <small about="@" property="rdfs:label" class="view edit -search"></small>
      </h3>
      <section id="MainProperties">
        <h4 class="section-header" about="v-s:MainProperties" property="rdfs:label"></h4>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:BacwardTargetBundle" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div about="@" rel="v-s:backwardTarget">
              <div about="@" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
            </div>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:description" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div property="v-s:description" class="view -edit -search"></div>
            <veda-control data-type="text" rows="1" property="v-s:description" class="-view edit -search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:TaskPeriodBundle" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:hasPeriod" class="view edit -search" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-s:hasPeriod" class="-view edit search fulltext dropdown"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:TaskDateBundle" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div property="v-s:dateToPlan" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:dateToPlan" class="-view edit -search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:TaskGiveAwatDateBundle" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div property="v-s:dateToFact" class="view edit -search"></div>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:hasStatus" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:hasStatus" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
          </div>
        </div>
      </section>
      <section id="responsibles">
        <h4 class="section-header" about="mnd-s:Contract_ResponsibleBundle" property="rdfs:label"></h4>
        <div class="alert alert-info -view edit">
          <div about="v-s:ResponsibleSelectBundle" proprty="rdfs:label"></div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:responsible" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:responsible" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
            <veda-control data-type="link" rel="v-s:responsible" class="-view edit -search fulltext"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5"> 
            <label about="v-s:LinkedDocTypeBundle" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:type" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
            <veda-control data-type="link" rel="v-s:type" data-query-prefix="'rdfs:subClassOf'==='v-s:UserSearchableDocument'" class="dropdown -view edit -search fulltext"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5"> 
            <label about="v-s:linkedObject" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:linkedObject" data-template="v-ui:LabelTemplate"  class="view -edit -search"></div>
            <veda-control data-type="link" rel="v-s:linkedObject" data-query-prefix="'rdf:type'=='{@.v-s:type.id}'" class="dropdown -view edit -search fulltext"></veda-control>    
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5"> 
            <label about="v-s:propertyInDocument" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:propertyInDocument" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
            <veda-control data-type="link" id="propertyInDocumentControl" rel="v-s:propertyInDocument" data-dynamic-query-prefix="true" class="dropdown -view edit -search fulltext"></veda-control>  
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5"> 
            <label about="v-s:CalculatedResponsibleBundle" property="rdfs:label" class="view edit -search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div id="calculatedResponsible"></div>
          </div>
        </div>
      </section>
      <hr />
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
      <br />
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save edit cancel delete journal"></span>
    </div>
  </div>
`;
