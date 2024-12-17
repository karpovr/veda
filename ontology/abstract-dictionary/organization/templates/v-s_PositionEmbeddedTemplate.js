import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.on('validate', function () {
    const result = {};
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
    if (individual.hasValue('rdfs:label') && individual.hasValue('v-s:parentUnit') && individual.isNew()) {
      const queryString =
        "'rdf:type'==='v-s:Position' && 'v-s:parentUnit'=='" + individual['v-s:parentUnit'][0].id + "' && 'rdfs:label'=='" + individual['rdfs:label'][0] + "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        const tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningOccupationName').addClass('hide');
        } else {
          $('#warningOccupationName').removeClass('hide');
        }
      });
    }

    if (individual.hasValue('v-s:subjectCode')) {
      const queryString =
        "'rdf:type'==='v-s:Position' && 'v-s:parentOrganization'=='" +
        individual['v-s:parentOrganization'][0].id +
        "' && 'v-s:subjectCode'=='" +
        individual['v-s:subjectCode'][0] +
        "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        const tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningOccupationSubCode').addClass('hide');
        } else {
          $('#warningOccupationSubCode').removeClass('hide');
        }
      });
    }
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  veda.user.isMemberOf('cfg:SuperUser').then(function (isMemberSuperUser) {
    if (isMemberSuperUser) {
      $('#label_edit', template).removeAttr('disabled');
    } else{
      $('#label_edit', template).remove();
    }
  });
  // для сторонних организаций формируем Полное наименование должности из title и организации
  individual.on('v-s:title', function (values) {
    if (values && values.length && individual.hasValue('v-s:parentOrganization') && individual['v-s:parentOrganization'][0].id !== 'd:org_RU1121003135') {
      const title = values[0];
      const orgName = individual['v-s:parentOrganization'][0]['rdfs:label'][0];
      individual['rdfs:label'] = [`${title}. ${orgName}`];
    }
  });   
};

export const html = `
  <div>
    <div class="container sheet">
      <div id="warningOccupationName" class="alert alert-warning hide">
        <span>Внимание. Должность с похожим названием уже существует в данной организации. Возможно Вам следует использовать ее.</span>
      </div>
      <div id="warningOccupationSubCode" class="alert alert-warning hide">
        <span>Внимание. Должность с таким кодом уже существует в данной организации. </span>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:title" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div property="v-s:title" class="view -edit -search"></div>
          <veda-control data-type="multilingualText" property="v-s:title" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:LabelBundleForPosition" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div about="@" property="rdfs:label" class="view edit -search"></div>
          <veda-control class="disabled" id="label_edit" data-type="multilingualText" property="rdfs:label" class="-view edit search"></veda-control>
        </div>
      </div>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:PositionCode" property="rdfs:label"></label>
        </div>
        <div class="col-sm-3 col-xs-3">
          <div property="v-s:subjectCode" class="view -edit -search"></div>
          <veda-control data-type="string" property="v-s:subjectCode" class="-view edit search"></veda-control>
        </div>
      </div>
    </div>
  </div>
`;
