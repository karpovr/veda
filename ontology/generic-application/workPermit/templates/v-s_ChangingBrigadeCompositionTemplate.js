import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function saveHandler() {
    if (individual.hasValue('v-s:backwardTarget')) {
      if (individual.hasValue('v-s:memberOutOfBrigade') || individual.hasValue('v-s:memberInOfBrigade')) {
        return individual['v-s:backwardTarget'][0].load()
          .then(function(backward) {
            if (individual.hasValue('v-s:memberOutOfBrigade')) {
              const memberOut = individual['v-s:memberOutOfBrigade'][0];
              if (backward.hasValue('v-s:workPermit_actualBrigade', memberOut)) {
                backward['v-s:workPermit_actualBrigade'] = backward['v-s:workPermit_actualBrigade'].filter(function(item) {
                  return item.id != memberOut.id;
                })
              }
            }
            if (individual.hasValue('v-s:memberInOfBrigade')) {
              const memberIn = individual['v-s:memberInOfBrigade'][0];
              if (!backward.hasValue('v-s:workPermit_actualBrigade', memberIn)) {
                backward['v-s:workPermit_actualBrigade'] = backward['v-s:workPermit_actualBrigade'].concat(memberIn);
              } 
            }
            return backward.save();
          })
          .catch(function(err) {
            console.log(err);
          })
      }
    }
  }

  individual.on('beforeSave', saveHandler);
  template.one('remove', function () {
    individual.off('beforeSave', saveHandler);
  });
  
};

export const html = `
  <div>
    <div class="container sheet">
      <h2>
        <span about="v-s:hasChangingBrigadeComposition" property="rdfs:label"></span><br />
        <small about="@" property="rdfs:label"></small>
      </h2>
      <span about="@" data-template="v-ui:RabbitHole" class="view edit -search"></span>
      <br />
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:memberOutOfBrigade" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div rel="v-s:memberOutOfBrigade" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
            <veda-control rel="v-s:memberOutOfBrigade" data-type="link" class="-view edit search fulltext"></veda-control>
        </div>
      </div>         
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:functionOfmemberOutOfBrigade" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div about="@" property="v-s:functionOfmemberOutOfBrigade" class="view -edit -search"></div>
            <veda-control data-type="text" property="v-s:functionOfmemberOutOfBrigade" class="-view edit search"></veda-control>
        </div>
      </div>   
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:reason" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div about="@" property="v-s:reason" class="view -edit -search"></div>
            <veda-control data-type="text" property="v-s:reason" class="-view edit search"></veda-control>
        </div>
      </div>         
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:date" property="rdfs:label"></label>
        </div>
        <div class="col-sm-3 col-xs-3">
            <div about="@" property="v-s:date" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:date" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:memberInOfBrigade" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div rel="v-s:memberInOfBrigade" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
            <veda-control rel="v-s:memberInOfBrigade" data-type="link" class="-view edit search fulltext"></veda-control>
        </div>
      </div>         
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:functionOfmemberInOfBrigade" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div about="@" property="v-s:functionOfmemberInOfBrigade" class="view -edit -search"></div>
            <veda-control data-type="text" property="v-s:functionOfmemberInOfBrigade" class="-view edit search"></veda-control>
        </div>
      </div>   
      <hr />
      <!--Системные свойства-->
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
      <br />
      <!-- BUTTONS -->
      <div class="actions view edit -search">
        <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
      </div>
    </div>
  </div>
`;
