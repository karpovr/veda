import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $("#start", template).click(function () {
    individual["v-s:hasStatus"] = [new IndividualModel("v-s:StatusStarted")];
    individual.save();
  });
  $("#stop", template).click(function () {
    Backend.set_in_individual(veda.ticket, {
      "@": individual.id,
      "v-s:hasStatus": [{
        type: "Uri",
        data: "v-s:StatusStopped"
      }]
    });
  });
  $("#restart", template).click(function () {
    individual["v-s:hasStatus"] = [new IndividualModel("v-s:StatusRestarted")];
    individual["v-s:output"] = [""];
    individual["v-s:progress"] = [0];
    individual.save();
  });

  statusHandler();
  individual.on("v-s:hasStatus", statusHandler);
  template.one("remove", function () {
    individual.off("v-s:hasStatus", statusHandler);
  });
  individual.on("v-s:hasStatus", statusHandler);

  function statusHandler () {
    var start = $("#start", template),
        stop = $("#stop", template),
        restart = $("#restart", template),
        status = individual.hasValue("v-s:hasStatus") ? individual["v-s:hasStatus"][0].id : undefined;

    switch (status) {
      case "v-s:StatusStarted":
      case "v-s:StatusExecution":
        start.hide();
        stop.show();
        restart.hide();
        break;
      case "v-s:StatusExecuted":
        start.hide();
        stop.hide();
        restart.show();
        break;
      default:
        start.show();
        stop.hide();
        restart.hide();
        break;
    }
  }

  $(".show-operation-modal", template).click(function (e) {
    e.preventDefault();
    BrowserUtil.showSmallModal(individual);
  })
};

export const html = `
<div class="pull-left">
  <h5 class="pull-left margin-sm">
    <a class="show-operation-modal text-muted" href="#" about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></a>
  </h5>
  <div class="pull-left" about="@" data-template="v-s:OperationProgressTemplate"></div>
  <button class="btn btn-xs btn-success pull-left" id="start"><span class="glyphicon glyphicon-play"></span></button>
  <button class="btn btn-xs btn-info pull-left" id="restart"><span class="glyphicon glyphicon-repeat"></span></button>
  <button class="btn btn-xs btn-danger pull-left" id="stop"><span class="glyphicon glyphicon-stop"></span></button>
</div>
`;