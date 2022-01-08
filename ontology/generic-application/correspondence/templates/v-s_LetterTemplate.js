import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (mode === 'edit' || template.data('mode') === 'edit') {
    var userOrganization = veda.appointment.getOrganization();
    var enumerated = new IndividualModel('v-s:LetterRegistrationRecordEnumerated');

    // These events are triggered in v-s:CorrespondentTemplate
    template.on('v-s:sender:own v-s:sender:foreign v-s:recipient:own v-s:recipient:foreign', function (e) {
      e.stopPropagation();
      var keyWord = e.type.split(':')[1];
      keyWord = keyWord.charAt(0).toUpperCase() + keyWord.slice(1);
      var isOwn = 'own' === e.type.split(':')[2];
      var regRecord;
      if (individual.hasValue('v-s:hasLetterRegistrationRecord' + keyWord)) {
        regRecord = individual['v-s:hasLetterRegistrationRecord' + keyWord][0];
      } else {
        regRecord = new IndividualModel();
        individual['v-s:hasLetterRegistrationRecord' + keyWord] = [regRecord];
      }
      regRecord['rdf:type'] = [new IndividualModel('v-s:LetterRegistrationRecord' + keyWord), isOwn ? enumerated : null];
    });
  }
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Печатные бланки
  if (this.hasValue('rdf:type', 'v-s:IncomingLetter')) {
    $('#outgoing-print-blank', template).remove();
    $('#incoming-print-blank', template).on('click', function (e) {
      e.preventDefault();
      BrowserUtil.createReport('v-s:IncomingLetterPrintBlank', individual);
    });
  } else {
    $('#incoming-print-blank', template).remove();
    $('#createReport', template).off('click');
    $('#createReport', template).on('click', function (e) {
      e.preventDefault();
      BrowserUtil.createReport('v-s:OutgoingLetterPrintBlank_pdf', individual);
    });
    $('#createReport1', template).off('click');
    $('#createReport1', template).on('click', function (e) {
      e.preventDefault();
      BrowserUtil.createReport('v-s:OutgoingLetterPrintBlank_rtf', individual);
    });
  }

  // Процессная часть
  function processHandler() {
    individual.canUpdate().then(function (canUpdate) {
      if (individual.hasValue('v-wf:isProcess')) {
        $('#delete.action', template).remove();
      } else if (individual.isNew() || canUpdate) {
        var complexTemplateUri;
        if (individual.hasValue('rdf:type', 'v-s:IncomingLetter')) {
          complexTemplateUri = 'v-s:IncomingLetter_ComplexRouteStartForm_Template';
        }
        if (individual.hasValue('rdf:type', 'v-s:OutgoingLetter')) {
          complexTemplateUri = 'v-s:OutgoingLetter_ComplexRouteStartForm_Template';
        }
        $('#send.action', template).off('click');
        $('#send.action', template).on('click', function () {
          BrowserUtil.send(individual, template, 's-wf:complexRouteTransform', undefined, complexTemplateUri);
        });
      } else {
        $('#delete.action', template).remove();
      }
    });
  }
  individual.on('afterUpdate', processHandler);
  processHandler();
  template.one('remove', function () {
    individual.off('afterUpdate', processHandler);
  });

  $('#add-OutgoingLetter', template).click(function () {
    var _class = new IndividualModel('v-s:OutgoingLetter'),
      OutcomingLetter = new IndividualModel(),
      tmpl = 'v-s:LetterTemplate';
    OutcomingLetter['rdf:type'] = [_class];
    var Sender = new IndividualModel();
    Sender['rdf:type'] = [new IndividualModel('v-s:Correspondent')];
    Sender['v-s:correspondentOrganization'] = individual['v-s:sender'][0]['v-s:correspondentOrganization'];
    Sender['v-s:correspondentDepartmentDescription'] = individual['v-s:sender'][0]['v-s:correspondentDepartmentDescription'];
    Sender['v-s:correspondentPersonDescription'] = individual['v-s:sender'][0]['v-s:correspondentPersonDescription'];
    OutcomingLetter['v-s:recipient'] = [Sender];
    var Recipient = new IndividualModel();
    Recipient['rdf:type'] = [new IndividualModel('v-s:Correspondent')];
    Recipient['v-s:correspondentOrganization'] = individual['v-s:recipient'][0]['v-s:correspondentOrganization'];
    Recipient['v-s:correspondentDepartment'] = individual['v-s:recipient'][0]['v-s:correspondentDepartment'];
    Recipient['v-s:correspondentPerson'] = individual['v-s:recipient'][0]['v-s:correspondentPerson'];
    OutcomingLetter['v-s:sender'] = [Recipient];
    var Link = new IndividualModel();
    Link['rdf:type'] = [new IndividualModel('v-s:Link')];
    Link['v-s:from'] = [OutcomingLetter];
    Link['v-s:to'] = [individual];
    OutcomingLetter['v-s:hasLink'] = [Link];
    OutcomingLetter['v-s:description'] = individual['v-s:description'];
    riot.route(['#', OutcomingLetter.id, '#main', tmpl, 'edit'].join('/'));
  });

  $('#add-IncomingLetter', template).click(function () {
    var _class = new IndividualModel('v-s:IncomingLetter'),
      IncomingLetter = new IndividualModel(),
      tmpl = 'v-s:LetterTemplate';
    IncomingLetter['rdf:type'] = [_class];
    var Sender = new IndividualModel();
    Sender['rdf:type'] = [new IndividualModel('v-s:Correspondent')];
    Sender['v-s:correspondentOrganization'] = individual['v-s:sender'][0]['v-s:correspondentOrganization'];
    Sender['v-s:correspondentDepartmentDescription'] = individual['v-s:sender'][0]['v-s:correspondentDepartmentDescription'];
    Sender['v-s:correspondentPersonDescription'] = individual['v-s:sender'][0]['v-s:correspondentPersonDescription'];
    IncomingLetter['v-s:recipient'] = [Sender];
    var Recipient = new IndividualModel();
    Recipient['rdf:type'] = [new IndividualModel('v-s:Correspondent')];
    Recipient['v-s:correspondentOrganization'] = individual['v-s:recipient'][0]['v-s:correspondentOrganization'];
    Recipient['v-s:correspondentDepartment'] = individual['v-s:recipient'][0]['v-s:correspondentDepartment'];
    Recipient['v-s:correspondentPerson'] = individual['v-s:recipient'][0]['v-s:correspondentPerson'];
    IncomingLetter['v-s:sender'] = [Recipient];
    var Link = new IndividualModel();
    Link['rdf:type'] = [new IndividualModel('v-s:Link')];
    Link['v-s:from'] = [IncomingLetter];
    Link['v-s:to'] = [individual];
    IncomingLetter['v-s:hasLink'] = [Link];
    IncomingLetter['v-s:description'] = individual['v-s:description'];
    riot.route(['#', IncomingLetter.id, '#main', tmpl, 'edit'].join('/'));
  });
  if (individual.hasValue('rdf:type', 'v-s:IncomingLetter')) {
    $('#add-IncomingLetter', template).remove();
  } else if (individual.hasValue('rdf:type', 'v-s:OutgoingLetter')) {
    $('#add-OutgoingLetter', template).remove();
  }
};

export const html = `
<div>
  <div class="container sheet">
    <h2>
      <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
      <small about="@" property="rdfs:label"></small>
    </h2>
    <hr>
    <div class="row">
      <div class="col-sm-6">
        <h3 about="v-s:sender" property="rdfs:label"></h3>
        <div rel="v-s:sender" class="view edit search" data-template="v-s:CorrespondentTemplate" data-embedded="true"></div>
        <veda-control data-type="link" rel="v-s:sender" class="-view edit search create"></veda-control>
        <hr>
        <em about="v-s:RegistrationRecord" property="rdfs:label"></em>
        <div rel="v-s:hasLetterRegistrationRecordSender" class="view edit search" data-template="v-s:LetterRegistrationRecordTemplate" data-embedded="true"></div>
        <veda-control data-type="link" rel="v-s:hasLetterRegistrationRecordSender" class="-view edit search create"></veda-control>
      </div>
      <div class="col-sm-6">
        <h3 about="v-s:recipient" property="rdfs:label"></h3>
        <div rel="v-s:recipient" class="view edit search" data-template="v-s:CorrespondentTemplate" data-embedded="true"></div>
        <veda-control data-type="link" rel="v-s:recipient" class="-view edit search create"></veda-control>
        <hr>
        <em about="v-s:RegistrationRecord" property="rdfs:label"></em>
        <div rel="v-s:hasLetterRegistrationRecordRecipient" class="view edit search" data-template="v-s:LetterRegistrationRecordTemplate" data-embedded="true"></div>
        <veda-control data-type="link" rel="v-s:hasLetterRegistrationRecordRecipient" class="-view edit search create"></veda-control>
      </div>
    </div>
    <div class="row">
      <div class="col-sm-6">
        <em about="v-s:hasDocumentKind" property="rdfs:label"></em>
        <div rel="v-s:hasDocumentKind" class="view edit search" data-template="v-ui:LabelTemplate"></div>
        <veda-control data-type="link" rel="v-s:hasDocumentKind" class="-view edit search fulltext"></veda-control>
      </div>
      <div class="col-sm-3">
        <em about="v-s:dueDate" property="rdfs:label"></em>
        <div property="v-s:dueDate" class="view -edit search"></div>
        <veda-control property="v-s:dueDate" data-type="date" class="-view edit search"></veda-control>
      </div>
      <div class="col-sm-3">
        <em about="v-s:sheetsCount" property="rdfs:label"></em>
        <div property="v-s:sheetsCount" class="view -edit search"></div>
        <veda-control property="v-s:sheetsCount" data-type="integer" class="-view edit search"></veda-control>
      </div>
    </div>
    <hr>
    <em about="v-s:hasDelivery" property="rdfs:label"></em>
    <div rel="v-s:hasDelivery" class="view edit search" data-template="v-s:DeliveryEmbeddedTemplate" data-embedded="true"></div>
    <veda-control data-type="link" rel="v-s:hasDelivery" class="-view edit search create margin-md"></veda-control>
    <hr>
    <em about="v-s:description" property="rdfs:label"></em>
    <div property="v-s:description" class="view -edit -search"></div>
    <veda-control property="v-s:description" data-type="text" rows="2" class="-view edit search"></veda-control>
    <em about="rdfs:comment" property="rdfs:label"></em>
    <div property="rdfs:comment" class="view -edit -search"></div>
    <veda-control property="rdfs:comment" data-type="text" rows="2" class="-view edit search"></veda-control>
    <em about="v-s:attachment" property="rdfs:label"></em>
    <div rel="v-s:attachment" data-template="v-ui:FileTemplateWithComment" data-embedded="true"></div>
    <veda-control data-type="file" rel="v-s:attachment" class="-view edit -search create"></veda-control>
    <div class="view edit -search">
      <em about="v-s:hasRelatedLetter" property="rdfs:label"></em>
      <table class="table table-bordered">
        <thead class="result-header">
          <tr>
            <th colspan="1" ></th>
            <th colspan="3" about="v-s:sender" property="rdfs:label"></th>
            <th colspan="3" about="v-s:recipient" property="rdfs:label"></th>
          </tr>
          <tr class="active">
            <th width="1%"><span class="glyphicon glyphicon-search"></th>
            <th about="v-s:correspondentOrganization" property="rdfs:label"></th>
            <th about="v-s:registrationNumber" property="rdfs:label"></th>
            <th about="v-s:registrationDate" property="rdfs:label"></th>
            <th about="v-s:correspondentOrganization" property="rdfs:label"></th>
            <th about="v-s:registrationNumber" property="rdfs:label"></th>
            <th about="v-s:registrationDate" property="rdfs:label"></th>
          </tr>
        </thead>
        <tbody rel="v-s:hasRelatedLetter">
          <tr>
            <td about="@" data-template="v-ui:IconModalTemplate"></td>
            <td rel="v-s:sender"><span rel="v-s:correspondentOrganization" data-template="v-ui:LabelTemplate"> </span> </td>
            <td rel="v-s:hasLetterRegistrationRecordSender" ><span property="v-s:registrationNumber"></span></td>
            <td rel="v-s:hasLetterRegistrationRecordSender" ><span property="v-s:registrationDate"></span></td>
            <td rel="v-s:recipient"><span rel="v-s:correspondentOrganization" data-template="v-ui:LabelTemplate"></span></td>
            <td rel="v-s:hasLetterRegistrationRecordRecipient" ><span property="v-s:registrationNumber"></span></td>
            <td rel="v-s:hasLetterRegistrationRecordRecipient" ><span property="v-s:registrationDate"></span></td>
          </tr>
        </tbody>
        <tfoot class="-view edit search"><tr><td colspan="7">
          <veda-control data-type="link" rel="v-s:hasRelatedLetter" class="-view edit search fulltext"></veda-control>
        </td></tr></tfoot>
      </table>
    </div>
    <hr>
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br>
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="send save edit cancel delete journal task"></span>
      <button type="button" class="action btn btn-success view -edit -search" id="add-OutgoingLetter" about="v-s:OutgoingLetter" property="rdfs:label"></button>
      <button type="button" class="action btn btn-success view -edit -search" id="add-IncomingLetter" about="v-s:IncomingLetter" property="rdfs:label"></button>
      <button type="button" class="action btn btn-info view -edit -search" id="incoming-print-blank" about="v-s:IncomingLetterPrintBlank" property="rdfs:label"></button>
      <div class="btn-group dropup" id="outgoing-print-blank">
        <button type="button" class="btn btn-info dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
         <span about="v-s:OutgoingLetterPrintBlank" property="rdfs:label"> </span>
          <span class="caret"></span>
        </button>
        <ul class="dropdown-menu">
          <li><a href="#" id="createReport" about="v-s:OutgoingLetterPrintBlank_pdf" property="rdfs:label"></a></li>
          <li><a href="#" id="createReport1" about="v-s:OutgoingLetterPrintBlank_rtf" property="rdfs:label"></a></li>
        </ul>
      </div>
    </div>
  </div>
  <div about="@" class="container sheet view edit -search" data-template="v-s:LinksTemplate" data-embedded="true"></div>
  <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
</div>
`;
