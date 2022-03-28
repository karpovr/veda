import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#submit-login', template).click(submitLogin);
  $('#login', template).keydown(function (e) {
    if (e.which === 13) {
      submitLogin(e);
    }
  });
  function submitLogin (e) {
    e.preventDefault();
    const useLogin = $('#login', template).val();
    Backend.get_ticket_trusted(veda.ticket, useLogin).then(function (authResult) {
      veda.end_time = localStorage.end_time = authResult.end_time;
      veda.ticket = localStorage.ticket = authResult.ticket;
      veda.user_uri = localStorage.user_uri = authResult.user_uri;
      location.assign(location.origin);
    });
  }
};

export const html = `
  <div>
    <div property="v-s:holiday"></div>
    <veda-control class="-view edit -search" data-type="date" property="v-s:holiday"></veda-control>
    <br>
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="send save edit cancel delete journal task"></span>
    </div>
  </div>
`;
