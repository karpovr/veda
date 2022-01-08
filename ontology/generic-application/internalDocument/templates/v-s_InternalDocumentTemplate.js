import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (mode == 'edit' && individual.isNew()) {
    if (!individual.hasValue('v-s:initiator')) {
      individual['v-s:initiator'] = [veda.appointment['v-s:parentUnit'][0]];
    }
  }
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#make-copy', template).click(function () {
    var _class = new IndividualModel('v-s:InternalDocument'),
      InternalDocument = new IndividualModel(),
      tmpl = 'v-s:InternalDocumentTemplate';
    InternalDocument['rdf:type'] = [_class];
    InternalDocument['v-s:responsibleDepartment'] = individual['v-s:responsibleDepartment'];
    InternalDocument['v-s:hasDocumentKind'] = individual['v-s:hasDocumentKind'];
    InternalDocument['v-s:copyTo'] = individual['v-s:copyTo'];
    InternalDocument['v-s:theme'] = individual['v-s:theme'];
    InternalDocument['v-s:content'] = individual['v-s:content'];
    riot.route(['#', InternalDocument.id, '#main', tmpl, 'edit'].join('/'));
    InternalDocument.one('afterSave', function () {
      setTimeout(() => {
        riot.route('#/' + InternalDocument.id, false);
      }, 250);
    });
  });

  $('#print-blank', template).click(function () {
    BrowserUtil.createReport('v-s:InternalDocument_printBlank', individual);
  });

  function processHandler() {
    individual.canUpdate().then(function (canUpdate) {
      if (individual.hasValue('v-wf:isProcess')) {
        $('#send.action', template).remove();
        $('#delete.action', template).remove();
      } else if (individual.isNew() || canUpdate) {
        $('#send.action', template).off('click');
        $('#send.action', template).on('click', function () {
          BrowserUtil.send(individual, template, 's-wf:complexRouteTransform', undefined, 'v-s:InternalDocument_ComplexRouteStartForm_Template');
        });
      } else {
        $('#send.action', template).remove();
        $('#delete.action', template).remove();
      }
    });
  }
  processHandler();

  individual.on('afterReset', processHandler);
  template.one('remove', function () {
    individual.off('afterReset', processHandler);
  });
};

export const html = `
  <div>
    <div class="container sheet">
      <h2>
        <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span><br />
        <small about="@" property="rdfs:label" class="view edit -search"></small>
      </h2>
      <span about="@" data-template="v-ui:RabbitHole" class="view edit -search"></span>
      <hr />
      <div class="row">
        <div class="col-md-6">
          <div class="panel panel-default">
            <div class="panel-body bg-default">
              <em about="v-s:registrationNumber" property="rdfs:label"></em>
              <div property="v-s:registrationNumber" class="view -edit -search"></div>
              <veda-control data-type="text" property="v-s:registrationNumber" class="-view -edit search"></veda-control>
              <em about="v-s:hasDocumentKind" property="rdfs:label"></em>
              <div rel="v-s:hasDocumentKind" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
              <veda-control data-type="link" rel="v-s:hasDocumentKind" class="-view edit search fulltext dropdown"></veda-control>
              <em about="v-s:InitiatorDepartmentForInternalDocumentBundle" property="rdfs:label"></em>
              <div rel="v-s:initiator" class="view edit search" data-template="v-ui:LabelTemplate"></div>
              <veda-control data-type="link" rel="v-s:initiator" class="-view edit search fulltext"></veda-control>
              <em about="v-s:ResponsibleDepartmentForInternalDocumentBundle" property="rdfs:label"></em>
              <div rel="v-s:responsibleDepartment" class="view edit search" data-template="v-ui:LabelTemplate"></div>
              <veda-control data-type="link" rel="v-s:responsibleDepartment" class="-view edit search fulltext"></veda-control>
              <em about="v-s:copyTo" property="rdfs:label"></em>
              <div rel="v-s:copyTo" class="view edit search" data-template="v-ui:LabelTemplate"></div>
              <veda-control data-type="link" rel="v-s:copyTo" class="-view edit search fulltext"></veda-control>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <em about="v-s:theme" property="rdfs:label"></em>
          <div property="v-s:theme" class="view -edit -search"></div>
          <veda-control data-type="string" property="v-s:theme" class="-view edit search"></veda-control>
          <em about="v-s:content" property="rdfs:label"></em>
          <div property="v-s:content" class="view -edit -search"></div>
          <veda-control data-type="text" property="v-s:content" class="-view edit search"></veda-control>
          <em about="rdfs:comment" property="rdfs:label"></em>
          <div property="rdfs:comment" class="view -edit -search"></div>
          <veda-control data-type="text" property="rdfs:comment" class="-view edit search"></veda-control>
        </div>
        <br />
      </div>
      <em about="v-s:attachment" property="rdfs:label" class="view edit -search"></em>
      <div rel="v-s:attachment" data-template="v-ui:FileTemplateWithComment" data-embedded="true"></div>
      <veda-control data-type="file" rel="v-s:attachment" class="-view edit -search"></veda-control>

      <hr />
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
      <br />
      <div class="actions view edit -search">
        <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="send edit save cancel delete journal task"></span>
        <button type="button" class="action btn btn-default view -edit -search" id="make-copy" about="v-s:Clone" property="rdfs:label"></button>
        <button
          type="button"
          class="action btn btn-info view -edit -search"
          id="print-blank"
          about="v-s:InternalDocument_printBlank"
          property="rdfs:label"></button>
      </div>
    </div>
    <div about="@" class="container sheet view edit -search" data-template="v-s:LinksTemplate" data-embedded="true"></div>
    <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
  </div>
`;
