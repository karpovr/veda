export const html = `
  <div class="journal-record">
    <hr class="margin-sm" />
    <div class="row">
      <div class="col-md-2 col-sm-3 event-type">
        <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
      </div>
      <div class="col-md-8 col-sm-6 event-desc">
        <strong about="@" property="rdfs:label"></strong>
        <div>
          <i about="@" property="rdfs:comment"></i>
        </div>
        <span about="@" rel="v-wf:executor" data-template="v-ui:LabelTemplate"></span>
      </div>
      <div class="col-md-2 col-sm-3 event-date text-right">
        <span about="@" property="v-s:created"></span>
      </div>
    </div>
  </div>
`;
