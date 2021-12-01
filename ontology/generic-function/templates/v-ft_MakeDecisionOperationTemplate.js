import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import Notify from '/js/browser/notify.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function intersect (arr1, arr2) {
    arr1.sort(sorter);
    arr2.sort(sorter);
    var i = 0, j = 0, res = [], el1, el2;
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
  var possible = this["v-s:data"].map(function (task) {
    return task["v-wf:possibleDecisionClass"];
  });
  var common = possible.reduce(function (common, possible) {
    return common ? intersect(common, possible) : possible;
  });
  common.push( new IndividualModel("v-wf:DecisionRedirect") );
  this["v-ft:groupDecisionClass"] = common;
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $(".possible-decisions input", template).on("change", function (e) {
    var input = $(this);
    var decisionContainer = $(".new-decision", template);
    var decisionClassId = input.closest("[resource]").attr("resource");
    var decisionClass = new IndividualModel( decisionClassId );
    decision["rdf:type"] = [ decisionClass ];
    decision.properties["rdfs:label"] = decisionClass.properties["rdfs:label"];
    var prevComment = $("veda-control[property='rdfs:comment'] textarea", decisionContainer).val();
    if (prevComment) {
      decision["rdfs:comment"] = [prevComment];
    }
    decisionContainer.empty();
    decision.present(decisionContainer, undefined, "edit").then( function (decisionTemplate) {
      decisionTemplate.find(".action#send")
        .off("click")
        .click(function () {
          Promise.all(individual["v-s:data"].map(function (task) {
            return decision.clone().then(function (task_decision) {
              task_decision["v-s:backwardTarget"] = [ task ];
              task_decision["v-s:backwardProperty"] = [ new IndividualModel("v-wf:takenDecision") ];
              task_decision["v-s:canRead"] = [ true ];
              return task_decision.save();
            });
          })).then(function () {
            var successMsg = new IndividualModel("v-s:SuccessBundle").load();
            return successMsg.then(function (successMsg) {
              var notify = Notify ? new Notify() : function () {};
              notify("success", {name: successMsg});
            });
          }).catch(function (error) {
            console.log(error);
            var errorMsg = new IndividualModel("v-s:ErrorBundle").load();
            return errorMsg.then(function (errorMsg) {
              var notify = Notify ? new Notify() : function () {};
              notify("danger", {name: errorMsg});
            });
          }).then(function () {
            decisionTemplate.closest(".modal").modal("hide");
            var inbox = new IndividualModel("v-ft:Inbox");
            inbox.clearValue("v-fs:selected");
          });
        });
    });
  });
  var decision = new IndividualModel();
  $(".possible-decisions input", template).first().prop("checked", "checked").change();
};

export const html = `
<div class="container sheet">
  <h4 about="v-ft:groupDecisionClass" property="rdfs:label"></h4>
  <div class="possible-decisions" about="@" rel="v-ft:groupDecisionClass">
    <div class="radio">
      <label>
        <input type="radio" name="decisionRadios">
        <span property="rdfs:label"></span>
      </label>
    </div>
  </div>
  <div class="well new-decision"></div>
</div>
`;