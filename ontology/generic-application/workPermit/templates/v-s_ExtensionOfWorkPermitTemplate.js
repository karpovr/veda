import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);
  
  template.on('validate', function () {
    const result = {};
    let dateState = false;
    if (individual.hasValue('v-s:dateTo') && individual.hasValue('v-s:dateFrom')) {
      if (individual['v-s:dateTo'][0] <= individual['v-s:dateFrom'][0]) {
        result['v-s:dateTo'] = {
          state: false,
          cause: ['mnd-s:DateFromToPlan_Bundle'],
        };  
      } else if ((individual['v-s:dateTo'][0] - individual['v-s:dateFrom'][0]) > (1000*60*60*24*7)) {
        result['v-s:dateTo'] = {
          state: false,
          cause: ['v-ui:maxCardinality'],
        };
      }
    }
    if (individual.hasValue('v-s:dateFrom')) {
      //смещение в 5 минут, так как поля со временем
      const shift = 1000 * 60 * 5;
      const diff = individual['v-s:dateFrom'][0] - new Date();
      if (diff < -shift && individual.isNew()) {
        result['v-s:dateFrom'] = {
          state: false,
          cause: ['v-ui:minCardinality'],
        };
      }
    }
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  // права зелёной кнопки
  const _classResults = new IndividualModel('v-s:ResultsOfMeasurementsOfHarmfulFactors');
  _classResults.canCreate().then(function (canCreate) {
    if (!canCreate) {
      $('#add-ResultsOfMeasurementsOfHarmfulFactor', template).remove();
    }
  });


  $('button#add-ResultsOfMeasurementsOfHarmfulFactors', template).click(function () {
    let modal = $('#notification-modal-template').html();
    modal = $(modal);
    modal.modal({show: false});
    $('body').append(modal);
    modal.modal('show');
    template.one('remove', function () {
      modal.modal('hide').remove();
    });
    const cntr = $('.modal-body', modal);
    const _class = new veda.IndividualModel('v-s:ResultsOfMeasurementsOfHarmfulFactors');
    const IdeaState = new veda.IndividualModel();
    const tmpl = new veda.IndividualModel('v-s:ResultsOfMeasurementsOfHarmfulFactorsTemplate');
    IdeaState['rdf:type'] = [_class];
    IdeaState.present(cntr, tmpl, 'edit');
    IdeaState['v-s:backwardTarget'] = [individual];
    IdeaState['v-s:backwardProperty'] = [new veda.IndividualModel('v-s:hasResultsOfMeasurementsOfHarmfulFactors')];
    IdeaState['v-s:canRead'] = [true];
    IdeaState.one('beforeReset', function () {
      modal.modal('hide').remove();
    });
    IdeaState.one('afterSave', function () {
      modal.modal('hide').remove();
    });
  });

};

export const html = `
  <div>
    <div class="container sheet">
      <h2>
        <span about="v-s:hasExtensionOfWorkPermit" property="rdfs:label"></span><br />
        <small about="@" property="rdfs:label"></small>
      </h2>
      <span about="@" data-template="v-ui:RabbitHole" class="view edit -search"></span>
      <br />
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:dateFrom" property="rdfs:label"></label>
        </div>
        <div class="col-sm-3 col-xs-3">
            <div about="@" property="v-s:dateFrom" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:dateFrom" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:dateTo" property="rdfs:label"></label>
        </div>
        <div class="col-sm-3 col-xs-3">
            <div about="@" property="v-s:dateTo" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:dateTo" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:placeDescription" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div about="@" property="v-s:placeDescription" class="view -edit -search"></div>
            <veda-control data-type="text" property="v-s:placeDescription" class="-view edit search"></veda-control>
        </div>
      </div>   
      <section class="view edit -search" id="hasResultsOfMeasurementsOfHarmfulFactors">
      <h4 class="section-header clearfix">
        <span about="v-s:hasResultsOfMeasurementsOfHarmfulFactors" property="rdfs:label"></span>
        <button class="btn btn-xs btn-success margin-lg-h view -edit -search" id="add-ResultsOfMeasurementsOfHarmfulFactors">
          <span class="glyphicon glyphicon-zoom-in"></span>
          <span about="v-s:hasResultsOfMeasurementsOfHarmfulFactors" property="rdfs:label"> </span>
        </button>
        <span about="v-s:hasResultsOfMeasurementsOfHarmfulFactors" data-template="v-ui:SectionHeaderTemplate"></span>
      </h4>
      <div class="section-content">
        <div class="table-responsive">
          <table class="table">
            <thead class="result-header">
              <tr>
                <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
                <th about="v-s:DateForResultsOfMeasurementsOfHarmfulFactors_Bundle" property="rdfs:label"></th>
                <th about="v-s:placeDescription" property="rdfs:label"></th>
                <th about="v-s:hasHarmfulSubstance" property="rdfs:label"></th>
                <th about="v-s:description" property="rdfs:label"></th>
                <th about="v-s:responsible" property="rdfs:label"></th>
              </tr>
            </thead>
            <tbody about="@" rel="v-s:hasResultsOfMeasurementsOfHarmfulFactors" data-embedded="true">
              <tr>
                <td about="@" data-template="v-ui:IconModalTemplate"></td>
                <td>
                  <div about="@" property="v-s:date" class="view edit -search"></div>
                  <veda-control data-type="dateTime" property="v-s:date" class="-view -edit search"></veda-control>
                </td>
                <td>
                  <div about="@" property="v-s:placeDescription" class="view edit -search"></div>
                  <veda-control data-type="text" property="v-s:placeDescription" class="-view -edit search"></veda-control>
                </td>
                <td>
                  <div about="@" rel="v-s:hasHarmfulSubstance" data-template="v-ui:LabelTemplate" class="view edit search"></div>
                  <veda-control rel="v-s:hasHarmfulSubstance" data-type="link" class="-view -edit search fulltext dropdown"></veda-control>
                </td>
                <td>
                  <div about="@" property="v-s:description" class="view edit -search"></div>
                  <veda-control data-type="text" property="v-s:description" class="-view -edit search"></veda-control>
                </td>
                <td>
                  <div about="@" rel="v-s:responsible" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
                  <veda-control data-type="link" rel="v-s:responsible" class="-view -edit search fulltext"></veda-control>
                </td>
              </tr>
            </tbody>
          </table>
      </div>
      </section>      

         
      <hr />
      <!--Системные свойства-->
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
      <br />
      <!-- BUTTONS -->
      <div class="actions view edit -search">
        <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete journal "></span>
      </div>
    </div>
  </div>
`;
