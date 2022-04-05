import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.on('validate', function () {
    const result = {};
    result['v-s:employee'] = {
      state: individual.hasValue('v-s:employee'),
      cause: ['v-ui:minCardinality'],
    };
    result['v-s:occupation'] = {
      state: individual.hasValue('v-s:occupation'),
      cause: ['v-ui:minCardinality'],
    };
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
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });
  template.on('special-validate', function (e, validStates) {
    setTimeout(function () {
      if ($('div.validating-block:not(.hide) .has-error', template).length == 0) {
        $('.action#save', template).removeAttr('disabled');
      } else {
        $('.action#save', template).attr('disabled', 'disabled');
      }
    }, 500);
  });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (template.attr('data-mode') === 'view' && veda.appointment.id != 'cfg:AdministratorAppointment') {
    $('#edit.action', template).remove();
  }
  if (veda.appointment.id != 'cfg:AdministratorAppointment') {
    $('.notEditForUsers').addClass('hide');
  }
  // проставляет признаки по умолчанию для Назначения
  if (mode === 'edit' && individual.isNew()) {
    individual['v-s:official'] = [true];
    individual['v-s:dateFrom'] = [new Date()];
  }

  // Отображает Персону и Должность после выбора ОрганизTeации
  function hidePosAndEmp () {
    if (individual.hasValue('v-s:parentOrganization')) {
      $('#Employee').removeClass('hide');
      $('#Position').removeClass('hide');
    } else {
      $('#Employee').addClass('hide');
      $('#Position').addClass('hide');
      individual['v-s:parentUnit'] = [];
    }
  }
  individual.on('v-s:parentOrganization', hidePosAndEmp);
  template.one('remove', function () {
    individual.off('v-s:parentOrganization', hidePosAndEmp);
  });
  hidePosAndEmp();

  let NewPerson;
  let NewOccupation;
  let defaultAppointment;
  template.on('click', '#radioBlock input[type="radio"]', function () {
    defaultAppointment = $(this).attr('value');
  });
  template.on('special-validate', function (e, validStates) {
    setTimeout(function () {
      if ($('div.validating-block:not(.hide) .has-error', template).length == 0) {
        $('.action#save', template).removeAttr('disabled');
      } else {
        $('.action#save', template).attr('disabled', 'disabled');
      }
    }, 500);
  });

  function toogleButtons (currentBtn) {
    currentBtn.siblings().removeClass('btn-primary').addClass('btn-default');
    currentBtn.removeClass('btn-default').addClass('btn-primary');
    template.trigger('special-validate');
  }

  $('#createPersonBtn', template).click(function () {
    const self = $(this);
    if (self.hasClass('btn-primary')) return false;
    toogleButtons(self);
    $('#radioBlock').addClass('hide');
    defaultAppointment = undefined;
    $('#select-Person').addClass('hide');
    if (NewPerson) {
      $('#fill-Person').removeClass('hide');
    } else {
      NewPerson = new IndividualModel();
      NewPerson['rdf:type'] = [new IndividualModel('v-s:Person')];
      NewPerson['v-s:parentOrganization'] = individual['v-s:parentOrganization'];
      NewPerson.present($('<div>'), 'v-s:PersonEmbeddedTemplate', 'edit').then(function (tmpl) {
        tmpl = $(tmpl);
        tmpl.on('validate', function () {
          template.trigger('special-validate');
        });
        $('#fill-Person').append(tmpl);
      });
    }
    individual['v-s:employee'] = [NewPerson];
  });

  $('#selectPersonBtn').click(function () {
    const self = $(this);
    if (self.hasClass('btn-primary')) {
      return false;
    }
    toogleButtons(self);
    defaultAppointment = undefined;
    $('#select-Person').removeClass('hide');
    $('#fill-Person').addClass('hide');
    individual['v-s:employee'] = [];
    // individual.on('v-s:employee', setDefaultAppointment);
  });

  $('#createOccupationBtn', template).click(function () {
    const self = $(this);
    if (self.hasClass('btn-primary')) {
      return true;
    }
    toogleButtons(self);
    // individual.off('v-s:employee', setDefaultAppointment);
    $('#select-Occupation').addClass('hide');
    if (NewOccupation) {
      $('#fill-Occupation').removeClass('hide');
    } else {
      NewOccupation = new IndividualModel();
      NewOccupation['rdf:type'] = [new IndividualModel('v-s:Position')];
      NewOccupation['v-s:parentOrganization'] = individual['v-s:parentOrganization'];
      NewOccupation['v-s:parentUnit'] = individual['v-s:parentUnit'];
      NewOccupation['v-s:origin'] = individual['v-s:origin'];
      NewOccupation.present($('<div>'), 'v-s:PositionEmbeddedTemplate', 'edit').then(function (tmpl) {
        tmpl = $(tmpl);
        tmpl.on('validate', function () {
          template.trigger('special-validate');
        });
        $('#fill-Occupation').append(tmpl);
      });
    }
    individual['v-s:occupation'] = [NewOccupation];
  });

  $('#selectOccupationBtn').click(function () {
    const self = $(this);
    if (self.hasClass('btn-primary')) {
      return true;
    }
    toogleButtons(self);
    $('#select-Occupation').removeClass('hide');
    $('#fill-Occupation').addClass('hide');
    individual['v-s:occupation'] = [];
  });
  function setDefaultAppointment () {
    const radioCont = $('.radio', template).empty();
    if (individual.hasValue('v-s:employee')) {
      const employeeId = individual['v-s:employee'][0].id;
      const queryString =
        "'rdf:type'==='v-s:Appointment' && 'v-s:employee'=='" +
        employeeId +
        "' && 'v-s:parentOrganization'=='" +
        individual['v-s:parentOrganization'][0].id +
        "' && '@'!='" +
        individual.id +
        "'";
      Backend.query({ticket: veda.ticket, query: queryString}).then(function (queryResult) {
        const appointmentsUris = queryResult.result;
        if (appointmentsUris.length > 0) {
          Backend.get_individuals(veda.ticket, appointmentsUris).then(function (appointmentsJSONs) {
            appointmentsJSONs.forEach(function (appointmentJSON) {
              const label = $('<label></label>');
              const radio = $('<input type="radio" name="defaultAppointment"/>').attr('value', appointmentJSON['@']);
              label.append(radio);
              label.append(new IndividualModel(appointmentJSON)['rdfs:label'][0]);
              radioCont.append($('<div class="radio"></div>').append(label));
            });
            const newAppointLabel = individual['v-s:employee'][0]['rdfs:label'][0];
            radioCont.append(
              '<div class="radio"><label><input type="radio" checked name="defaultAppointment"/>Текущее для ' + newAppointLabel + '</label></div>',
            );
            $('#radioBlock').removeClass('hide');
            return;
          });
        }
      });
    }
    $('#radioBlock').addClass('hide');
  }
  setDefaultAppointment();
  individual.on('v-s:employee', setDefaultAppointment);
  template.one('remove', function () {
    individual.off('v-s:employee', setDefaultAppointment);
  });

  $('.actions #save').off('click');
  $('.actions #save').on('click', function () {
    const tempEmployee = individual['v-s:employee'][0];
    const tempOccupation = individual['v-s:occupation'][0];
    const tempCommunicationMean = individual['v-s:employee'][0]['v-s:hasCommunicationMean'];
    const tempAccount = individual['v-s:employee'][0]['v-s:hasAccount'][0];

    // новый id персоны
    individual
      .getPropertyChain('v-s:employee')
      .then(function (emp) {
        return emp[0].load();
      })
      .then(function (emp) {
        let promises = [];
        if (tempCommunicationMean && emp.isNew()) {
          promises = promises.concat(tempCommunicationMean.map(function (CommunicationMean) {
            // Средства связи
            CommunicationMean['v-s:parent'] = [emp.id];
            return CommunicationMean.save();
          }));
        }
        if (tempAccount && emp.isNew()) {
          // Аккаунт
          tempAccount['v-s:owner'] = [emp];
          tempAccount['v-s:parent'] = [emp];
          tempAccount.id = emp.id + '_account';
          tempAccount['v-s:origin'] = individual['v-s:origin'];
          promises.push(tempAccount.save());
        }
        return Promise.all(promises);
      })
      .then(function () {
        // Должность
        if (tempOccupation.isNew()) {
          tempOccupation['v-s:parentUnit'] = individual['v-s:parentUnit'];
          tempOccupation['v-s:parentOrganization'] = individual['v-s:parentOrganization'];
          tempOccupation['v-s:origin'] = individual['v-s:origin'];
          return tempOccupation.save();
        } else return undefined;
      })
      .then(function (savedOccupation) {
        // Персона
        if (tempEmployee.isNew()) {
          tempEmployee['v-s:parentOrganization'] = individual['v-s:parentOrganization'];
          tempEmployee['v-s:owner'] = [tempEmployee];
          tempEmployee['v-s:origin'] = individual['v-s:origin'];
          tempEmployee['v-s:hasAccount'] = [tempAccount];
          if (tempAccount) tempEmployee['v-s:hasAccount'] = [tempAccount];
        }

        if (savedOccupation) {
          individual['v-s:occupation'] = [savedOccupation];
        }
        if (defaultAppointment) {
          tempEmployee['v-s:defaultAppointment'] = [new IndividualModel(defaultAppointment)];
        } else {
          tempEmployee['v-s:defaultAppointment'] = [individual];
        }
        tempEmployee['v-s:hasAppointment'] = tempEmployee['v-s:hasAppointment'].concat(individual);
        return tempEmployee.save();
      })
      .then(function (savedEmployee) {
        // Назначение
        if (savedEmployee) {
          individual['v-s:employee'] = [tempEmployee];
        }
        individual.save();
      });
    return true;
  });
};

export const html = `
<div class="container sheet">
  <h2>
    <span about="v-s:Appointment" property="rdfs:label"></span>
    <small about="@" property="rdfs:label"></small>
  </h2>
  <hr>
  <div id="mainProperties">
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:Organization" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div about="@" rel="v-s:parentOrganization" class="view -edit -search" data-template="v-ui:LabelLinkTemplate"></div>
        <veda-control rel="v-s:parentOrganization" data-query-prefix="'rdf:type'=='v-s:Organization'" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:Subsidiary" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div about="@" rel="v-s:parentSubsidiary" class="view -edit -search" data-template="v-ui:LabelLinkTemplate"></div>
        <veda-control rel="v-s:parentSubsidiary" data-query-prefix="(('rdf:type'==='v-s:Subsidiary') && 'v-s:parentOrganization'=='{@.v-s:parentOrganization.id}') || '@'=='{@.v-s:parentOrganization.id}'" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:Department" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div about="@" rel="v-s:parentUnit" class="view -edit -search" data-template="v-ui:LabelLinkTemplate"></div>
        <veda-control rel="v-s:parentUnit" data-query-prefix="('rdf:type'=='v-s:Department' && 'v-s:parentOrganization'=='{@.v-s:parentOrganization.id}') || '@'=='{@.v-s:parentOrganization.id}'" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
      </div>
    </div>
    <section id="Employee" class="hide">
      <h4 class="section-header -view edit search">
        <span about="v-s:employee" property="rdfs:label"></span>
        <div class="btn-group -view edit -search">
          <button id="selectPersonBtn" class="btn btn-sm btn-primary navbar-btn">Выбрать</button>
          <button id="createPersonBtn" class="btn btn-sm btn-default navbar-btn">Создать</button>
        </div>
      </h4>
      <div class="section-content">
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:employee" property="rdfs:label" class="view -edit -search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
             <div id="select-Person" class="validating-block">
              <div about="@" rel="v-s:employee" class="view -edit -search" data-template="v-ui:LabelLinkTemplate"></div>
              <veda-control data-type="link" rel="v-s:employee" class="fulltext dropdown margin-sm -view edit -search" data-query-prefix="'rdf:type'=='v-s:Person' && 'v-s:parentOrganization'=='{@.v-s:parentOrganization.id}'"></veda-control>
            </div>
          </div>
        </div>
        <div id="fill-Person" class="validating-block"></div>
      </div>
    </section>
    <section id="Position" class="hide">
      <h4 class="section-header -view edit search">
        <span about="v-s:Position" property="rdfs:label"></span>
        <div class="btn-group -view edit -search">
          <button id="selectOccupationBtn" class="btn btn-sm btn-primary navbar-btn">Выбрать</button>
          <button id="createOccupationBtn" class="btn btn-sm btn-default navbar-btn">Создать</button>
        </div>
      </h4>
      <div class="section-content">
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:Position" property="rdfs:label" class="view -edit -search"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div id="select-Occupation" class="validating-block">
              <div about="@" rel="v-s:occupation" class="view -edit -search" data-template="v-ui:LabelLinkTemplate"></div>
              <veda-control data-type="link" rel="v-s:occupation" class="fulltext dropdown margin-sm -view edit -search" data-query-prefix="'rdf:type'=='v-s:Position' && 'v-s:parentUnit'=='{@.v-s:parentUnit.id}'"></veda-control>
            </div>
          </div>
        </div>
        <div id="fill-Occupation" class="validating-block"></div>
      </div>
    </section>
    <hr class="-view edit -search">
    <div id="radioBlock">
      <div class="row row-attribute  -view edit -search">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:DefaultAppointmentBundle" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
           <div class="radio">
          </div>
        </div>
      </div>
    </div>
    <section id="ForAdmin" class="notEditForUsers">
      <h4 class="section-header -view edit search">
        <span about="cfg:Administrator" property="rdfs:label"></span>
      </h4>
      <div class="row row-attribute">
        <div class="col-sm-3 col-xs-5">
          <label about="v-s:date" property="rdfs:label"></label>
        </div>
        <div class="col-sm-9 col-xs-7">
          <div class="form-inline">
            <div class="form-group">
              <span property="v-s:dateFrom" class="view -edit search"></span>
              <veda-control property="v-s:dateFrom" data-type="date" class="-view edit search"></veda-control>
            </div>
            <span class="view -edit -search">&mdash;&nbsp;&nbsp;&nbsp;</span>
            <div class="form-group">
              <span property="v-s:dateTo" class="view -edit search"></span>
              <veda-control property="v-s:dateTo" data-type="date" class="-view edit search"></veda-control>
            </div>
          </div>
        </div>
      </div>
      <div class="section-content">
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:origin" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div property="v-s:origin" class="view -edit search"></div>
            <veda-control property="v-s:origin" data-type="string" class="-view edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
          </div>
          <div class="col-sm-9 col-xs-7">
            <div class="checkbox no-margin">
              <label>
                <veda-control property="v-s:official" data-type="boolean"></veda-control>
                <span about="v-s:official" property="rdfs:label"></span>
              </label>
            </div>
          </div>
        </div>
        <hr>
    </section>

    <!--Системные свойства -->
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br>
    <!-- BUTTONS -->
    <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
    </div>
  </div>
</div>
`;
