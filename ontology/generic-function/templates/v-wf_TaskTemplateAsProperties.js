import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function joinSplitHandler() {
    var $state = $('#' + BrowserUtil.escape4$(individual.id));
    $state.removeClass('split-and').removeClass('split-or').removeClass('split-xor');
    $state.removeClass('join-and').removeClass('join-or').removeClass('join-xor');
    $state.addClass(veda.net.getSplitJoinType('join', individual));
    $state.addClass(veda.net.getSplitJoinType('split', individual));
    veda.net.updateSVGBackground($state);
  }
  function labelHandler(values) {
    var $state = $('#' + BrowserUtil.escape4$(individual.id));
    $('.state-name', $state).html(values);
  }
  individual.on('v-wf:join', joinSplitHandler);
  individual.on('v-wf:split', joinSplitHandler);
  individual.on('rdfs:label', labelHandler);
  template.one('remove', function () {
    individual.off('v-wf:join', joinSplitHandler);
    individual.off('v-wf:split', joinSplitHandler);
    individual.off('rdfs:label', labelHandler);
  });

  $('#taskTemplateProperties > tbody > tr > td > span[about]').each(function () {
    if (!individual.hasValue($(this).attr('about'))) {
      $(this).parent().parent().appendTo($('#taskTemplateProperties'));
    }
  });
};

export const html = `
<div>
  <table id="taskTemplateProperties" class="table table-condensed table-hover properties-editor">
    <thead>
      <tr>
      <td style="width:25%"><span about="v-wf:NetElement" property="rdfs:label"></span></td>
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
    <tr onclick="javascript: $('#VCjoin').show(); $('#viewVCjoin').hide();">
      <td><span about="v-wf:join" property="rdfs:label"></span></td>
      <td>
        <veda-control id="VCjoin" rel="v-wf:join" data-type="select" class="fulltext dropdown properties-editor" style="display:none;"></veda-control>
        <div id="viewVCjoin" about="@" rel="v-wf:join" data-template="v-ui:LabelTemplate"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('#VCsplit').show(); $('#viewVCsplit').hide();">
      <td><span about="v-wf:split" property="rdfs:label"></span></td>
      <td>
        <veda-control id="VCsplit" rel="v-wf:split" data-type="select" class="fulltext dropdown properties-editor" style="display:none;"></veda-control>
        <div id="viewVCsplit" about="@" rel="v-wf:split" data-template="v-ui:LabelTemplate"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCdecisionForm').show(); $('.viewVCdecisionForm').hide();">
      <td><span about="v-wf:taskDecisionForm" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:taskDecisionForm" data-type="link" class="VCdecisionForm fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCdecisionForm" rel="v-wf:taskDecisionForm" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div about="@" class="viewVCdecisionForm" about="@" rel="v-wf:taskDecisionForm" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCstartDecisionTransform').show(); $('.viewVCstartDecisionTransform').hide();">
      <td><span about="v-wf:startDecisionTransform" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:startDecisionTransform" data-type="link" class="VCstartDecisionTransform fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCstartDecisionTransform" rel="v-wf:startDecisionTransform" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div class="viewVCstartDecisionTransform" about="@" rel="v-wf:startDecisionTransform" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCcompleteDecisionTransform').show(); $('.viewVCcompleteDecisionTransform').hide();">
      <td><span about="v-wf:completeDecisionTransform" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:completeDecisionTransform" data-type="link" class="VCcompleteDecisionTransform fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCcompleteDecisionTransform" rel="v-wf:completeDecisionTransform" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div class="viewVCcompleteDecisionTransform" about="@" rel="v-wf:completeDecisionTransform" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCexecutor').show(); $('.viewVCexecutor').hide();">
      <td><span about="v-wf:executor" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:executor" data-type="link" class="VCexecutor fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCexecutor" rel="v-wf:executor" style="display:none;">
          <div>
            #<a href="#/@///edit">
              <span property="v-wf:executorExpression"></span>
              <span property="v-s:script"></span>
              <span rel="v-s:employee" data-template="v-ui:LabelTemplate"></span>
            </a>
          </div>
        </div>
        <div class="viewVCexecutor" about="@" rel="v-wf:executor">
          <div>
            #<a href="#/@///edit">
              <span property="v-wf:executorExpression"></span>
              <span property="v-s:script"></span>
              <span rel="v-s:employee" data-template="v-ui:LabelTemplate"></span>
            </a>
          </div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCexpectedResultType').show(); $('.viewVCexpectedResultType').hide();">
      <td><span about="v-wf:expectedResultType" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:expectedResultType" data-type="link" class="VCexpectedResultType fulltext dropdown properties-editor" style="display:none;"></veda-control>
        <div class="VCexpectedResultType" rel="v-wf:expectedResultType" data-template="v-ui:LabelTemplate" style="display:none;"></div>
        <div class="viewVCexpectedResultType" about="@" rel="v-wf:expectedResultType" data-template="v-ui:LabelTemplate"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCinputVariable').show(); $('.viewVCinputVariable').hide();">
      <td><span about="v-wf:inputVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:inputVariable" data-type="link" class="VCinputVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCinputVariable" rel="v-wf:inputVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div about="@" class="viewVCinputVariable" rel="v-wf:inputVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCoutputVariable').show(); $('.viewVCoutputVariable').hide();">
      <td><span about="v-wf:outputVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:outputVariable" data-type="link" class="VCoutputVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCoutputVariable" rel="v-wf:outputVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div about="@" class="viewVCoutputVariable" rel="v-wf:outputVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VCinputOutputVariable').show(); $('.viewVCinputOutputVariable').hide();">
      <td><span about="v-wf:inputOutputVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:inputOutputVariable" data-type="link" class="VCinputOutputVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VCinputOutputVariable" rel="v-wf:inputOutputVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div about="@" class="viewVCinputOutputVariable" rel="v-wf:inputOutputVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.VClocalVariable').show(); javascript: $('.viewVClocalVariable').hide();">
      <td><span about="v-wf:localVariable" property="rdfs:label"></span></td>
      <td>
        <veda-control about="@" rel="v-wf:localVariable" data-type="link" class="VClocalVariable fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div class="VClocalVariable" rel="v-wf:localVariable" data-template="v-ui:LabelTemplateWithEditLink" style="display:none;"></div>
        <div about="@" class="viewVClocalVariable" rel="v-wf:localVariable" data-template="v-ui:LabelTemplateWithEditLink"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('#VCsubNet').show(); $('#viewVCsubNet').hide();">
      <td><span about="v-wf:subNet" property="rdfs:label"></span></td>
      <td>
        <veda-control id="VCsubNet" rel="v-wf:subNet" data-type="link" class="fulltext dropdown properties-editor" style="display:none;"></veda-control>
        <div class="VCsubNet" rel="v-wf:subNet" data-template="v-ui:LabelTemplate" style="display:none;"></div>
        <div class="viewVCsubNet" about="@" rel="v-wf:subNet" data-template="v-ui:LabelTemplate"></div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCstartingMapping').show()).show();">
      <td>
        <span about="v-wf:startingMapping" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:startingMapping" data-type="link" class="VCstartingMapping fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:startingMapping">
          <div class="VCstartingMapping">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
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
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCstartingExecutorJournalMap').show()).show();">
      <td>
        <span about="v-wf:startingExecutorJournalMap" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:startingExecutorJournalMap" data-type="link" class="VCstartingExecutorJournalMap fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:startingExecutorJournalMap">
          <div class="VCstartingExecutorJournalMap">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCcompletedExecutorJournalMap').show()).show();">
      <td>
        <span about="v-wf:completedExecutorJournalMap" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:completedExecutorJournalMap" data-type="link" class="VCcompletedExecutorJournalMap fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:completedExecutorJournalMap">
          <div class="VCcompletedExecutorJournalMap">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCstartingJournalMap').show()).show();">
      <td>
        <span about="v-wf:startingJournalMap" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:startingJournalMap" data-type="link" class="VCstartingJournalMap fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:startingJournalMap">
          <div class="VCstartingJournalMap">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCcompletedJournalMap').show()).show();">
      <td>
        <span about="v-wf:completedJournalMap" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:completedJournalMap" data-type="link" class="VCcompletedJournalMap fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:completedJournalMap">
          <div class="VCcompletedJournalMap">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCstartingMessageMap').show()).show();">
      <td>
        <span about="v-wf:startingMessageMap" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:startingMessageMap" data-type="link" class="VCstartingMessageMap fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:startingMessageMap">
          <div class="VCstartingMessageMap">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCcompletedMessageMap').show()).show();">
      <td>
        <span about="v-wf:completedMessageMap" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:completedMessageMap" data-type="link" class="VCcompletedMessageMap fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:completedMessageMap">
          <div class="VCcompletedMap">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr onclick="javascript: $('.button-delete', $('.VCwosResultsMapping').show()).show();">
      <td>
        <span about="v-wf:wosResultsMapping" property="rdfs:label"></span>
      </td>
      <td>
        <veda-control rel="v-wf:wosResultsMapping" data-type="link" class="VCwosResultsMapping fulltext dropdown create properties-editor" style="display:none;"></veda-control>
        <div about="@" rel="v-wf:wosResultsMapping">
          <div class="VCwosResultsMapping">
            <p>
              #<a href="#/@">
                <span about="@" rel="v-wf:mapToVariable">
                  <span>
                    <span about="@" property="v-wf:varDefineName"></span>
                  </span>
                </span> =
                <span about="@" property="v-wf:mappingExpression"></span>
              </a>
            </p>
          <div>
        </div>
      </td>
    </tr>
    <tr>
      <td about="v-wf:hasFlow" property="rdfs:label"></td>
      <td about="@" rel="v-wf:hasFlow">
        <div>
          <p>
            #<a href="#/@">
              <strong><span about="@" rel="v-wf:flowsInto" data-template="v-ui:LabelTemplate"></span></strong>
              [<span about="@" property="v-wf:predicate"></span>]
            </a>
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td about="v-wf:locationX" property="rdfs:label"></td>
      <td about="@" property="v-wf:locationX"></td>
    </tr>
    <tr>
      <td about="v-wf:locationY" property="rdfs:label"></td>
      <td about="@" property="v-wf:locationY"></td>
    </tr>
  </table>
</div>
`;
