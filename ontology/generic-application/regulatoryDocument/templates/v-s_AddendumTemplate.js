export const html = `
  <div class="container sheet">
    <h2>
      <span about="v-s:Addendum" property="rdfs:label"></span>
      <small about="@" property="rdfs:label"></small>
    </h2>
    <span about="@" data-template="v-ui:RabbitHole"></span>
    <hr />
    <div class="checkbox no-margin">
      <label>
        <veda-control property="v-s:valid" data-type="boolean"></veda-control>
        <em about="v-s:valid" property="rdfs:label"></em>
      </label>
    </div>
    <em about="rdfs:label" property="rdfs:label"></em>
    <div property="rdfs:label" class="view -edit -search"></div>
    <veda-control data-type="text" property="rdfs:label" class="-view edit search"></veda-control>
    <div class="row">
      <div class="col-md-4">
        <em about="v-s:dateFrom" property="rdfs:label"></em>
        <div property="v-s:dateFrom" class="view -edit -search"></div>
        <veda-control property="v-s:dateFrom" data-type="date" class="-view edit search"></veda-control>
      </div>
      <div class="col-md-4">
        <em about="v-s:dateTo" property="rdfs:label"></em>
        <div property="v-s:dateTo" class="view -edit -search"></div>
        <veda-control property="v-s:dateTo" data-type="date" class="-view edit search"></veda-control>
      </div>
    </div>
    <em about="v-s:attachment" property="rdfs:label"></em>
    <div rel="v-s:attachment" data-template="v-ui:FileTemplateWithComment" data-embedded="true"></div>
    <veda-control data-type="file" rel="v-s:attachment" class="-view edit -search"></veda-control>
    <div id="systemProperties">
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    </div>
    <!--#systemProperties-->
    <br />
    <!-- BUTTONS -->
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete journal task"></span>
    </div>
  </div>
`;
