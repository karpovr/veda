// Authentication

import veda from '../common/veda.js';

import Backend from '../common/backend.js';

import IndividualModel from '../common/individual_model.js';

import Sha256 from '../common/lib/sha256.js';

import {delegateHandler, clear} from '../browser/dom_helpers.js';

/**
 * Authenticat user using ntlm provider
 * @param {String} path
 * @param {String} login
 * @param {String} password
 * @return {Promise<Object>}
 */
function ntlmAuth (path, login, password) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(login && password ? 'POST' : 'GET', path, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    xhr.responseType = 'json';
    xhr.onload = function () {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(Error('NTLM auth failed'));
      }
    };
    xhr.onerror = reject;
    xhr.onabort = reject;
    login && password ? xhr.send(`username=${encodeURIComponent(login)}&password=${encodeURIComponent(password)}`) : xhr.send();
  });
}

const storage = window.localStorage;

// Login invitation
const loginForm = document.getElementById('login-form');

loginForm.querySelector('#submit-login-password').addEventListener('click', submitLoginPassword);

delegateHandler(loginForm, 'keyup', '#login, #password', function (e) {
  if (e.key === 'Enter') {
    submitLoginPassword(e);
  }
});

delegateHandler(loginForm, 'mousedown', '.show-password', function (e) {
  const passwords = loginForm.querySelectorAll('.password');
  passwords.forEach((input) => input.type = 'text');
  document.addEventListener('mouseup', function(){
    passwords.forEach((input) => input.type = 'password');
  }, {once:true});
});

/**
 * Submit credentials handler
 * @param {Event} event
 * @return {void}
 */
function submitLoginPassword (event) {
  event.preventDefault();
  const passwordInput = loginForm.querySelector('#password');
  const login = loginForm.querySelector('#login').value;
  const password = passwordInput.value;
  const hash = Sha256.hash(password);

  passwordInput.value = '';

  const ntlmProvider = new IndividualModel('cfg:NTLMAuthProvider', true, false);
  return ntlmProvider.load()
    .then((ntlmProvider) => {
      const path = !ntlmProvider.hasValue('v-s:deleted', true) && ntlmProvider.hasValue('rdf:value') && ntlmProvider.get('rdf:value')[0];
      if (path) {
        return ntlmAuth(path, login, password);
      } else {
        return Promise.reject(Error('AD provider is not defined'));
      }
    })
    .catch((error) => {
      console.log(error);
      return Backend.authenticate(login, hash);
    })
    .then(handleLoginSuccess)
    .catch(handleLoginError);
}

delegateHandler(loginForm, 'input', '#new-password, #confirm-new-password, #secret', validateNewPassword);

const re = new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{6,})');

/**
 * Validate new password
 * @param {Event} event
 * @return {void}
 */
function validateNewPassword () {
  const submit = loginForm.querySelector('#submit-new-password');
  const newPassword = loginForm.querySelector('#new-password');
  const confirmNewPassword = loginForm.querySelector('#confirm-new-password');
  const passwordStrength = loginForm.querySelector('.password-strength');
  const passwordMustMatch = loginForm.querySelector('.password-must-match');
  const secret = loginForm.querySelector('#secret');
  const enterSecret = loginForm.querySelector('.enter-secret');

  const reMatch = re.test( newPassword.value );
  const passwordsMatch = confirmNewPassword.value === newPassword.value;
  const isSecret = !!secret.value;
  const isValid = reMatch && passwordsMatch && isSecret;

  if ( !reMatch ) {
    passwordStrength.style.display = 'block';
  } else {
    passwordStrength.style.display = 'none';
  }
  if ( !passwordsMatch ) {
    passwordMustMatch.style.display = 'block';
  } else {
    passwordMustMatch.style.display = 'none';
  }
  if ( !isSecret ) {
    enterSecret.style.display = 'block';
  } else {
    enterSecret.style.display = 'none';
  }
  if ( !isValid ) {
    submit.setAttribute('disabled', 'disabled');
  } else {
    submit.removeAttribute('disabled');
  }
}

loginForm.querySelector('#submit-new-password').addEventListener('click', function (e) {
  e.preventDefault();
  const login = loginForm.querySelector('#login').value;
  const password = loginForm.querySelector('#new-password').value;
  const secret = loginForm.querySelector('#secret').value;
  const hash = Sha256.hash(password);

  Backend.authenticate(login, hash, secret)
    .then(handleLoginSuccess)
    .catch(handleLoginError)
    .then(() => {
      loginForm.querySelector('#new-password').value = '';
      loginForm.querySelector('#confirm-new-password').value = '';
    });
});

let changePasswordPressed;
loginForm.querySelector('#change-password').addEventListener('click', function (e) {
  e.preventDefault();
  changePasswordPressed = true;
  const login = loginForm.querySelector('#login').value;
  const secret = '?';

  Backend.authenticate(login, undefined, secret)
    .then(handleLoginSuccess)
    .catch(handleLoginError);
});

// CAPTCHA already rendered flag
let captchaRendered = false;

/**
 * Initialize CAPTCHA
 * @param {Function} onSuccess
 * @param {Function} onExpired
 * @param {Function} onError
 * @return {void}
 */
function reCAPTCHA (onSuccess, onExpired, onError) {
  if (!captchaRendered) {
    const reCAPTCHA_key = new IndividualModel('cfg:reCAPTCHA_client_key');
    reCAPTCHA_key.load().then((reCAPTCHA_key) => {
      window.captchaCallback = function () {
        grecaptcha.render('recaptcha', {
          'sitekey': reCAPTCHA_key.get('rdf:value')[0].toString(),
          'theme': 'light',
          'callback': onSuccess,
          'expired-callback': onExpired,
          'error-callback': onError,
        });
        captchaRendered = true;
      };
      const captchaScript = document.createElement('script');
      captchaScript.src = 'https://www.google.com/recaptcha/api.js?onload=captchaCallback&render=explicit';
      document.head.appendChild(captchaScript);
    });
  } else {
    grecaptcha.reset();
  }
}

/**
 * Login error handler
 * @param {Error} error
 * @return {void}
 */
function handleLoginError (error) {
  const enterLoginPassword = loginForm.querySelector('#enter-login-password');
  enterLoginPassword.style.display = 'none';
  const enterNewPassword = loginForm.querySelector('#enter-new-password');
  enterNewPassword.style.display = 'none';

  const invalidSecretWarning = loginForm.querySelector('#invalid-secret-warning');
  const emptyPasswordWarning = loginForm.querySelector('#empty-password-warning');
  const equalPasswordWarning = loginForm.querySelector('#equal-password-warning');
  const invalidPasswordWarning = loginForm.querySelector('#invalid-password-warning');
  const frequentPassChangeWarning = loginForm.querySelector('#frequent-pass-change-warning');
  const passChangeNotAllowedWarning = loginForm.querySelector('#pass-change-not-allowed-warning');
  const secretExpiredWarning = loginForm.querySelector('#secret-expired-warning');

  const passwordExpiredError = loginForm.querySelector('#password-expired-error');
  const loginFailedError = loginForm.querySelector('#login-failed-error');
  const authLockedError = loginForm.querySelector('#auth-locked-error');
  const passChangeLockedError = loginForm.querySelector('#pass-change-locked-error');
  const unavailableError = loginForm.querySelector('#unavailable-error');
  const networkError = loginForm.querySelector('#network-error');

  const secretRequestInfo = loginForm.querySelector('#secret-request-info');

  const alerts = loginForm.querySelectorAll('.alert');
  Array.prototype.forEach.call(alerts, (alert) => alert.style.display = 'none');

  const inputs = loginForm.querySelectorAll('input:not(#login)');
  Array.prototype.forEach.call(inputs, (input) => input.value = '');

  const ok = loginForm.querySelector('.btn.ok');
  ok.style.display = 'none';
  let okHandler = () => {};

  const onSuccess = function () {
    Array.prototype.forEach.call(loginForm.querySelectorAll('.alert, fieldset'), (item) => item.style.display = 'none');
    enterLoginPassword.style.display = 'block';
  };
  const onExpired = function () {
    Array.prototype.forEach.call(loginForm.querySelectorAll('.alert, fieldset'), (item) => item.style.display = 'none');
    loginFailedError.style.display = 'block';
  };

  switch (error.code) {
  case 0: // Network error
    networkError.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      networkError.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 423: // Password change is allowed once a day
    frequentPassChangeWarning.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      frequentPassChangeWarning.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 429: // Too many auth fails
    authLockedError.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      authLockedError.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 430: // Too many pass change fails
    passChangeLockedError.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      passChangeLockedError.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 463: // Password change not allowed
    passChangeNotAllowedWarning.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      passChangeNotAllowedWarning.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 464: // Secret expired
    secretExpiredWarning.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      secretExpiredWarning.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 465: // Empty password
    emptyPasswordWarning.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      emptyPasswordWarning.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 466: // New password is equal to old
    equalPasswordWarning.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      equalPasswordWarning.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 467: // Invalid password
    invalidPasswordWarning.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      invalidPasswordWarning.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 468: // Invalid secret
    invalidSecretWarning.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      invalidSecretWarning.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  case 469: // Password expired
    if ( !changePasswordPressed ) {
      passwordExpiredError.style.display = 'block';
      secretRequestInfo.style.display = 'block';
      ok.style.display = 'block';
      okHandler = function () {
        passwordExpiredError.style.display = 'none';
        enterNewPassword.style.display = 'block';
        ok.removeEventListener('click', okHandler);
        ok.style.display = 'none';
      };
    } else {
      enterNewPassword.style.display = 'block';
      secretRequestInfo.style.display = 'block';
    }
    break;
  case 472: // Not authorized
  case 473: // Authentication failed
    loginFailedError.style.display = 'block';
    enterLoginPassword.style.display = 'none';
    reCAPTCHA(onSuccess, undefined, onSuccess);
    break;
  default:
    unavailableError.style.display = 'block';
    ok.style.display = 'block';
    okHandler = function () {
      unavailableError.style.display = 'none';
      enterLoginPassword.style.display = 'block';
      ok.removeEventListener('click', okHandler);
      ok.style.display = 'none';
    };
    break;
  }
  ok.addEventListener('click', okHandler);
}

/**
 * Login success handler
 * @param {Object} authResult
 * @return {void}
 */
function handleLoginSuccess (authResult) {
  const enterLoginPassword = loginForm.querySelector('#enter-login-password');

  const alerts = loginForm.querySelectorAll('.alert');
  Array.prototype.forEach.call(alerts, (alert) => alert.style.display = 'none');

  const inputs = loginForm.querySelectorAll('input:not(#login)');
  Array.prototype.forEach.call(inputs, (input) => input.value = '');

  const ok = loginForm.querySelector('.btn.ok');
  ok.style.display = 'none';

  enterLoginPassword.style.display = 'block';

  veda.trigger('login:success', authResult);
}

/**
 * Set ticket cookie
 * @param {string} ticket
 * @param {number} expires
 * @return {void}
 */
function setTicketCookie (ticket, expires) {
  const cookie = 'ticket=' + ticket + '; expires=' + new Date(parseInt(expires)).toGMTString() + '; samesite=strict; path=/;' + (window.location.protocol === 'https:' ? 'secure;' : '');
  document.cookie = cookie;
}

/**
 * Delete ticket cookie
 * @return {void}
 */
function delTicketCookie () {
  setTicketCookie(null, 0);
}

veda.on('login:failed', function () {
  const appContainer = document.getElementById('app');
  clear(appContainer);

  delete storage.ticket;
  delete storage.user_uri;
  delete storage.end_time;
  delTicketCookie();

  if (storage.logout) {
    loginForm.style.display = 'block';
    delete storage.logout;
    return;
  }

  // Auto login using NTLM
  const ntlmProvider = new IndividualModel('cfg:NTLMAuthProvider', true, false);
  ntlmProvider.load().then((ntlmProvider) => {
    const path = !ntlmProvider.hasValue('v-s:deleted', true) && ntlmProvider.hasValue('rdf:value') && ntlmProvider.get('rdf:value')[0];
    if (path) {
      ntlmAuth(path)
        .then((authResult) => veda.trigger('login:success', authResult))
        .catch((err) => {
          console.log(err);
          loginForm.style.display = 'block';
        });
    } else {
      loginForm.style.display = 'block';
    }
  });
});

// Initialize application if ticket is valid
veda.on('login:success', function (authResult) {
  loginForm.style.display = 'none';
  veda.user_uri = storage.user_uri = authResult.user_uri;
  veda.ticket = storage.ticket = authResult.ticket;
  veda.end_time = storage.end_time = authResult.end_time;
  setTicketCookie(veda.ticket, veda.end_time);
  // Re-login on ticket expiration
  if ( veda.end_time ) {
    const ticketDelay = parseInt(veda.end_time) - Date.now();
    const ticketDelayHours = Math.floor(ticketDelay / 1000 / 60 / 60);
    const ticketDelayMinutes = Math.floor(ticketDelay / 1000 / 60 - ticketDelayHours * 60);
    console.log('Ticket will expire in %d hrs. %d mins.', ticketDelayHours, ticketDelayMinutes);
    const refreshInterval = setInterval(() => {
      if (Date.now() - lastActivity > ticketDelay * 0.9) {
        clearInterval(refreshInterval);
        console.log('Ticket expired, re-login.');
        veda.trigger('login:failed');
      } else {
        console.log('Refresh ticket in background.');
        Backend.get_ticket_trusted(veda.ticket).then((authResult) => {
          veda.user_uri = storage.user_uri = authResult.user_uri;
          veda.ticket = storage.ticket = authResult.ticket;
          veda.end_time = storage.end_time = authResult.end_time;
          setTicketCookie(veda.ticket, veda.end_time);
        });
      }
    }, ticketDelay * 0.9);
  }

  const loadIndicator = document.getElementById('load-indicator');
  const loadIndicatorTimer = setTimeout(() => loadIndicator.style.display = '', 250);

  veda.init(veda.user_uri).then(() => {
    clearTimeout(loadIndicatorTimer);
    loadIndicator.style.display = 'none';
    veda.trigger('started');
  });
});

// Activity handler
let lastActivity = Date.now();
const activityHandler = () => {
  lastActivity = Date.now();
};
document.body.addEventListener('keyup', activityHandler);
document.body.addEventListener('click', activityHandler);

// Logout handler
delegateHandler(document.body, 'click', '#logout, .logout', function () {
  delete storage.ticket;
  delete storage.user_uri;
  delete storage.end_time;
  delTicketCookie();
  storage.logout = true;
  window.location.reload();
});

/**
 * Authentication flow
 */
export default function Auth () {
  // Init application
  const loadIndicator = document.getElementById('load-indicator');
  const loadIndicatorTimer = setTimeout(() => loadIndicator.style.display = '', 250);

  veda.init('cfg:Guest')
    .then(() => {
      // Check if ticket is valid
      const ticket = storage.ticket;
      const user_uri = storage.user_uri;
      const end_time = ( new Date() < new Date(parseInt(storage.end_time)) ) && storage.end_time;
      if (ticket && user_uri && end_time) {
        return Backend.is_ticket_valid(ticket);
      } else {
        return false;
      }
    })
    .then((valid) => {
      if (valid) {
        veda.trigger('login:success', {
          ticket: storage.ticket,
          user_uri: storage.user_uri,
          end_time: storage.end_time,
        });
      } else {
        const authRequired = new IndividualModel('cfg:AuthRequired');
        authRequired.load().then((authRequiredParam) => {
          if ( authRequiredParam && authRequiredParam.hasValue('rdf:value', false) ) {
            veda.trigger('login:success', {
              ticket: '',
              user_uri: 'cfg:Guest',
              end_time: 0,
            });
          } else {
            veda.trigger('login:failed');
          }
        });
      }
    })
    .then(() => {
      clearTimeout(loadIndicatorTimer);
      loadIndicator.style.display = 'none';
    });
}
