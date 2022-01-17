import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import Notify from '/js/browser/notify.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function intersect (arr1, arr2) {
    arr1.sort(sorter);
    arr2.sort(sorter);
    let i = 0;
    let j = 0;
    const res = [];
    let el1;
    let el2;
    while ((el1 = arr1[i]) && (el2 = arr2[j])) {
      if (el2 < el1) {
        j++;
      } else if (el2 > el1) {
        i++;
      } else {
        res.push(el1);
        i++;
        j++;
      }
    }
    return res;

    function sorter (a, b) {
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }
  }
  const possible = this['v-s:data'].map(function (task) {
    return task['v-wf:possibleDecisionClass'];
  });
  const common = possible.reduce(function (common, possible) {
    return common ? intersect(common, possible) : possible;
  });
  common.push(new IndividualModel('v-wf:DecisionRedirect'));
  this['v-ft:groupDecisionClass'] = common;
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const decision = new IndividualModel();
  $('.possible-decisions input', template).on('change', function (e) {
    const input = $(this);
    const decisionContainer = $('.new-decision', template);
    const decisionClassId = input.closest('[resource]').attr('resource');
    const decisionClass = new IndividualModel(decisionClassId);
    decision['rdf:type'] = [decisionClass];
    decision.properties['rdfs:label'] = decisionClass.properties['rdfs:label'];
    const prevComment = $("veda-control[property='rdfs:comment'] textarea", decisionContainer).val();
    if (prevComment) {
      decision['rdfs:comment'] = [prevComment];
    }
    decisionContainer.empty();
    decision.present(decisionContainer, undefined, 'edit').then(function (decisionTemplate) {
      decisionTemplate
        .find('.action#send')
        .off('click')
        .click(function () {
          Promise.all(
            individual['v-s:data'].map(function (task) {
              return decision.clone().then(function (task_decision) {
                task_decision['v-s:backwardTarget'] = [task];
                task_decision['v-s:backwardProperty'] = [new IndividualModel('v-wf:takenDecision')];
                task_decision['v-s:canRead'] = [true];
                return task_decision.save();
              });
            }),
          )
            .then(function () {
              const successMsg = new IndividualModel('v-s:SuccessBundle').load();
              return successMsg.then(function (successMsg) {
                const notify = Notify ? new Notify() : function () {};
                notify('success', {name: successMsg});
              });
            })
            .catch(function (error) {
              console.log(error);
              const errorMsg = new IndividualModel('v-s:ErrorBundle').load();
              return errorMsg.then(function (errorMsg) {
                const notify = Notify ? new Notify() : function () {};
                notify('danger', {name: errorMsg});
              });
            })
            .then(function () {
              decisionTemplate.closest('.modal').modal('hide');
              const inbox = new IndividualModel('v-ft:Inbox');
              inbox.clearValue('v-fs:selected');
            });
        });
    });
  });
  $('.possible-decisions input', template).first().prop('checked', 'checked').change();
};

export const html = `
  <div class="container sheet">
    <h4 about="v-ft:groupDecisionClass" property="rdfs:label"></h4>
    <div class="possible-decisions" about="@" rel="v-ft:groupDecisionClass">
      <div class="radio">
        <label>
          <input type="radio" name="decisionRadios" />
          <span property="rdfs:label"></span>
        </label>
      </div>
    </div>
    <div class="well new-decision"></div>
  </div>
`;
