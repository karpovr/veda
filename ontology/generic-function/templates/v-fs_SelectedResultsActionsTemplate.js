import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var self = this;
  self.on("v-fs:selected", populateOps);
  template.one("remove", function () {
    self.off("v-fs:selected", populateOps);
  });
  var populated;
  if ( self.hasValue("v-fs:selected") ) {
    populateOps();
  }
  $(".dropdown-menu", template).on("click", "[resource]", createOp);
  $(".single-operation", template).on("click", createOp);

  function populateOps() {
    template.toggleClass("hidden", !self.hasValue("v-fs:selected"));
    if ( populated ) { return; }
    populated = true;
    var multi = $(".multi-operation", template);
    var list = $(".dropdown-menu", template);
    var listTemplate = "<li><a about='@' href='#' property='rdfs:label'></a></li>";
    var single = $(".single-operation", template);
    var singleTemplate = "<span about='@' href='#' property='rdfs:label'></span>";
    var applicableOps = self["v-fs:applicableOperation"];
    return Backend.query({
      ticket: veda.ticket,
      query: "'rdf:type' === 'owl:Class' && 'rdfs:subClassOf' === 'v-s:GenericOperation'"
    })
    .then(function (response) {
      response.result.forEach(function (operation_uri) {
        applicableOps.push(new IndividualModel(operation_uri));
      });
      return Promise.all(applicableOps.map(function (op) {
        return op.canCreate();
      }));
    })
    .then(function (canCreate) {
      applicableOps = applicableOps.filter(function (_, i) {
        return canCreate[i];
      });
      if ( applicableOps.length === 0 ) {
        template.remove();
        return;
      } else if ( applicableOps.length === 1 ) {
        multi.remove();
        applicableOps[0].present(single, singleTemplate);
      } else if ( applicableOps.length > 1 ) {
        single.remove();
        applicableOps.forEach(function (op) {
          op.present(list, listTemplate);
        });
      }
      $(".hidden", template).removeClass("hidden");
    });
  }

  function createOp (e) {
    e.preventDefault();
    var $this = $(this);
    if ( $this.hasClass("disabled") ) { return; }
    var operationClassUri = $this.attr("resource") || $this.children().first().attr("resource"),
        operationClass = new IndividualModel(operationClassUri),
        operation = new IndividualModel(),
        operationContainer = $(".operation-container", template).empty();
    operation["rdf:type"] = [ operationClass ];
    //operation["v-s:dataQuery"] = self["v-fs:query"];
    operation["v-s:data"] = self["v-fs:selected"].slice();
    var modal = BrowserUtil.showSmallModal(operation);
    modal.on("click", ".action#start", function () {
      self["v-fs:operation"] = [ operation ];
      modal.on("hidden.bs.modal", function () {
        modal.modal("hide").remove();
      });
    });
  }
};

export const html = `
<div class="hidden" style="margin-top:-3px;">
  <button type="button" class="pull-left btn btn-xs btn-primary single-operation hidden"></button>
  <div class="pull-left btn-group multi-operation hidden">
    <button type="button" class="btn btn-xs btn-primary dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
      <span about="v-fs:PerformOperation" property="rdfs:label"></span> <span class="caret"></span>
    </button>
    <ul class="dropdown-menu operations"></ul>
  </div>
  <div about="@" rel="v-fs:operation" data-template="v-s:OperationStatusTemplate" class="pull-left operation-container margin-md-h"></div>
</div>
`;