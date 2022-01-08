export const html = `
  <div class="container sheet">
    <h3><span about="@" property="rdfs:label"></span></h3>
    <span about="@" data-template="v-ui:RabbitHole" data-properties="v-s:parentUnit"></span>
    <hr />
    <div>
      <div class="-view edit search">
        <em about="rdfs:label" property="rdfs:label"></em>
        <div property="rdfs:label" class="view -edit -search"></div>
        <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>
        <hr class="view -edit -search" />
      </div>
      <em about="v-s:parentUnit" property="rdfs:label"></em>
      <div rel="v-s:parentUnit" class="view -edit -search" data-template="v-ui:LabelLinkTemplate"></div>
      <veda-control data-type="link" rel="v-s:parentUnit" class="-view edit search fulltext"></veda-control>
      <div class="row">
        <div class="col-sm-6">
          <em about="v-s:hasChief" property="rdfs:label"></em>
          <div rel="v-s:hasChief" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
          <veda-control data-type="link" rel="v-s:hasChief" class="-view edit search fulltext"></veda-control>
        </div>
        <div class="col-sm-6">
          <em about="v-s:hasFunctionalChief" property="rdfs:label"></em>
          <div rel="v-s:hasFunctionalChief" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
          <veda-control data-type="link" rel="v-s:hasFunctionalChief" class="-view edit search fulltext"></veda-control>
        </div>
      </div>
    </div>
    <br />
    <!-- BUTTONS -->
    <div class="actions">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
    </div>
  </div>
`;
