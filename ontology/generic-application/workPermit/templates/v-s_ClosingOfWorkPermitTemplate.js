export const html = `
  <div>
    <div class="container sheet">
      <h2>
        <span about="v-s:hasClosingOfWorkPermit" property="rdfs:label"></span><br />
        <small about="@" property="rdfs:label"></small>
      </h2>
      <span about="@" data-template="v-ui:RabbitHole" class="view edit -search"></span>
      <br />
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:dateFromFact" property="rdfs:label"></label>
        </div>
        <div class="col-sm-3 col-xs-3">
            <div about="@" property="v-s:dateFromFact" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:dateFromFact" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:dateToFact" property="rdfs:label"></label>
        </div>
        <div class="col-sm-3 col-xs-3">
            <div about="@" property="v-s:dateToFact" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:dateToFact" class="-view edit search"></veda-control>
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
