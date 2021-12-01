import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (typeof individual !== "undefined") {
    $('#workItemTemplateProperties > tbody > tr > td > span[about]').each(function () {
      if (!individual.hasValue($(this).attr('about'))) {
        $(this).parent().parent().appendTo($('#workItemTemplateProperties'));
      }
    });
  }
};

export const html = `
<div>
  <table id="workItemTemplateProperties" class="table table-condensed table-hover properties-editor">
    <thead>
      <tr>
      <td style="width:25%"><span about="v-wf:NetElement" property="rdfs:label"></span></td>
      <td><strong><span about="@" property="@"></span> <a href="#/@"><i class='glyphicon glyphicon-share-alt'></i></a></strong></td>
      </tr>
    </thead>
    <tr onclick="javascript: $('.VCinVariable').show(); javascript: $('.viewVCinVariable').hide();">
      <td><span about="v-wf:inVars" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:inVars" data-type="link" class="VCinVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCinVariable" rel="v-wf:inVars" data-template="v-wf:VariableTemplate" style="display:none;"></div>
        <div about="@" class="viewVCinVariable" rel="v-wf:inVars" data-template="v-wf:VariableTemplate"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCoutVariable').show(); javascript: $('.viewVCoutVariable').hide();">
      <td><span about="v-wf:outVars" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:outVars" data-type="link" class="VCoutVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCoutVariable" rel="v-wf:outVars" data-template="v-wf:VariableTemplate" style="display:none;"></div>
        <div about="@" class="viewVCoutVariable" rel="v-wf:outVars" data-template="v-wf:VariableTemplate"></div>
      </td>
    </tr>
    <tr id="workOrderList">
      <td><em><h5 about="v-wf:workOrderList" property="rdfs:label"></h5></em></td>
      <td><span rel="v-wf:workOrderList" data-template="v-wf:WorkOrderTemplate"></span></td>
    </tr>
    <tr id="traceJournal">
      <td><em><h5 about="v-wf:traceJournal" property="rdfs:label"></h5></em></td>
      <td><span rel="v-wf:traceJournal" data-template="v-ui:LabelLinkTemplate"></span></td>
    </tr>
  </table>
</div>
`;