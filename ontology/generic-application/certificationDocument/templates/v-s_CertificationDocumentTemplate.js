export const html = `
<div class="panel panel-default">
  <div class="panel-body">
    <div class="row">
      <div class="col-md-3">
        <em about="v-s:hasCertificationDocumentType" property="rdfs:label"></em>
        <veda-control rel="v-s:hasCertificationDocumentType" data-type="radio" class="-view edit search"></veda-control>
        <div rel="v-s:hasCertificationDocumentType" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
      </div>
      <div class="col-md-3">
        <em about="v-s:hasDocumentKind" property="rdfs:label" class="view edit -search"></em>
        <veda-control rel="v-s:hasDocumentKind" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
        <div rel="v-s:hasDocumentKind" class="view -edit -search" data-template="v-ui:LabelTemplate"></div>
      </div>
      <div class="col-md-3">
        <em about="v-s:registrationNumber" property="rdfs:label" class="view edit -search"></em>
        <div property="v-s:registrationNumber" class="view -edit -search"></div>
        <veda-control property="v-s:registrationNumber" data-type="text" class="-view edit -search"></veda-control>
      </div>
      <div class="col-md-3">
        <em about="v-s:registrationDate" property="rdfs:label" class="view edit -search"></em>
        <div property="v-s:registrationDate" class="view -edit -search"></div>
        <veda-control property="v-s:registrationDate" data-type="date" class="-view edit -search"></veda-control>
      </div>
    </div>
    <div class="row">
      <div class="col-md-3">
        <em about="v-s:dateFrom" property="rdfs:label" class="view edit -search"></em>
        <div property="v-s:dateFrom" class="view -edit -search"></div>
        <veda-control property="v-s:dateFrom" data-type="date" class="-view edit -search"></veda-control>
      </div>
      <div class="col-md-3">
        <em about="v-s:dateTo" property="rdfs:label" class="view edit -search"></em>
        <div property="v-s:dateTo" class="view -edit -search"></div>
        <veda-control property="v-s:dateTo" data-type="date" class="-view edit -search"></veda-control>
      </div>
      <div class="col-md-6">
        <em about="v-s:attachment" property="rdfs:label"></em>
        <div rel="v-s:attachment" data-template="v-ui:FileTemplateWithComment" data-embedded="true"></div>
        <veda-control data-type="file"  rel="v-s:attachment" class="-view edit -search"></veda-control>
      </div>
    </div>
  </div>
</div>
`;