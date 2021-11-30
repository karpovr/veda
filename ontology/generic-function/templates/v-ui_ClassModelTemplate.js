export const html = `
<div class="container sheet">
  <div about="@" data-embedded="true" data-template="v-ui:CommonOntologyTemplate"></div>
  <h4 about="v-ui:forClass" property="rdfs:label"></h4>
  <div rel="v-ui:forClass" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
  <veda-control rel="v-ui:forClass" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
  <br>
  <veda-control property="v-s:script" data-type="source"></veda-control>
  <br>
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete destroy"></span>
  </div>
</div>
`;