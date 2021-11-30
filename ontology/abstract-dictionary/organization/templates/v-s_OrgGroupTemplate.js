export const html = `
<div class="container sheet">
  <h2>
    <span about="v-s:OrgGroup" property="rdfs:label"></span>
    <small about="@" property="rdfs:label"></small>
  </h2>
  <span about="@" data-template="v-ui:RabbitHole"></span>
  <hr>
  <div id="mainProperties">
    <em about="v-s:parentOrganization" property="rdfs:label"></em>
    <span about="@" rel="v-s:backwardTarget" data-template="v-ui:LabelLinkTemplate"></span>

    <hr class="view -edit -search">

    <em about="rdfs:label" property="rdfs:label"></em>
    <div property="rdfs:label" class="view -edit -search"></div>
    <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>

    <hr class="view -edit -search">
    <em about="v-s:hasCommunicationMean" property="rdfs:label"></em>
    <table class="table table-condensed table-bordered">
      <thead>
        <tr class="view edit -search active">
          <th width="1%"><span class="glyphicon glyphicon-search"></th>
          <th about="v-s:hasCommunicationMeanChannel" property="rdfs:label"></th>
          <th about="v-s:hasCommunicationMeanTarget" property="rdfs:label"></th>
          <th about="v-s:description" property="rdfs:label"></th>
          <th about="rdfs:comment" property="rdfs:label"></th>
        </tr>
      </thead>
      <tbody rel="v-s:hasCommunicationMean" data-embedded="true" data-template="v-s:CommunicationMeanTemplateEmbedded">
      </tbody>
    </table>
    <veda-control data-type="link" rel="v-s:hasCommunicationMean" class="-view edit -search create"></veda-control>

  </div>

  <hr>
  <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  <br>
  <!-- BUTTONS -->
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
  </div>
</div>
`;