import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const _class = new IndividualModel('v-s:Subsidiary');

  Promise.all([_class.rights, individual.rights])
    .then(function (rights) {
      const class_rights = rights[0];
      const individual_rights = rights[1];
      if (!class_rights.hasValue('v-s:canCreate', true) || !individual_rights.hasValue('v-s:canUpdate', true)) {
        $('#add-subsidiary', template).remove();
      }
    })
    .catch(function (error) {
      console.log(error);
    });

  let prevTaxId = individual.hasValue('v-s:taxId') && individual['v-s:taxId'][0].toString();

  // Validation
  template.on('validate', function () {
    const result = {state: true};
    let regexp;
    if (individual.hasValue('v-s:hasClassifierCountry', 'd:Country_RUS') && individual.hasValue('v-s:hasClassifierLegalForm', 'd:OKOPF_50102')) {
      regexp = /^([0-9]{12})$/gi;
    } else if (individual.hasValue('v-s:hasClassifierCountry', 'd:Country_RUS')) {
      regexp = /^([0-9]{10})$/gi;
    } else if (individual.hasValue('v-s:hasClassifierCountry', 'd:Country_NLD')) {
      regexp = /^[A-Z]{1,3}[0-9]{9}[B]{1}[0-9]{2}$/gi;
    } else if (individual.hasValue('v-s:hasClassifierCountry')) {
      regexp = /^[A-Z]{1,3}[0-9]{4,}$/gi;
    }
    if (!individual.hasValue('v-s:taxId')) {
      result['v-s:taxId'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    } else {
      // Check regexp
      const taxId = individual['v-s:taxId'][0].toString();
      if (taxId != '0000000000' && taxId != '000000000000') {
        result['v-s:taxId'] = {
          state: regexp.test(taxId),
          cause: ['v-ui:regexp'],
        };
      } else {
        result['v-s:taxId'] = {
          state: false,
          cause: ['v-s:ForSafeTaxId'],
        };
      }

      // Check unique
      const newTaxId = individual.hasValue('v-s:taxId') && individual['v-s:taxId'][0].toString();
      if (prevTaxId !== newTaxId) {
        prevTaxId = newTaxId;
      }
      if (result['v-s:taxId'].state) {
        Backend.query(veda.ticket, "'rdf:type'==='v-s:Organization' && 'v-s:taxId'=='" + taxId + "'").then(function (queryResult) {
          result['v-s:taxId'] = {
            state: !queryResult.result.length || queryResult.result[0] === individual.id,
            cause: ['v-s:NonUniqueTaxId'],
          };
          template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
        });
      }
    }
    // Если значение поля v-s:hasClassifierCountry=d:Country_RUS то поле v-s:hasClassifierLegalForm Обязательное
    if (individual.hasValue('v-s:hasClassifierCountry', 'd:Country_RUS')) {
      result['v-s:hasClassifierLegalForm'] = {
        state: individual.hasValue('v-s:hasClassifierLegalForm'),
        cause: ['v-ui:minCardinality'],
      };
    }
    // Если значение поля v-s:hasClassifierCountry=d:Country_RUS и поле v-s:hasClassifierLegalForm=d:OKOPF_50102 то поле v-s:taxRegistrationCause должно быть обязательным.
    if (
      individual.hasValue('v-s:hasClassifierCountry', 'd:Country_RUS') &&
      !individual.hasValue('v-s:hasClassifierLegalForm', 'd:OKOPF_50102') &&
      !individual.hasValue('v-s:hasClassifierLegalForm', 'd:OKOPF_50000')
    ) {
      result['v-s:taxRegistrationCause'] = {
        state: /^[0-9]{9}$/.test(individual['v-s:taxRegistrationCause'][0]),
        cause: ['v-ui:regexp'],
      };
    }
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Генерация Uri
  BrowserUtil.registerHandler(individual, 'beforeSave', template, function () {
    const shortLabel = individual['v-s:hasClassifierCountry'][0]['v-s:shortLabel'];
    const taxId = individual['v-s:taxId'];
    if (individual.hasValue('v-s:hasClassifierCountry', 'd:Country_RUS') && individual.isNew()) {
      individual.id = 'd:org_' + shortLabel + taxId;
    } else if (individual.isNew()) {
      individual.id = 'd:org_' + taxId;
    }
  });

  $('#add-subsidiary', template).click(function () {
    let modal = $('#notification-modal-template').html();
    modal = $(modal);
    modal.modal({show: false});
    $('body').append(modal);
    modal.modal('show');
    template.one('remove', function () {
      modal.modal('hide').remove();
    });
    const cntr = $('.modal-body', modal);
    const _class = new IndividualModel('v-s:Subsidiary');
    const subsidiary = new IndividualModel();
    const tmpl = new IndividualModel('v-s:SubsidiaryTemplate');
    subsidiary['rdf:type'] = [_class];
    subsidiary['v-s:backwardTarget'] = [individual];
    subsidiary['v-s:backwardProperty'] = [new IndividualModel('v-s:hasSubsidiary')];
    subsidiary['v-s:canRead'] = [true];
    subsidiary.present(cntr, tmpl, 'edit');
    subsidiary.one('beforeReset', function () {
      modal.modal('hide').remove();
    });
    subsidiary.one('afterSave', function () {
      modal.modal('hide').remove();
    });
  });
};

export const html = `
<div>
  <div class="container sheet">
    <h2>
      <span about="v-s:Organization" property="rdfs:label"></span>
      <small about="@" property="rdfs:label"></small>
    </h2>
    <hr>
    <div class="row">
      <div class="col-md-8">
        <em about="rdfs:label" property="rdfs:label"></em>
        <div property="rdfs:label" class="view -edit -search"></div>
        <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>
      </div>
      <div class="col-md-8">
        <em about="v-s:FullNameOrgBundle" property="rdfs:label"></em>
        <div property="v-s:title" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:title" class="-view edit search"></veda-control>
      </div>
    </div>
    <hr class="view -edit -search">
    <div class="row">
      <div class="col-md-4">
        <em about="v-s:hasClassifierCountry" property="rdfs:label"></em>
        <div rel="v-s:hasClassifierCountry" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
        <veda-control data-type="link" rel="v-s:hasClassifierCountry" class="-view edit search fulltext" data-template="{@.v-s:shortLabel} | {@.rdfs:label}"></veda-control>
      </div>
      <div class="col-md-8">
        <em about="v-s:hasClassifierLegalForm" property="rdfs:label"></em>
        <div rel="v-s:hasClassifierLegalForm" class="view -edit search" data-template="v-ui:LabelTemplate"></div>
        <veda-control data-type="link" rel="v-s:hasClassifierLegalForm" class="-view edit search fulltext"></veda-control>
      </div>
    </div>
    <hr class="view -edit -search">
    <div class="row">
      <div class="col-sm-4">
        <em about="v-s:taxId" property="rdfs:label"></em>
        <div property="v-s:taxId" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:taxId" class="-view edit search"></veda-control>
      </div>
      <div class="col-sm-4">
        <em about="v-s:taxRegistrationCause" property="rdfs:label"></em>
        <div property="v-s:taxRegistrationCause" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:taxRegistrationCause" class="-view edit search"></veda-control>
      </div>
      <div class="col-sm-4">
        <em about="v-s:taxRegistrationNumber" property="rdfs:label"></em>
        <div property="v-s:taxRegistrationNumber" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:taxRegistrationNumber" class="-view edit search"></veda-control>
      </div>
    </div>

    <hr class="view -edit -search">

    <div class="row">
      <div class="col-sm-4">
        <em about="v-s:legalAddress" property="rdfs:label"></em>
        <div property="v-s:legalAddress" class="view -edit -search"></div>
        <veda-control data-type="text" rows="3" property="v-s:legalAddress" class="-view edit search"></veda-control>
      </div>
      <div class="col-sm-4">
        <em about="v-s:postalAddress" property="rdfs:label"></em>
        <div property="v-s:postalAddress" class="view -edit -search"></div>
        <veda-control data-type="text" rows="3" property="v-s:postalAddress" class="-view edit search"></veda-control>
      </div>
    </div>
    <hr class="view -edit -search">
    <em about="v-s:LegalEntityExistencePeriodBundle" property="rdfs:label"></em>
    <div class="row">
      <div class="col-md-4">
        <div property="v-s:dateFromFact" class="view -edit -search"></div>
        <veda-control property="v-s:dateFromFact" data-type="date" class="-view edit search"></veda-control>
      </div>
      <div class="col-md-4">
        <div property="v-s:dateToFact" class="view -edit -search"></div>
        <veda-control property="v-s:dateToFact" data-type="date" class="-view edit search"></veda-control>
      </div>
    </div>
    <em about="v-s:hasSubsidiary" property="rdfs:label"></em>
    <table class="table table-condensed table-bordered">
      <thead>
        <tr class="view -edit -search active">
          <th width="1%"><span class="glyphicon glyphicon-search"></th>
          <th about="rdfs:label" property="rdfs:label"></th>
          <th about="v-s:taxRegistrationCause" property="rdfs:label"></th>
          <th about="v-s:postalAddress" property="rdfs:label"></th>
        </tr>
      </thead>
      <tbody rel="v-s:hasSubsidiary" data-embedded="true">
        <tr>
          <td about="@" data-template="v-ui:IconModalTemplate"></td>
          <td>
            <div property="rdfs:label" class="view -edit -search"></div>
            <veda-control property="rdfs:label" data-type="string" class="-view edit search"></veda-control>
          </td>
          <td>
            <div property="v-s:taxRegistrationCause" class="view -edit -search"></div>
            <veda-control property="v-s:taxRegistrationCause" data-type="string" class="-view edit search"></veda-control>
          </td>
          <td>
            <div property="v-s:postalAddress" class="view -edit -search"></div>
            <veda-control property="v-s:postalAddress" data-type="string" class="-view edit search"></veda-control>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="view -edit -search">
      <button class="btn btn-success" id="add-subsidiary">
        <span class="glyphicon glyphicon-zoom-in"></span>
        <span about="v-s:AddSubsidiary" property="rdfs:label"></span>
      </button>
    </div>

    <em about="v-s:HeadOrganization" property="rdfs:label"></em>
    <div rel="v-s:parentUnit" class="view -edit -search" data-template="v-ui:LabelTemplate"></div>
    <veda-control data-type="link" rel="v-s:parentUnit" class="-view edit search fulltext"></veda-control>
    <hr class="view -edit -search">

    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br>
    <!-- BUTTONS -->
    <div class="actions">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete journal"></span>
    </div>
  </div>
  <div about="@" class="container sheet view edit -search" data-template="v-s:LinksTemplate" data-embedded="true"></div>
  <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
</div>
`;
