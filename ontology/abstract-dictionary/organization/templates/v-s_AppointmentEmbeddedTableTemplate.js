import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const canUpdateAppointment = individual.canUpdate();
  Promise.all([canUpdateAppointment]).then(function (results) {
    if (!results[0]) {
      $('#deleteAppointment', template).remove();
      $('#moveToAnotherDepartment', template).attr('disabled', 'disabled');
    }
  });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // нельзя удалить назначение по умолчанию
  individual.getPropertyChain('v-s:employee', 'v-s:defaultAppointment').then(function (defaultAppointment) {
    if (individual == defaultAppointment[0]) $('#deleteAppointment', template).attr('disabled', 'disabled');
  });

  $('#deleteAppointment', template).click(function () {
    individual['rdf:type'] = individual['rdf:type'].concat('v-s:Deletable');
    individual['v-s:deleted'] = [true];
    individual.save();
  });

  $('#moveToAnotherDepartment', template).click(function () {
    const current_occupation = individual['v-s:occupation'][0].id;
    const Occupation = new IndividualModel(current_occupation);
    const tmpl = new IndividualModel('v-s:PositionMinimalTemplate');
    const modal = BrowserUtil.showModal(Occupation, tmpl, 'edit');
    Occupation.one('afterSave', function () {
      individual.save();
      modal.modal('hide').remove();
    });
  });
};

export const html = `
  <tr>
    <td about="@" data-template="v-ui:IconModalTemplate" class="view -edit -search"></td>
    <td>
      <div about="@" property="rdfs:label" class="view edit -search"></div>
    </td>
    <td>
      <div about="@" property="v-s:dateFrom" class="view -edit -search"></div>
      <veda-control property="v-s:dateFrom" data-type="date" class="-view edit search"></veda-control>
    </td>
    <td>
      <div about="@" property="v-s:dateTo" class="view -edit -search"></div>
      <veda-control property="v-s:dateTo" data-type="date" class="-view edit search"></veda-control>
    </td>
    <td class="view -edit -search">
      <button class="btn btn-xs btn-success" id="moveToAnotherDepartment">
        <span about="v-s:AnotherDepartmentBundle" property="rdfs:label"> </span>
      </button>
    </td>
    <td class="view -edit -search">
      <button class="btn btn-xs btn-danger" id="deleteAppointment">
        <span about="v-s:DeleteAppointmentBundle" property="rdfs:label"> </span>
      </button>
    </td>
  </tr>
`;
