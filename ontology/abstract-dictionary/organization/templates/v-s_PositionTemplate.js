import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.on('validate', function () {
    var result = {};
    if (!individual.hasValue('v-s:subjectCode')) {
      result['v-s:subjectCode'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    }
    if (!individual.hasValue('rdfs:label')) {
      result['rdfs:label'] = {
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
    if (!individual.hasValue('v-s:parentUnit')) {
      result['v-s:parentUnit'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    }
    if (!individual.hasValue('v-s:origin')) {
      result['v-s:origin'] = {
        state: false,
        cause: ['v-ui:minCardinality'],
      };
    }
    if (individual.hasValue('rdfs:label') && individual.hasValue('v-s:parentOrganization') && individual.isNew()) {
      var queryString =
        "'rdf:type'==='v-s:Position' && 'v-s:parentUnit'=='" + individual['v-s:parentUnit'][0].id + "' && 'rdfs:label'=='" + individual['rdfs:label'][0] + "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        var tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningOccupationName').addClass('hide');
        } else {
          $('#warningOccupationName').removeClass('hide');
        }
      });
    }
    if (individual.hasValue('v-s:subjectCode') && individual.hasValue('v-s:parentOrganization') && individual.isNew()) {
      var queryString =
        "'rdf:type'==='v-s:Position' && 'v-s:parentOrganization'=='" +
        individual['v-s:parentOrganization'][0].id +
        "' && 'v-s:subjectCode'=='" +
        individual['v-s:subjectCode'][0] +
        "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        var tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningOccupationSubCode').addClass('hide');
        } else {
          $('#warningOccupationSubCode').removeClass('hide');
        }
      });
    }
    template[0].dispatchEvent(new CustomEvent('validated', { detail: result }));
  });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (template.data('mode') === 'view' && veda.appointment.id != 'cfg:AdministratorAppointment') {
    $('#edit.action', template).remove();
  }

  if (!individual.isNew() && veda.appointment.id != 'cfg:AdministratorAppointment') $('.notEditForUsers').addClass('hide');
};

export const html = `
  <div>
    <div class="container sheet">
      <h2>
        <span about="v-s:Position" property="rdfs:label"></span>
        <small about="@" property="rdfs:label"></small>
      </h2>
      <hr />
      <div id="warningOccupationName" class="alert alert-warning hide">
        <span>Внимание. Должность с похожим названием уже существует в данной организации. Возможно Вам следует использовать ее.</span>
      </div>
      <div id="warningOccupationSubCode" class="alert alert-warning hide">
        <span>Внимание. Должность с таким кодом уже существует в данной организации. </span>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:Organization" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div about="@" rel="v-s:parentOrganization" class="view edit search" data-template="v-ui:LabelLinkTemplate"></div>
          <veda-control
            rel="v-s:parentOrganization"
            data-query-prefix="'rdf:type'=='v-s:Organization'"
            data-type="link"
            class="-view edit search fulltext dropdown notEditForUsers"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:Department" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div about="@" rel="v-s:parentUnit" class="view edit search" data-template="v-ui:LabelLinkTemplate"></div>
          <veda-control
            rel="v-s:parentUnit"
            data-query-prefix="('rdf:type'=='v-s:Department' && 'v-s:parentOrganization'=='{@.v-s:parentOrganization.id}') || '@'=='{@.v-s:parentOrganization.id}'"
            data-type="link"
            class="-view edit search fulltext dropdown notEditForUsers"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:title" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div property="rdfs:label" class="view -edit -search"></div>
          <veda-control data-type="multilingualText" property="rdfs:label" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:PositionCode" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div property="v-s:subjectCode" class="view -edit -search"></div>
          <veda-control data-type="string" property="v-s:subjectCode" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute notEditForUsers">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:origin" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div property="v-s:origin" class="view -edit -search"></div>
          <veda-control property="v-s:origin" data-type="string" class="-view edit search"></veda-control>
        </div>
      </div>
      <hr />
      <br />
      <!--Системные свойства-->
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
      <br />
      <!-- BUTTONS -->
      <div class="actions view edit -search">
        <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
      </div>
    </div>
  </div>
`;
