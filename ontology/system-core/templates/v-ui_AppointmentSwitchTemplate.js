import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  return Backend.query({
    ticket: veda.ticket,
    query: "'rdf:type'==='v-s:Appointment' && 'v-s:official'==true && 'v-s:employee'==='" + individual.id + "'",
  }).then(function (result) {
    const apps = result.result;
    if (apps.length > 1) {
      return Promise.all(
        apps.map(function (id) {
          const app = new IndividualModel(id);
          const checked = id === veda.appointment.id;
          return app.getPropertyChain('v-s:occupation', 'rdfs:label').then(function (label) {
            label = label.map(CommonUtil.formatValue).join(' ');
            return `<div class="radio">
                    <label>
                      <input type="radio" name="appointments" value="${id}" ${checked ? 'checked' : ''}>
                      ${label}
                    </label>
                  </div>`;
          });
        }),
      ).then(function (radios) {
        const form = $('#appointments-form', template);
        form.append(radios);
        form.on('change', function () {
          const selected = $("input[name='appointments']:checked").val();
          individual['v-s:defaultAppointment'] = new IndividualModel(selected);
        });
        setTimeout(function () {
          template.modal();
        }, 500);
      });
    } else {
      template.remove();
      container.remove();
    }
  });
};

export const html = `
  <div class="modal switch-appointment" tabindex="-1" role="dialog">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title" about="v-ui:AppointmentSwitchInfo" property="rdfs:label"></h4>
        </div>
        <div class="modal-body">
          <form id="appointments-form"></form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary pull-left" data-dismiss="modal">Ok</button>
        </div>
      </div>
    </div>
  </div>
`;
