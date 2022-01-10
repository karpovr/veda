import $ from 'jquery';
import Backend from '/js/common/backend.js';
import IndividualModel from '/js/common/individual_model.js';
import veda from '/js/common/veda.js';

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
          $('#warningPersonFIO').addClass('hidden');
        } else {
          $('#warningPersonFIO').removeClass('hidden');
        }
      });
    }
    if (individual.hasValue('v-s:tabNumber') && individual.isNew()) {
      const queryString =
        "'v-s:parentOrganization'=='" + individual['v-s:parentOrganization'][0].id + "' && 'v-s:tabNumber'=='" + individual['v-s:tabNumber'][0] + "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        const tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningTN').addClass('hidden');
        } else {
          $('#warningTN').removeClass('hidden');
        }
      });
    }
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  const canCreateSubsidiary = new IndividualModel('v-s:Subsidiary').canCreate();
  Promise.all([canCreateSubsidiary]).then(function (results) {
    if (!results[0] || !results[1]) {
      $('#add-subsidiary', template).remove();
    }
  });

  const queryString = "'rdf:type'==='v-s:Appointment' && 'v-s:employee'==='" + individual.id + "'";
  $("veda-control[rel='v-s:defaultAppointment']", template).attr('data-query-prefix', queryString);
  // $('veda-control[rel="v-s:parentUnit"]', template).attr('data-query-prefix', departmentQueryPrefix);
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('rdfs:isDefinedBy')) {
    $('.actions #edit', template).attr('disabled', 'disabled');
  }
  if (!individual.hasValue('v-s:birthday')) {
    $('span[property="v-s:birthday"]').text('Не указано');
  }
};

export const html = `
<div class="container sheet">

    <div id="warningPersonFIO" class="alert alert-warning hidden">
      <span>Внимание. Пользователь с такими ФИО уже существует в данной организации. Возможно Вам следует выбрать его.</span>
    </div>
    <div id="warningTN" class="alert alert-warning hidden">
      <span>Внимание. Такой табельный номер уже существует у данной организации.</span>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:lastName" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <veda-control property="v-s:lastName" data-type="multilingualString" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:firstName" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <veda-control property="v-s:firstName" data-type="multilingualString" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
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
      <div class="col-sm-3 col-xs-5 view edit -search">
        <label about="v-s:hasCommunicationMean" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <span class="view -edit -search" about="@" property="v-s:tabNumber"></span>
          <table class="table table-bordered">
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
    <section id="Account">
      <h4 class="section-header -view edit -search">
        <span about="v-s:Account" property="rdfs:label"></span>
        <div class="btn-group -view edit -search"></div>
        <veda-control data-type="link" rel="v-s:hasAccount" class="-view edit -search create pull-right"></veda-control>
      </h4>
      <div rel="v-s:hasAccount" data-embedded="true" data-template="v-s:AccountEmbeddedTemplate"></div>
    </section>

</div>
`;
