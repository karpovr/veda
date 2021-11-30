export const html = `
<div class="container sheet">
  <h2>
    <span about="v-s:Subsidiary" property="rdfs:label"></span>
    <small about="@" property="rdfs:label"></small>
  </h2>
  <span about="@" data-template="v-ui:RabbitHole"></span>
  <hr>
  <div id="mainProperties">
    <em about="v-s:parentOrganization" property="rdfs:label"></em>
    <span about="@" rel="v-s:backwardTarget" data-template="v-ui:LabelLinkTemplate"></span>

    <hr class="view -edit -search">

    <em about="v-s:FullNameOrgBundle" property="rdfs:label"></em>
    <div property="v-s:title" class="view -edit -search"></div>
    <veda-control data-type="string" property="v-s:title" class="-view edit search"></veda-control>

    <em about="rdfs:label" property="rdfs:label"></em>
    <div property="rdfs:label" class="view -edit -search"></div>
    <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>

    <hr class="view -edit -search">

    <div class="row">
      <div class="col-sm-4">
        <em about="v-s:taxRegistrationCause" property="rdfs:label"></em>
        <div property="v-s:taxRegistrationCause" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:taxRegistrationCause" class="-view edit search"></veda-control>
      </div>
    </div>

    <hr class="view -edit -search">

    <em about="v-s:postalAddress" property="rdfs:label"></em>
    <div property="v-s:postalAddress" class="view -edit -search"></div>
    <veda-control data-type="text" rows="3" property="v-s:postalAddress" class="-view edit search"></veda-control>

    <hr class="view -edit -search">

    <em about="rdfs:comment" property="rdfs:label"></em>
    <div property="rdfs:comment" class="view -edit -search"></div>
    <veda-control data-type="text" rows="3" property="rdfs:comment" class="-view edit search"></veda-control>
  </div>

  <hr>
  <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  <br>
  <!-- BUTTONS -->
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true"
      data-buttons="edit save cancel delete"></span>
  </div>
</div>
`;