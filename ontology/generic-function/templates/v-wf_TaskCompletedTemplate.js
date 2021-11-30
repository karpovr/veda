export const html = `
<div class="journal-record">
  <hr class="margin-sm">
  <div class="row">
    <div class="col-md-2 col-sm-3 event-type">
      <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
    </div>
    <div class="col-md-8 col-sm-6 event-desc">
      <div id="decision" about="@" rel="v-wf:takenDecision">
        <div>
          <strong about="@" property="rdfs:label"></strong>
          <span about="@" rel="v-wf:to">
            <span>
              <span>&rarr;</span>
              <span about="@" data-template="v-ui:LabelTemplate"></span>
            </span>
          </span>
          <div>
            <i about="@" property="rdfs:comment"></i>
          </div>
          <div about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></div>
        </div>
      </div>
    </div>
    <div class="col-md-2 col-sm-3 event-date text-right">
      <span about="@" property="v-s:created"></span>
    </div>
  </div>
</div>
`;