export const html = `
<div>
  <h3>
    <span about="v-s:Delivery" property="rdfs:label"></span>
  </h3>
  <span about="@" data-template="v-ui:RabbitHole" class="view edit -search"></span>
  <hr>
  <div class="row">
    <div class="col-md-4">
      <em about="v-s:date" property="rdfs:label"></em>
      <div property="v-s:date" class="view -edit search"></div>
      <veda-control property="v-s:date" data-type="date" class="-view edit search"></veda-control>
    </div>
    <div class="col-md-4">
      <em about="v-s:deliverBy" property="rdfs:label"></em>
      <div rel="v-s:deliverBy" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
      <veda-control data-type="link" rel="v-s:deliverBy" class="-view edit search fulltext dropdown"></veda-control>
    </div>
  </div>
  <div class="row">
    <div class="col-md-8">
      <em about="rdfs:comment" property="rdfs:label"></em>
      <div property="rdfs:comment" class="view -edit -search"></div>
      <veda-control property="rdfs:comment" data-type="text" class="-view edit search"></veda-control>
      <em about="v-s:attachment" property="rdfs:label"></em>
      <div rel="v-s:attachment" data-template="v-ui:FileTemplateWithComment" data-embedded="true"></div>
      <veda-control data-type="file" rel="v-s:attachment" class="-view edit -search create"></veda-control>
    </div>
  </div>
  <hr>
  <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  <br>
  <div class="actions view edit -search">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete journal"></span>
  </div>
</div>
`;