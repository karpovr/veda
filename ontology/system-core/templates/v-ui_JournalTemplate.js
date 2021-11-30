import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import Util from '/js/common/util.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  //individual.prefetch(50, "v-s:onDocument", "v-wf:onProcess", "v-s:childRecord", "v-s:processJournal", "v-s:subJournal", "v-wf:takenDecision", "v-s:actor", "v-s:creator", "v-wf:executor");

  var doc_uri = this.id.replace(/.$/, "");
  var doc = new IndividualModel(doc_uri);

  $("#on-document", template).attr("about", doc_uri);

  $('.createReport0', template).on('click', function () {
    Util.createReport('v-s:Journal_printBlank', doc);
  });
};

export const html = `
<div class="container journal sheet">
  <style>
    .sub-journal {
      margin-left: 5px; padding-left: 10px;
    }
    .journal hr.margin-sm {
      margin: 10px 0px;
    }
  </style>
  <br>
  <ul id="box-tabs" class="nav nav-tabs nav-right" role="tablist">
    <li class="pull-left"><h2 class="no-margin" about="v-s:Journal" property="rdfs:label"></h2></li>
    <li role="presentation" class="active"><a href="#/@//v-ui:JournalTemplate" class="btn btn-link"><span about="v-ui:JournalTemplate" property="rdfs:label"></span></a></li>
    <li role="presentation"><a href="#/@//v-ui:SimplifiedJournalTemplate" class="btn btn-link"><span about="v-ui:SimplifiedJournalTemplate" property="rdfs:label"></span></a></li>
  </ul>
  <br>
  <div class="clearfix">
    <div class="pull-left">
      <h4 id="on-document" data-template="v-ui:ClassNameLabelLinkTemplate"></h4>
    </div>
    <div class="pull-right">
      <button type="button" class="action btn btn-info view -edit -search createReport0" about="v-s:PrintBlank" property="rdfs:label"></button>
    </div>
  </div>
  <div rel="v-wf:onProcess">
    <h4>
      <span about="rdf:type" property="rdfs:label"></span>:
      <span about="@" data-template="v-ui:ClassNameLabelLinkTemplate"></span>
    </h4>
  </div>
  <br>
  <div class="row">
    <div class="col-md-2 col-sm-3">
      <strong about="v-s:JournalRecord" property="rdfs:label"></strong>
    </div>
    <div class="col-md-8 col-sm-6">
      <strong about="v-s:description" property="rdfs:label"></strong>
    </div>
    <div class="col-md-2 col-sm-3 text-right">
      <strong about="v-s:created" property="rdfs:label"></strong>
    </div>
  </div>
  <div id="records">
    <div rel="v-s:childRecord"></div>
  </div>
</div>
`;