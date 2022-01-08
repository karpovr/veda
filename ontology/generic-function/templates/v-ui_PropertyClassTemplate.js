export const html = `
  <div class="container sheet">
    <div about="@" data-embedded="true" data-template="v-ui:CommonOntologyTemplate"></div>
    <veda-control rel="rdf:type" data-type="radio" class="-view edit search"></veda-control>
    <br class="-view edit search" />
    <h4 about="v-s:SuperPropertiesBundle" property="rdfs:label"></h4>
    <div rel="rdfs:subPropertyOf" data-template="v-ui:LabelLinkTemplate" class="view edit search"></div>
    <veda-control rel="rdfs:subPropertyOf" class="-view edit search fulltext dropdown"></veda-control>
    <br />
    <div class="row">
      <div class="col-md-6">
        <h4 about="rdfs:domain" property="rdfs:label"></h4>
        <div rel="rdfs:domain" data-template="v-ui:LabelLinkTemplate"></div>
        <veda-control rel="rdfs:domain" class="-view edit search fulltext dropdown"></veda-control>
      </div>
      <div class="col-md-6">
        <h4 about="rdfs:range" property="rdfs:label"></h4>
        <div rel="rdfs:range" data-template="v-ui:LabelLinkTemplate"></div>
        <veda-control rel="rdfs:range" class="-view edit search fulltext dropdown"></veda-control>
      </div>
    </div>
    <hr />
    <div class="actions">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete destroy"></span>
    </div>
  </div>
`;
