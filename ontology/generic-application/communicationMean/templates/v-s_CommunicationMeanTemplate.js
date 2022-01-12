export const html = `
  <div>
    <h2>
      <span about="v-s:CommunicationMean" property="rdfs:label"></span>
      <small about="@" property="rdfs:label"></small>
    </h2>
    <div class="panel panel-default">
      <div class="panel-body">
        <div class="row">
          <div class="col-md-3">
            <em about="v-s:hasCommunicationMeanChannel" property="rdfs:label"></em>
            <veda-control rel="v-s:hasCommunicationMeanChannel" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
            <div rel="v-s:hasCommunicationMeanChannel" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
          </div>
          <div class="col-md-3">
            <em about="v-s:hasCommunicationMeanTarget" property="rdfs:label" class="view edit -search"></em>
            <veda-control rel="v-s:hasCommunicationMeanTarget" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
            <div rel="v-s:hasCommunicationMeanTarget" class="view -edit -search" data-template="v-ui:LabelTemplate"></div>
          </div>
          <div class="col-md-3">
            <em about="v-s:description" property="rdfs:label" class="view edit -search"></em>
            <div property="v-s:description" class="view -edit -search"></div>
            <veda-control property="v-s:description" data-type="string" class="-view edit -search"></veda-control>
          </div>
          <div class="col-md-3">
            <em about="rdfs:comment" property="rdfs:label" class="view edit -search"></em>
            <div property="rdfs:comment" class="view -edit -search"></div>
            <veda-control property="rdfs:comment" data-type="string" class="-view edit -search"></veda-control>
          </div>
        </div>
        <hr />
        <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
        <br />
        <!-- BUTTONS -->
        <div class="actions">
          <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
        </div>
      </div>
    </div>
  </div>
`;
