export const html = `
<div class="container sheet">
  <h2>
    <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
  </h2>
  <!-- <div class="row">
    <div class="col-md-5 col-xs-5 text-right name">
      <strong class="text-muted" about="v-wf:aggregate" property="rdfs:label"></strong>
    </div>
    <div class="col-md-7 col-xs-7" rel="transformRule">
      <span class="view search -create" property="@"></span>
      <veda-control property="@" class="-view edit create"></veda-control>
    </div>
  </div> -->
  <div class="row">
    <div class="col-md-5">
      <em about="v-wf:transformRule" property="rdfs:label"></em>
    </div>
  </div>
  <div rel="v-wf:transformRule" data-template="v-wf:RuleTemplate" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:transformRule" class="view edit search create"></veda-control>
  <hr style="margin: 10px 0px">
  <div class="actions view edit -search">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
  </div>
</div>
`;
