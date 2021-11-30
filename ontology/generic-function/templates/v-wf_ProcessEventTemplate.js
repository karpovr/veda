import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue("v-wf:initiator")) { $("#initiator", template).remove(); }
};

export const html = `
<div class="journal-record">
  <hr class="margin-sm">
  <div class="row">
    <div class="col-md-2 col-sm-3 event-type">
      <strong rel="rdf:type" data-template="v-ui:LabelTemplate"></strong>
    </div>
    <div class="col-md-8 col-sm-6 event-desc">
      <div property="rdfs:label"></div>
        <span id="initiator">
          <span about="v-wf:initiator" property="rdfs:label"></span>:
        <em rel="v-wf:initiator" data-template="v-ui:LabelTemplate"></em>
      </span>
    </div>
    <div class="col-md-2 col-sm-3 event-date text-right">
      <span about="@" property="v-s:created"></span>
    </div>
  </div>
</div>
`;