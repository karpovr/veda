import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#taskTemplateProperties [rel="v-wf:inputVariable"] [typeof="v-wf:VarDefine"]').draggable({
    revert:true
  });
};

export const html = `
<div>
  <table id="taskTemplateProperties" class="table table-condensed table-hover properties-editor">
    <thead>
      <tr>
      <td style="width:25%"><span about="v-wf:Net" property="rdfs:label"></span></td>
      <td><strong><span about="@" property="@"></span> <a href="#/@"><i class='glyphicon glyphicon-share-alt'></i></a></strong></td>
      </tr>
    </thead>
    <tr onclick="javascript: $('#VClabel').show(); $('#viewVClabel').hide();">
      <td><span about="rdfs:label" property="rdfs:label"></span></td>
      <td>
        <veda-control id="VClabel" data-type="string" property="rdfs:label" class="properties-editor" style="display:none;"></veda-control>
        <div id="viewVClabel" about="@" property="rdfs:label"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('#VCcomment').show(); $('#viewVCcomment').hide();">
      <td><span about="rdfs:comment" property="rdfs:label"></span></td>
      <td>
        <veda-control id="VCcomment" data-type="string" property="rdfs:comment" class="properties-editor" style="display:none;"></veda-control>
        <div id="viewVCcomment" about="@" property="rdfs:comment"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCinputVariable').show(); $('.viewVCinputVariable').hide();">
      <td><span about="v-wf:inputVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:inputVariable" data-type="link" class="VCinputVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCinputVariable" rel="v-wf:inputVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div class="viewVCinputVariable" about="@" rel="v-wf:inputVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCoutputVariable').show(); $('.viewVCoutputVariable').hide();">
      <td><span about="v-wf:outputVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:outputVariable" data-type="link" class="VCoutputVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCoutputVariable" rel="v-wf:outputVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div class="viewVCoutputVariable" about="@" rel="v-wf:outputVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VClocalVariable').show(); $('.viewVClocalVariable').hide();">
      <td><span about="v-wf:localVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:localVariable" data-type="link" class="VClocalVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VClocalVariable" rel="v-wf:localVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div class="viewVClocalVariable" about="@" rel="v-wf:localVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCinputOutputVariable').show(); $('.viewVCinputOutputVariable').hide();">
      <td><span about="v-wf:inputOutputVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:inputOutputVariable" data-type="link" class="VCinputOutputVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCinputOutputVariable" rel="v-wf:inputOutputVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div class="viewVCinputOutputVariable" about="@" rel="v-wf:inputOutputVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCcompletedMapping').show()).show();">
      <td>
        <span about="v-wf:completedMapping" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:completedMapping" data-type="link" class="VCcompletedMapping fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:completedMapping">
          <div class="VCcompletedMapping">
            #<a href="#/@">
              <span about="@" rel="v-wf:mapToVariable">
                <span>
                  <span about="@" property="v-wf:varDefineName"></span>
                </span>
              </span> =
              <span about="@" property="v-wf:mappingExpression"></span>
              [<span about="@" property="@"></span>]
            </a>
          <div>
        </div>
      </td>
    </tr>
  </table>
</div>
`;