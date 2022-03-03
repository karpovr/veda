import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  return Backend.query(veda.ticket, "'rdf:type'==='v-s:Appointment' && 'v-s:occupation'=='" + individual.id + "'")
    .then(function (queryResult) {
      const promises = queryResult.result.map(function (uri) {
        return new IndividualModel(uri).load();
      });
      return Promise.all(promises);
    })
    .then(function (appointments) {
      const personsPromises = appointments.map(function (appointment) {
        if (appointment.hasValue("v-s:hasDelegationPurpose", "d:delegate_Control")) return false;
        return appointment['v-s:employee'].length > 0 ? appointment['v-s:employee'][0].load() : Promise.resolve(false);
      });
      return Promise.all(personsPromises).then(function (persons) {
        const mBody = $('div.media-body', template);
        mBody.append('<hr class="no-margin">');
        appointments.forEach(function (appointment, i) {
          if (persons[i] && !persons[i].hasValue('v-s:deleted', true)) {
            mBody.append('<small>' + persons[i]['rdfs:label'][0] + '</small><br>');
          }
        });
        return true;
      });
    });
};

export const html = `
  <div class="media" style="margin-top:0px;">
    <span class="close">&nbsp;&times;</span>
    <div class="media-body" style="width:auto">
      <strong class="media-heading" about="@" property="rdfs:label"></strong>
      <hr class="no-margin" />
      <small about="@" rel="v-s:parentUnit" data-template="v-ui:LabelTemplate"></small>
    </div>
  </div>
`;
