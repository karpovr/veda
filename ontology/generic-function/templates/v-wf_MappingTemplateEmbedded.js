import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('.CodeMirror', template).each(function (idx) {
    $(this).height(40);
  });
};

export const html = `
<div>
  <div class="row">
    <div class="col-md-3">
    <div about="@" rel="v-wf:mapToVariable" data-template="v-wf:VariableTemplateEmbedded" data-embedded="true"></div>
      <veda-control data-type="link" rel="v-wf:mapToVariable" class="view edit search -create"></veda-control>
    </div>
    <div class="col-md-9">
      <veda-control data-type="source" mode="javascript" property="v-wf:mappingExpression" style="width:95%"></veda-control>
    </div>
  </div>
</div>
`;