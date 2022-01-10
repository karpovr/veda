import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.on('validate', function () {
    const result = {};
    if (!individual.hasValue('v-s:lastName')) {
      result['v-s:lastName'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    }
    if (!individual.hasValue('v-s:firstName')) {
      result['v-s:firstName'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    }
    if (!individual.hasValue('v-s:tabNumber')) {
      result['v-s:tabNumber'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    }
    if (!individual.hasValue('v-s:parentOrganization')) {
      result['v-s:parentOrganization'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    }
    if (individual.hasValue('v-s:lastName') && individual.hasValue('v-s:firstName') && individual.hasValue('v-s:parentOrganization') && individual.isNew()) {
      const queryString =
        "'rdf:type'==='v-s:Person' && 'v-s:parentOrganization'=='" +
        individual['v-s:parentOrganization'][0].id +
        "' && 'v-s:lastName'=='" +
        individual['v-s:lastName'][0] +
        "' && 'v-s:firstName'=='" +
        individual['v-s:firstName'][0] +
        "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        const tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningPersonFIO').addClass('hide');
        } else {
          $('#warningPersonFIO').removeClass('hide');
        }
      });
    }
    if (individual.hasValue('v-s:tabNumber') && individual.isNew()) {
      const queryString =
        "'rdf:type'==='v-s:Person' && 'v-s:parentOrganization'=='" +
        individual['v-s:parentOrganization'][0].id +
        "' && 'v-s:tabNumber'=='" +
        individual['v-s:tabNumber'][0] +
        "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        const tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningPersonTabNum').addClass('hide');
        } else {
          $('#warningPersonTabNum').removeClass('hide');
        }
      });
    }
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  if (veda.appointment.id != 'cfg:AdministratorAppointment') {
    $('#add-Account', template).attr('disabled', 'disabled');
  }
  const canUpdatePromise = individual.canUpdate();
  const canCreateSubsidiary = new IndividualModel('v-s:Subsidiary').canCreate();
  Promise.all([canCreateSubsidiary, canUpdatePromise]).then(function (results) {
    if (!results[0] || !results[1]) {
      $('#add-subsidiary', template).remove();
    }
  });
  const canCreatePerson = new IndividualModel('v-s:Person').canCreate();
  const canCreatePosition = new IndividualModel('v-s:Position').canCreate();
  const canCreateAppointment = new IndividualModel('v-s:Appointment').canCreate();
  Promise.all([canUpdatePromise, canCreatePerson, canCreatePosition, canCreateAppointment]).then(function (results) {
    if (!results[0] || !results[1] || !results[2] || !results[3]) {
      $('#deleteAppointment', template).remove();
    }
  });

  const canDeletePerson = individual.canDelete();
  Promise.all([canDeletePerson]).then(function (results) {
    if (!results[0]) {
      $('#dismissEmployee', template).remove();
    }
  });

  const queryString = "'rdf:type'==='v-s:Appointment' && 'v-s:employee'==='" + individual.id + "'";
  $("veda-control[rel='v-s:defaultAppointment']", template).attr('data-query-prefix', queryString);
  // $('veda-control[rel="v-s:parentUnit"]', template).attr('data-query-prefix', departmentQueryPrefix);
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // нельзя редактировать пользователей ttl
  if (individual.hasValue('rdfs:isDefinedBy')) $('.actions #edit', template).attr('disabled', 'disabled');

  if (!individual.hasValue('v-s:birthday')) $('span[property="v-s:birthday"]').text('Не указано');

  // Блок только для админа
  if (!individual.isNew() && veda.appointment.id != 'cfg:AdministratorAppointment') {
    $('.notEditForUsers').addClass('hide');
    $('#notNewBundle').removeClass('hide');
    $('.new').addClass('hide');
  }

  $('.actions #save').on('click', function () {
    const tempCommunicationMean = individual['v-s:hasCommunicationMean'];

    individual['v-s:owner'] = [individual];
    if (tempCommunicationMean) {
      tempCommunicationMean.map(function (CommunicationMean) {
        CommunicationMean['v-s:parent'] = [individual];
        return CommunicationMean.save();
      });
    }
    individual.save();
  });

  // добавить аккаунт
  $('#add-Account', template).click(function () {
    const NewAccount = new IndividualModel();
    const _class = new IndividualModel('v-s:Account');
    const tmpl = new IndividualModel('v-s:AccountTemplate');
    NewAccount['rdf:type'] = [_class];
    NewAccount['v-s:backwardTarget'] = [individual];
    NewAccount['v-s:backwardProperty'] = [new IndividualModel('v-s:hasAccount')];
    NewAccount['v-s:owner'] = [individual];
    const modal = BrowserUtil.showModal(NewAccount, tmpl, 'edit');
    NewAccount.one('afterSave', function () {
      individual.save();
      modal.modal('hide').remove();
    });
  });

  // добавить назначение
  $('#add-Appointment', template).click(function () {
    const NewAppointment = new IndividualModel();
    const _class = new IndividualModel('v-s:Appointment');
    const tmpl = new IndividualModel('v-s:AppointmentTemplate');
    NewAppointment['rdf:type'] = [_class];
    if (individual.hasValue('v-s:hasAppointment')) NewAppointment['v-s:parentUnit'] = individual['v-s:hasAppointment'][0]['v-s:parentUnit'];
    else {
      NewAppointment['v-s:parentUnit'] = individual['v-s:parentOrganization'];
    }
    NewAppointment['v-s:parentOrganization'] = individual['v-s:parentOrganization'];
    NewAppointment['v-s:employee'] = [individual];
    const modal = BrowserUtil.showModal(NewAppointment, tmpl, 'edit');
    NewAppointment.one('afterSave', function () {
      individual.save();
      modal.modal('hide').remove();
    });
  });

  // уволить сотрудника
  $('#dismissEmployee', template).click(function () {
    individual['v-s:deleted'] = [true];
    individual.save();
  });

  function handlerAccount () {
    if (individual.hasValue('v-s:hasAccount')) {
      $('#add-Account', template).remove();
    }
  }
  handlerAccount();

  function deletedHandler () {
    if (individual.hasValue('v-s:deleted', true)) {
      if (individual.hasValue('v-s:hasAppointment')) {
        individual['v-s:hasAppointment'].forEach(function (appointment) {
          appointment.delete();
        });
      }
    }
  }

  individual.on('v-s:deleted', deletedHandler);
  individual.on('v-s:hasAccount', handlerAccount);
  /* individual.on("add-Account", handler);*/
  template.one('remove', function () {
    individual.off('v-s:hasAccount', handlerAccount);
    individual.off('v-s:deleted', deletedHandler);
  });
};

export const html = `
<div class="container sheet">
  <div class="col-sm-12 col-xs-12">
   <div id="warningPersonFIO" class="alert alert-warning hide">
      <span>Внимание. Пользователь с такими ФИО уже существует в данной организации. Возможно Вам следует выбрать его.</span>
    </div>
    <div id="warningPersonTabNum" class="alert alert-warning hide">
      <span>Внимание. Пользователь с таким табельным номером уже существует в данной организации.</span>
    </div>
     <div class="col-md-9">
        <h3 class="margin-sm view edit search">
          <span about="v-s:Person" property="rdfs:label"></span>
        </h3>
        <hr>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5"></div>
          <div class="col-sm-9 col-xs-7">
            <h4 class="view edit -search"><span about="@" property="v-s:lastName"></span> <span about="@" property="v-s:firstName"></span> <span about="@" property="v-s:middleName"></span></h4>
          </div>
        </div>
        <div class="row row-attribute -view edit -search new">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:parentOrganization" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7 -view edit -search new">
            <veda-control rel="v-s:parentOrganization" data-query-prefix="'rdf:type'=='v-s:Organization'" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
          </div>
        </div>
        <div id="notNewBundle" class="alert alert-info hide -view edit -search">
          <span>ФИО пользователя редактировать нельзя. Если Вы допустили опечатку, то обратитесь в службу поддержки.
          </span>
        </div>
        <div class="row row-attribute -view edit search new">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:lastName" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7 new">
            <veda-control property="v-s:lastName" data-type="multilingualString" class="-view edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute  -view edit search new">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:firstName" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7 new">
            <veda-control property="v-s:firstName" data-type="multilingualString" class="-view edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute -view edit search new">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:middleName" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <veda-control property="v-s:middleName" data-type="multilingualString" class="-view edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:birthday" property="rdfs:label"></label>
          </div>
          <div class="col-sm-3 col-xs-3">
            <span class="view -edit -search" about="@" property="v-s:birthday"></span>
            <veda-control property="v-s:birthday" data-type="date" class="-view edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:tabNumber" property="rdfs:label"></label>
          </div>
          <div class="col-sm-3 col-xs-3">
            <span class="view -edit -search" about="@" property="v-s:tabNumber"></span>
            <veda-control property="v-s:tabNumber" data-type="string" class="-view edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:parentOrganization" property="rdfs:label" class="view -edit search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div about="@" rel="v-s:parentOrganization" class="view -edit search" data-template="v-ui:LabelLinkTemplate"></div>
            <veda-control rel="v-s:parentOrganization" data-type="link" class="-view -edit search fulltext"></veda-control>
          </div>
        </div>
        <div class="row row-attribute notEditForUsers">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:origin" property="rdfs:label" class="-view edit search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <veda-control property="v-s:origin" data-type="string" class="-view -edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:defaultAppointment" property="rdfs:label" class="view edit -search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div about="@" rel="v-s:defaultAppointment" class="view -edit -search" data-template="v-ui:LabelTemplate">
            </div>
            <veda-control rel="v-s:defaultAppointment" data-type="link" class="-view edit -search fulltext dropdown"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:hasAppointment" property="rdfs:label" class="view edit search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <table class="table table-bordered view edit -search">
              <thead>
                <tr class="view edit -search">
                  <th width="1%" class="view -edit -search"><span class="glyphicon glyphicon-search"></th>
                  <th about="rdfs:label" property="rdfs:label"></th>
                  <th about="v-s:dateFrom" property="rdfs:label"></th>
                  <th about="v-s:dateTo" property="rdfs:label"></th>
                  <th class="view -edit -search"></th>
                  <th class="view -edit -search"></th>
                </tr>
              </thead>
              <tbody about="@" rel="v-s:hasAppointment" data-embedded="true" data-template="v-s:AppointmentEmbeddedTableTemplate"></tbody>

            </table>
            <div class="view -edit -search">
              <button class="btn btn-xs btn-success" id="add-Appointment">
                <span class="glyphicon glyphicon-zoom-in"></span>
                <span  about="v-s:AppointmentBundle" property="rdfs:label"> </span>
              </button>
              <button class="btn btn-xs btn-danger" id="dismissEmployee">
                <span  about="v-s:DismissBundle" property="rdfs:label"> </span>
              </button>
            </div>
            <veda-control data-type="link" rel="v-s:hasAppointment" class="-view -edit search fulltext"></veda-control>
          </div>
        </div>
        <br>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:hasCommunicationMean" property="rdfs:label" class="view edit -search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <table class="table table-bordered view edit -search">
              <thead>
                <tr class="view edit -search">
                  <th width="1%"><span class="glyphicon glyphicon-search"></th>
                  <th about="v-s:hasCommunicationMeanChannel" property="rdfs:label"></th>
                  <th about="v-s:hasCommunicationMeanTarget" property="rdfs:label"></th>
                  <th about="v-s:description" property="rdfs:label"></th>
                  <th about="rdfs:comment" property="rdfs:label"></th>
                </tr>
              </thead>
              <tbody rel="v-s:hasCommunicationMean" data-embedded="true" data-template="v-s:CommunicationMeanTemplateEmbedded"></tbody>
            </table>
            <veda-control data-type="link" rel="v-s:hasCommunicationMean" class="-view edit -search create"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:login" property="rdfs:label" class="view -edit -search"></label>
          </div>
          <div class="col-sm-9 col-xs-7 view -edit -search" >
            <span about="@" rel="v-s:hasAccount">
              <span about="@" property="v-s:login" ></span>
            </span>
            <button class="btn btn-xs btn-success" id="add-Account">
              <span class="glyphicon glyphicon-zoom-in"></span>
              <span  about="v-s:hasAccount" property="rdfs:label"> </span>
            </button>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="rdfs:comment" property="rdfs:label" class="-view edit search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <veda-control property="rdfs:comment" data-type="string" class="-view edit search"></veda-control>
          </div>
        </div>
    </div>
    <div class="col-md-3">
      <div rel="v-s:hasImage">
        <div class="img-thumbnail" about="@" data-template="v-ui:ModalImageTemplate"></div>
      </div>
      <br class="-view edit search"/>
      <veda-control rel="v-s:hasImage" data-type="file" accept=".png, .jpg, .jpeg" class="-view edit -search"></veda-control>
    </div>
  </div>

    <div class="col-sm-12 col-xs-12">
      <br/>
      <hr>
    </div>
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br>
    <div class="actions">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel"></span>
    </div>
</div>
`;
