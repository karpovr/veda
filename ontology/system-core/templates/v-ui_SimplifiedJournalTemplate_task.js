import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('v-wf:isCompleted', true)) {
    template.children().first().addClass('success');
    $('.docflow-buttons', template).remove();
  } else if (individual.hasValue('v-wf:isEditable', false)) {
    $('.docflow-buttons', template).remove();
  } else {
    veda.user.isMemberOf('cfg:SuperUser').then(function (isMemberSuperUser) {
      const currentEmployee = veda.appointment['v-s:employee'][0];
      const currentOcuppation = veda.appointment['v-s:occupation'][0];
      const targetEmployee = individual['v-wf:from'][0];
      const targetOccupation = individual['v-wf:from'][1];
      const canRevoke = currentEmployee === targetEmployee || currentOcuppation === targetOccupation;
      const isDirectTask = individual.hasValue('v-wf:isDirectTask', true);
      if (isDirectTask) {
        if (canRevoke || isMemberSuperUser) {
          $('.docflow-buttons', template).show();
          $('.redirect', template).click(takeDecision.bind(null, 'v-wf:DecisionRedirect', 'Перенаправлено'));
          $('.revoke', template).click(takeDecision.bind(null, 'v-wf:DecisionRevokeTask', 'Задача отозвана'));
        } else {
          $('.docflow-buttons', template).remove();
        }
      } else {
        $('.docflow-buttons', template).remove();
      }
    });
  }

  // TODO: refactor this
  if (!individual.hasValue('v-wf:redirect_from_task') || individual.hasValue('v-wf:redirect_from_task', 's-wf:EmptyTask')) {
    $('.is-redirected', template).remove();
  }

  function takeDecision (takenDecision, label) {
    const decisionClass = new IndividualModel(takenDecision);
    const decision = new IndividualModel();
    decision['rdf:type'] = [decisionClass];
    decision['v-s:backwardTarget'] = [individual];
    decision['rdfs:label'] = [label];
    decision['v-s:backwardProperty'] = [new IndividualModel('v-wf:takenDecision')];
    decision['v-s:canRead'] = [true];
    const modal = BrowserUtil.showModal(decision, undefined, 'edit');

    decision.one('afterReset', function () {
      modal.modal('hide').remove();
    });
    decision.one('afterSave', function () {
      modal.modal('hide').remove();
      $('.docflow-buttons', template).hide();
    });
  }
};

export const html = `
  <tr>
    <td class="sequence-number"></td>
    <td>
      <div about="@" rel="v-wf:from" data-template="v-ui:LabelTemplate"></div>
      <div about="@" rel="v-wf:redirect_from_task" class="is-redirected">
        <div>
          <strong><small about="v-s:TaskIsRedirectedFrom" property="rdfs:label"></small></strong>
          <small about="@" rel="v-wf:to" data-template="v-ui:LabelTemplate"></small>
        </div>
      </div>
    </td>
    <td about="@" rel="v-wf:to" data-template="v-ui:LabelTemplate"></td>
    <td>
      <a href="#/@" about="@" property="rdfs:label"></a>
      <div about="@" property="v-s:description" style="white-space: pre-line;"></div>
    </td>
    <td about="@" property="v-s:created"></td>
    <td>
      <div about="@" rel="v-wf:takenDecision">
        <div>
          <strong about="@" property="rdfs:label"></strong>
          <span about="@" rel="v-wf:to">
            <span>
              <span>&rarr;</span>
              <span about="@" data-template="v-ui:LabelTemplate"></span>
            </span>
          </span>
          <div><i about="@" property="rdfs:comment"></i></div>
          <hr class="margin-sm" />
          <small about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></small> &middot; <small aboout="@" property="v-s:created"></small>
        </div>
      </div>
      <div class="docflow-buttons" style="display:none">
        <button class="btn btn-sm btn-warning redirect" about="v-wf:DecisionRedirect_Bundle" property="rdfs:label"></button>
        <button class="btn btn-sm btn-info revoke" about="v-wf:DecisionRevoke_Bundle" property="rdfs:label"></button>
      </div>
    </td>
  </tr>
`;
