export const html = `
  <div class="panel panel-default">
    <div class="panel-heading">
      <h3 class="panel-title" about="@" rel="v-s:hasRoleInContract" class="view -edit -search" data-template="v-ui:LabelTemplate"></h3>
      <veda-control data-type="link" rel="v-s:hasRoleInContract" class="-view edit search dropdown fulltext"></veda-control>
    </div>
    <div class="panel-body">
      <em about="v-s:hasContractor" property="rdfs:label"></em>
      <div rel="v-s:hasContractor" class="view edit search">
        <a href="#/@">
          <span about="@" property="rdfs:label"></span>,
          <span about="@" property="v-s:registrationNumber"></span>
        </a>
      </div>
      <veda-control
        data-type="link"
        rel="v-s:hasContractor"
        class="-view edit search fulltext"
        data-template="{@.rdfs:label}, {@.v-s:registrationNumber}"></veda-control>
      <em about="stg:OrganizationBundleContract" property="rdfs:label"></em>
      <div rel="v-s:hasOrganization" class="view edit search">
        <a href="#/@">
          <span about="@" property="rdfs:label"></span>,
          <span about="@" property="v-s:taxId"></span>
        </a>
      </div>
      <veda-control
        data-type="link"
        rel="v-s:hasOrganization"
        class="-view edit search fulltext"
        data-template="{@.v-s:shortLabel}, {@.v-s:taxId}"></veda-control>
      <em about="rdfs:comment" property="rdfs:label"></em>
      <div property="rdfs:comment" class="view -edit -search"></div>
      <veda-control property="rdfs:comment" data-type="string" class="-view edit search"></veda-control>
    </div>
  </div>
`;
