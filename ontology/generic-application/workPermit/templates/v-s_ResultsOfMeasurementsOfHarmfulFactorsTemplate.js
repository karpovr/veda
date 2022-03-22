export const html = `
  <div>
    <div class="container sheet">
      <h2>
        <span about="v-s:hasResultsOfMeasurementsOfHarmfulFactors" property="rdfs:label"></span><br />
        <small about="@" property="rdfs:label"></small>
      </h2>
      <span about="@" data-template="v-ui:RabbitHole" class="view edit -search"></span>
      <br />
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:DateForResultsOfMeasurementsOfHarmfulFactors_Bundle" property="rdfs:label"></label>
        </div>
        <div class="col-sm-3 col-xs-3">
            <div about="@" property="v-s:date" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:date" class="-view edit search"></veda-control>
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
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:hasHarmfulSubstance" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div rel="v-s:hasHarmfulSubstance" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
            <veda-control rel="v-s:hasHarmfulSubstance" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
        </div>
      </div>    
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:description" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div about="@" property="v-s:description" class="view -edit -search"></div>
            <veda-control data-type="text" property="v-s:description" class="-view edit search"></veda-control>
        </div>
      </div>   
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:responsible" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
            <div about="@" rel="v-s:responsible" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
            <veda-control rel="v-s:responsible" data-type="link" class="-view edit search fulltext"></veda-control>
        </div>
      </div>               
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
