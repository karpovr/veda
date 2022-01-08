import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  return Backend.query({
    ticket: veda.ticket,
    query: "'rdf:type'==='v-s:Appointment' && 'v-s:official'==true && 'v-s:employee'==='" + individual.id + "'",
  }).then(function (result) {
    var apps = result.result;
    if (apps.length > 1) {
      template.on('click', function (e) {
        e.preventDefault();
        $('.switch-appointment').modal('show');
      });
    } else {
      template.remove();
      container.remove();
    }
  });
};

export const html = `
  <a href="#" about="@">
    <span href="#" about="@" rel="v-s:defaultAppointment">
      <span href="#" about="@" rel="v-s:occupation">
        <span class="no-margin" style="width:150px; text-overflow: ellipsis; white-space: nowrap;"> <span property="rdfs:label"></span> &udarr; </span>
      </span>
    </span>
  </a>
`;
