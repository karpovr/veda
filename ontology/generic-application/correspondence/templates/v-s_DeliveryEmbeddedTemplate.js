export const html = `
  <div class="panel panel-default">
    <div class="panel-heading">
      <h3 class="panel-title">
        <span about="@" data-template="v-ui:IconModalTemplate"></span>
        <span about="v-s:Delivery" property="rdfs:label"></span>
      </h3>
    </div>
    <div class="panel-body">
      <div class="row">
        <div class="col-md-3">
          <em about="v-s:date" property="rdfs:label"></em>
          <div property="v-s:date" class="view -edit search"></div>
          <veda-control property="v-s:date" data-type="date" class="-view edit search"></veda-control>
        </div>
        <div class="col-md-3">
          <em about="v-s:deliverBy" property="rdfs:label"></em>
          <div rel="v-s:deliverBy" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
          <veda-control data-type="link" rel="v-s:deliverBy" class="-view edit search fulltext dropdown"></veda-control>
        </div>
        <div class="col-md-6">
          <em about="rdfs:comment" property="rdfs:label"></em>
          <div property="rdfs:comment" class="view -edit -search"></div>
          <veda-control property="rdfs:comment" data-type="text" class="-view edit search"></veda-control>
        </div>
      </div>
    </div>
  </div>
`;
