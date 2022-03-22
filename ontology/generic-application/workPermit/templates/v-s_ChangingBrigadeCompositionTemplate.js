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
            <div rel="v-s:memberOutOfBrigade" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
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
            <div rel="v-s:memberInOfBrigade" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
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
