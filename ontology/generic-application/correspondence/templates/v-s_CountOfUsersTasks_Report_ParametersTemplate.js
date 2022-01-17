import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#createReport', template).on('click', function () {
    BrowserUtil.createReport('v-s:CountOfUsersTasks_Report', individual);
  });
};

export const html = `
  <div class="container sheet">
    <h3 about="v-s:CountOfUsersTasks_Report_Parameters" property="rdfs:label"></h3>
    <div class="row">
      <div class="col-md-3">
        <em about="v-s:dateFrom" property="rdfs:label"></em>
        <div property="v-s:dateFrom" class="view -edit -search"></div>
        <veda-control property="v-s:dateFrom" data-type="dateTime" class="-view edit search"></veda-control>
      </div>
      <div class="col-md-3">
        <em about="v-s:dateTo" property="rdfs:label"></em>
        <div property="v-s:dateTo" class="view -edit -search"></div>
        <veda-control property="v-s:dateTo" data-type="dateTime" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row">
      <div class="col-md-6">
        <em about="v-s:checkedDepartment" property="rdfs:label"></em>
        <div rel="v-s:checkedDepartment" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
        <veda-control rel="v-s:checkedDepartment" data-type="link" class="-view edit search fulltext"></veda-control>
      </div>
    </div>
    <br /><br />
    <div class="actions">
      <button type="button" class="action btn btn-success -view edit -search" id="createReport" about="v-s:CreateReport" property="rdfs:label"></button>
    </div>
  </div>
`;
