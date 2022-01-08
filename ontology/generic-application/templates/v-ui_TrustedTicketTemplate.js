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
  function submitLogin(e) {
    e.preventDefault();
    var useLogin = $('#login', template).val();
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
    <h4>Логин для входа</h4>
    <input class="form-control input-lg" id="login" placeholder="login" type="text" name="login" autofocus="autofocus" />
    <br />
    <button id="submit-login" class="btn btn-lg btn-primary btn-block">Войти</button>
  </div>
`;
