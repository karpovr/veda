import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('.action', template).click(function (e) {
    e.preventDefault();
    template[0].dispatchEvent(new Event(this.id));
  });
};

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
            <label about="v-s:responsible" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:responsible" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
            <veda-control data-type="link" rel="v-s:responsible" class="-view edit -search fulltext"></veda-control>
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
      <hr />
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
      <br />
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save edit cancel delete journal"></span>
    </div>
  </div>
`;
