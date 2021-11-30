export const html = `
<div class="container sheet">
  <h2>
    <span about="v-s:Contractor" property="rdfs:label"></span>
    <small about="@" property="rdfs:label"></small>
  </h2>
  <hr>
  <div class="row">
    <div class="col-md-4">
      <em about="v-s:registrationNumber" property="rdfs:label"></em>
      <div property="v-s:registrationNumber" class="view -edit -search"></div>
      <veda-control data-type="text" property="v-s:registrationNumber" class="-view edit search"></veda-control>
    </div>
    <div class="col-md-2">
      <em about="v-s:taxId" property="rdfs:label"></em>
      <div property="v-s:taxId" class="view -edit -search"></div>
      <veda-control data-type="string" property="v-s:taxId" class="-view edit search"></veda-control>
    </div>
    <div class="col-sm-2">
    <em about="v-s:taxRegistrationCause" property="rdfs:label"></em>
    <div property="v-s:taxRegistrationCause" class="view -edit -search"></div>
    <veda-control data-type="string" property="v-s:taxRegistrationCause" class="-view edit search"></veda-control>
  </div>
    <div class="col-md-4">
      <em about="v-s:linkedOrganization" property="rdfs:label"></em>
      <div rel="v-s:linkedOrganization" class="view -edit search" data-template="v-ui:LabelLinkTemplate"></div>
      <veda-control data-type="link" rel="v-s:linkedOrganization" class="-view edit search fulltext" data-template="{@.v-s:shortLabel}, {@.v-s:taxId}"></veda-control>
    </div>
  </div>
  <hr class="view -edit -search">
  <div class="row">
    <div class="col-md-8">
      <em about="rdfs:label" property="rdfs:label"></em>
      <div property="rdfs:label" class="view -edit -search"></div>
      <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>
    </div>
    <div class="col-md-4">
      <em about="v-s:shortLabel" property="rdfs:label"></em>
      <div property="v-s:shortLabel" class="view -edit -search"></div>
      <veda-control data-type="string" property="v-s:shortLabel" class="-view edit search"></veda-control>
    </div>
  </div>

  <hr class="view -edit -search">

  <em about="v-s:legalAddress" property="rdfs:label"></em>
  <div property="v-s:legalAddress" class="view -edit -search"></div>
  <veda-control data-type="string" property="v-s:legalAddress" class="-view edit search"></veda-control>

  <hr class="view -edit -search">

  <div class="checkbox">
    <label>
      <veda-control property="v-s:locked" data-type="boolean"></veda-control>
      <em about="v-s:locked" property="rdfs:label"></em>
    </label>
  </div>
  <em about="v-s:hasContractorLock" property="rdfs:label"></em>
  <table class="table table-condensed table-bordered">
    <thead>
      <tr class="active">
        <th about="v-s:hasLockedReason" property="rdfs:label"></th>
        <th about="v-s:dateFrom" property="rdfs:label"></th>
        <th about="v-s:dateTo" property="rdfs:label"></th>
        <th about="v-s:created" property="rdfs:label"></th>
        <th about="v-s:creator" property="rdfs:label"></th>
      </tr>
    </thead>
    <tbody rel="v-s:hasContractorLock" data-embedded="true">
      <tr>
       <td>
          <div rel="v-s:hasLockedReason" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
          <veda-control data-type="link" rel="v-s:hasLockedReason" class="-view edit search fulltext dropdown"></veda-control>
        </td>
        <td>
          <div property="v-s:dateFrom" class="view -edit search"> </div>
          <veda-control property="v-s:dateFrom" data-type="date" class="-view edit search"></veda-control>
        </td>
        <td>
          <div property="v-s:dateTo" class="view -edit search"> </div>
          <veda-control property="v-s:dateTo" data-type="date" class="-view edit search"></veda-control>
        </td>
        <td>
          <div property="v-s:created" class="view -edit search" data-type="date"> </div>
        </td>
        <td>
          <div rel="v-s:creator" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
        </td>
      </tr>
    </tbody>
  </table>
  <veda-control rel="v-s:hasContractorLock" data-type="link" class="-view edit -search create"></veda-control>
  <br>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:lockedInOrigin" data-type="boolean"></veda-control>
      <em about="v-s:lockedInOrigin" property="rdfs:label"></em>
    </label>
  </div>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:deletedInOrigin" data-type="boolean"></veda-control>
      <em about="v-s:deletedInOrigin" property="rdfs:label"></em>
    </label>
  </div>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:isCreditor" data-type="boolean"></veda-control>
      <em about="v-s:isCreditor" property="rdfs:label"></em>
    </label>
  </div>
  <div class="checkbox">
    <label>
      <veda-control property="v-s:isDebitor" data-type="boolean"></veda-control>
      <em about="v-s:isDebitor" property="rdfs:label"></em>
    </label>
  </div>

  <hr class="view -edit -search">

  <em about="v-s:forOrganization" property="rdfs:label"></em>
  <div rel="v-s:forOrganization" class="view -edit -search">
    <a href="#/@">
      <span about="@" property="v-s:taxId"></span> - <span about="@" property="v-s:shortLabel"></span> - <span about="@" property="v-s:legalAddress"></span>
    </a>
  </div>
  <veda-control data-type="link" rel="v-s:forOrganization" class="-view edit search fulltext"></veda-control>

  <hr>
  <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  <br>
  <!-- BUTTONS -->
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel"></span>
  </div>
</div>
`;