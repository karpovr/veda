import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $("#cancel, #save", template).click(function () {
    var modal = template.closest(".modal");
    if (modal.length) {
      modal.modal("hide");
    } else {
      window.history.back();
    }
  });
};

export const html = `
<div>
  <strong><span about="@" property="@"></span></strong>
<!-- LABEL & POSITION -->
  <hr class="margin-sm">
  <div class="row">
    <div class="col-md-8">
      <h4 about="rdfs:label" property="rdfs:label"></h4>
      <veda-control data-type="string" property="rdfs:label"></veda-control>
    </div>
    <div class="col-md-2">
      <strong><span about="v-wf:locationX" property="rdfs:label"></span></strong> :
      <veda-control property="v-wf:locationX" data-type="integer"></veda-control>
    </div>
    <div class="col-md-2">
      <strong><span about="v-wf:locationY" property="rdfs:label"></span></strong> :
      <veda-control property="v-wf:locationY" data-type="integer"></veda-control>
    </div>
  </div>
<!-- SUBNET -->
  <hr class="margin-sm">
  <div class="row">
    <div class="col-md-3">
      <h4 about="v-wf:subNet" property="rdfs:label"></h4>
    </div>
    <div class="col-md-9">
      <veda-control data-type="link" rel="v-wf:subNet" class="fulltext dropdown"></veda-control>
    </div>
  </div>
<!-- FLOWS & SPLIT/JOIN -->
  <hr class="margin-sm">
  <div class="row">
    <div class="col-md-10">
      <h4 about="v-wf:hasFlow" property="rdfs:label"></h4>
      <div rel="v-wf:hasFlow" data-template="v-wf:FlowTemplateEmbedded" data-embedded="true"></div>
      <veda-control data-type="link" rel="v-wf:hasFlow" class="-view edit search -create"></veda-control>
    </div>
    <div class="col-md-2">
      <div>
        <h4 about="v-wf:join" property="rdfs:label"></h4>
        <veda-control rel="v-wf:join" data-type="select" class="fulltext dropdown"></veda-control>
      </div>
      <div>
        <h4 about="v-wf:split" property="rdfs:label"></h4>
          <veda-control rel="v-wf:split" data-type="select" class="fulltext dropdown"></veda-control>
      </div>
    </div>
  </div>
<!-- EXECUTOR -->
  <hr class="margin-sm">
  <h4 about="v-wf:executor" property="rdfs:label"></h4>
  <div about="@" rel="v-wf:executor" data-template="v-wf:ExecutorTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:executor" class="-view edit search create"></veda-control>
<!-- DECISIONS MAPPING -->
  <hr class="margin-sm">
  <h4 about="v-wf:startDecisionTransform" property="rdfs:label"></h4>
  <div rel="v-wf:startDecisionTransform" data-template="v-wf:TransformTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:startDecisionTransform" class="-view edit search create"></veda-control>

  <h4 about="v-wf:completeDecisionTransform" property="rdfs:label"></h4>
  <div rel="v-wf:completeDecisionTransform" data-template="v-wf:TransformTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:completeDecisionTransform" class="-view edit search create"></veda-control>
<!-- VARIABLES MAPPING -->
  <hr class="margin-sm">
  <h4 about="v-wf:startingMapping" property="rdfs:label"></h4>
  <div rel="v-wf:startingMapping" data-template="v-wf:MappingTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:startingMapping" class="-view edit search create"></veda-control>

  <h4 about="v-wf:completedMapping" property="rdfs:label"></h4>
  <div rel="v-wf:completedMapping" data-template="v-wf:MappingTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:completedMapping" class="-view edit search create"></veda-control>
<!-- EXECUTOR JOURNAL MAPPING -->
  <hr class="margin-sm">
  <h4 about="v-wf:startingExecutorJournalMap" property="rdfs:label"></h4>
  <div rel="v-wf:startingExecutorJournalMap" data-template="v-wf:MappingTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:startingExecutorJournalMap" class="-view edit search create"></veda-control>

  <h4 about="v-wf:completedExecutorJournalMap" property="rdfs:label"></h4>
  <div rel="v-wf:completedExecutorJournalMap" data-template="v-wf:MappingTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:completedExecutorJournalMap" class="-view edit search create"></veda-control>
<!-- JOURNAL MAPPING -->
  <hr class="margin-sm">
  <h4 about="v-wf:startingJournalMap" property="rdfs:label"></h4>
  <div rel="v-wf:startingJournalMap" data-template="v-wf:MappingTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:startingJournalMap" class="-view edit search create"></veda-control>

  <h4 about="v-wf:completedJournalMap" property="rdfs:label"></h4>
  <div rel="v-wf:completedJournalMap" data-template="v-wf:MappingTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:completedJournalMap" class="-view edit search create"></veda-control>
<!-- EXPECTED RESULT TYPE & MAPPING -->
  <hr class="margin-sm">
  <h4 about="v-wf:expectedResultType" property="rdfs:label"></h4>
  <veda-control about="@" rel="v-wf:expectedResultType" data-type="link" class="fulltext dropdown"></veda-control>
<!--
  <veda-control rel="v-wf:expectedResultType" data-type="select" class="fulltext dropdown"></veda-control>
  <div about="@" rel="v-wf:expectedResultType" data-template="v-ui:LabelTemplate" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:expectedResultType" class="-view edit search create"></veda-control>
-->

  <h4 about="v-wf:wosResultsMapping" property="rdfs:label"></h4>
  <div about="@" rel="v-wf:wosResultsMapping" data-template="v-wf:TransformTemplateEmbedded" data-embedded="true"></div>
  <veda-control data-type="link" rel="v-wf:wosResultsMapping" class="-view edit search create"></veda-control>
<!-- COMMENT -->
  <hr class="margin-sm">
  <h4 about="rdfs:comment" property="rdfs:label"></h4>
  <veda-control data-type="string" property="rdfs:comment"></veda-control>
<!-- BUTTONS -->
  <hr class="margin-sm">
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save cancel"></span>
  </div>
</div>
`;