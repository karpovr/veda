import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('v-s:parentOrganization')) {
    var parentOrganization = individual['v-s:parentOrganization'][0];
    var departmentQueryPrefix = "('rdf:type'=='v-s:Department' && 'v-s:parentOrganization'=='" + parentOrganization.id + "') || ('rdf:type'=='v-s:Organization' && '@'=='" + parentOrganization.id + "')";
    $('veda-control[rel="v-s:parentUnit"]', template).attr('data-query-prefix', departmentQueryPrefix);

    var appointmentQueryPrefix = "'rdf:type'=='v-s:Appointment' && 'v-s:parentOrganization'=='" + parentOrganization.id + "'";
    $('veda-control[rel="v-s:hasChief"]', template).attr('data-query-prefix', appointmentQueryPrefix);
    $('veda-control[rel="v-s:hasFieldChief"]', template).attr('data-query-prefix', appointmentQueryPrefix);
    $('veda-control[rel="v-s:hasFunctionalChief"]', template).attr('data-query-prefix', appointmentQueryPrefix);
  };
  template.on('validate', function() {
    var result = {};
    var subjectCode = individual.hasValue("v-s:subjectCode") && individual["v-s:subjectCode"][0].toString();
    if (!subjectCode) {
      result["v-s:subjectCode"] = {
        state: false,
        cause: ["v-ui:minCardinality"]
      }
    }
    template[0].dispatchEvent(new CustomEvent("validated", {detail: result}));
  });
};

export const html = `
<div class="container sheet">
  <h2>
    <span about="v-s:Department" property="rdfs:label"></span>
    <small about="@" property="rdfs:label"></small>
  </h2>
  <hr>
  <div id="mainProperties">
    <em about="v-s:parentOrganization" property="rdfs:label"></em>
    <div about="@" rel="v-s:parentOrganization" class="view edit -search">
      <a href="#/@">
        <span property="v-s:taxId"></span> - <span property="v-s:shortLabel"></span> - <span property="v-s:legalAddress"></span>
      </a>
    </div>
    <veda-control data-type="link" rel="v-s:parentOrganization" class="-view edit search fulltext"></veda-control>
    <em about="v-s:parentUnit" property="rdfs:label"></em>
    <div rel="v-s:parentUnit" class="view -edit -search" data-template="v-ui:LabelLinkTemplate"></div>
    <veda-control data-type="link" rel="v-s:parentUnit" class="-view edit search fulltext dropdown" data-query-prefix="('rdf:type'=='v-s:Department' && 'v-s:parentOrganization'=='{@.v-s:parentOrganization.id}') || '@'=='{@.v-s:parentOrganization.id}'"></veda-control>
    <hr class="view -edit -search">
    <em about="rdfs:label" property="rdfs:label"></em>
    <div property="rdfs:label" class="view -edit -search"></div>
    <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>
    <div class="row">
      <div class="col-md-6">
        <em about="v-s:shortLabel" property="rdfs:label"></em>
        <div property="v-s:shortLabel" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:shortLabel" class="-view edit search"></veda-control>
      </div>
      <div class="col-md-6">
        <em about="v-s:DepartmentCode" property="rdfs:label"></em>
        <div property="v-s:subjectCode" class="view -edit search"></div>
        <veda-control data-type="string" property="v-s:subjectCode" class="-view edit search"></veda-control>
      </div>
    </div>
    <hr class="view -edit -search">
    <div class="row">
      <div class="col-sm-6">
        <em about="v-s:hasChief" property="rdfs:label"></em>
        <div rel="v-s:hasChief" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
        <veda-control data-type="link" rel="v-s:hasChief" class="-view edit search fulltext dropdown"></veda-control>
        <em about="v-s:hasFieldChief" property="rdfs:label"></em>
        <div rel="v-s:hasFieldChief" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
        <veda-control data-type="link" rel="v-s:hasFieldChief" class="-view edit search fulltext dropdown"></veda-control>
      </div>
      <div class="col-sm-6">
        <em about="v-s:hasFunctionalChief" property="rdfs:label"></em>
        <div rel="v-s:hasFunctionalChief" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
        <veda-control data-type="link" rel="v-s:hasFunctionalChief" class="-view edit search fulltext dropdown"></veda-control>
      </div>
    </div>
    <hr class="view -edit -search">
    <em about="v-s:postalAddress" property="rdfs:label"></em>
    <div property="v-s:postalAddress" class="view -edit -search"></div>
    <veda-control data-type="text" rows="3" property="v-s:postalAddress" class="-view edit search"></veda-control>
  </div>

  <hr>
  <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  <br>
  <!-- BUTTONS -->
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete journal"></span>
  </div>
</div>
`;