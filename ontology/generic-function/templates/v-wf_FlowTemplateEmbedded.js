import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('.CodeMirror', template).each(function (idx) {
    $(this).height(40);
  });
};

export const html = `
<div class="panel panel-default">
  <div class="panel-heading">
    <div class="row">
      <div class="col-md-3">
        <span about="v-wf:flowsInto" property="rdfs:label"> :
      </div>
      <div class="col-md-9">
        <strong><span about="@" rel="v-wf:flowsInto" data-template="v-ui:LabelTemplate"></span></strong>
      </div>
    </div>
  </div>
  <div class="panel-body">
    <div class="row">
      <div class="col-md-4">
        <span about="rdfs:label" property="rdfs:label"></span> :
        <veda-control data-type="string" property="rdfs:label"></veda-control>
      </div>
      <div class="col-md-8">
        <span about="v-wf:predicate" property="rdfs:label"></span> :
        <veda-control data-type="source" mode="javascript" property="v-wf:predicate"></veda-control>
      </div>
    </div>
  </div>
</div>
`;
