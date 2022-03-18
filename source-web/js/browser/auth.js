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
  document.addEventListener('mouseup', function () {
    passwords.forEach((input) => input.type = 'password');
  }, {once: true});
});

delegateHandler(loginForm, 'touchstart', '.show-password', function (e) {
  const passwords = loginForm.querySelectorAll('.password');
  passwords.forEach((input) => input.type = 'text');
  document.addEventListener('touchend', function () {
    passwords.forEach((input) => input.type = 'password');
  }, {once: true});
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
    .then(() => {
      const path = !ntlmProvider.hasValue('v-s:deleted', true) && ntlmProvider.hasValue('rdf:value') && ntlmProvider.get('rdf:value')[0];
      if (path) {
        return ntlmAuth(path, login, password);
      } else {
        return Promise.reject(Error('NTLM auth provider provider is not defined'));
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

const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.{6,})/;

/**
 * Show element
 * @param {HTMLElement} el
 * @return {void}
 */
function show (el) {
  el.style.display = 'block';
}

/**
 * Hide element
 * @param {HTMLElement} el
 * @return {void}
 */
function hide (el) {
  el.style.display = 'none';
}

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
    show(passwordStrength);
  } else {
    hide(passwordStrength);
  }
  if ( !passwordsMatch ) {
    show(passwordMustMatch);
  } else {
    hide(passwordMustMatch);
  }
  if ( !isSecret ) {
    show(enterSecret);
  } else {
    hide(enterSecret);
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
    reCAPTCHA_key.load().then(() => {
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
  hide(enterLoginPassword);
  const enterNewPassword = loginForm.querySelector('#enter-new-password');
  hide(enterNewPassword);

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
  Array.prototype.forEach.call(alerts, (alert) => hide(alert));

  const inputs = loginForm.querySelectorAll('input:not(#login)');
  Array.prototype.forEach.call(inputs, (input) => input.value = '');

  const ok = loginForm.querySelector('.btn.ok');
  hide(ok);
  let okHandler = () => true;

  const onSuccess = function () {
    Array.prototype.forEach.call(loginForm.querySelectorAll('.alert, .fieldset'), (item) => hide(item));
    show(enterLoginPassword);
  };

  switch (error.code) {
  case 0: // Network error
    show(networkError);
    show(ok);
    okHandler = function () {
      hide(networkError);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 423: // Password change is allowed once a day
    show(frequentPassChangeWarning);
    show(ok);
    okHandler = function () {
      hide(frequentPassChangeWarning);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 429: // Too many auth fails
    show(authLockedError);
    show(ok);
    okHandler = function () {
      hide(authLockedError);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 430: // Too many pass change fails
    show(passChangeLockedError);
    show(ok);
    okHandler = function () {
      hide(passChangeLockedError);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 463: // Password change not allowed
    show(passChangeNotAllowedWarning);
    show(ok);
    okHandler = function () {
      hide(passChangeNotAllowedWarning);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 464: // Secret expired
    show(secretExpiredWarning);
    show(ok);
    okHandler = function () {
      hide(secretExpiredWarning);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 465: // Empty password
    show(emptyPasswordWarning);
    show(ok);
    okHandler = function () {
      hide(emptyPasswordWarning);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 466: // New password is equal to old
    show(equalPasswordWarning);
    show(ok);
    okHandler = function () {
      hide(equalPasswordWarning);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 467: // Invalid password
    show(invalidPasswordWarning);
    show(ok);
    okHandler = function () {
      hide(invalidPasswordWarning);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 468: // Invalid secret
    show(invalidSecretWarning);
    show(ok);
    okHandler = function () {
      hide(invalidSecretWarning);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
    };
    break;
  case 469: // Password expired
    if ( !changePasswordPressed ) {
      show(passwordExpiredError);
      show(secretRequestInfo);
      show(ok);
      okHandler = function () {
        hide(passwordExpiredError);
        show(enterNewPassword);
        ok.removeEventListener('click', okHandler);
        hide(ok);
      };
    } else {
      show(enterNewPassword);
      show(secretRequestInfo);
    }
    break;
  case 472: // Not authorized
  case 473: // Authentication failed
    show(loginFailedError);
    hide(enterLoginPassword);
    reCAPTCHA(onSuccess, undefined, onSuccess);
    break;
  default:
    show(unavailableError);
    show(ok);
    okHandler = function () {
      hide(unavailableError);
      show(enterLoginPassword);
      ok.removeEventListener('click', okHandler);
      hide(ok);
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
  Array.prototype.forEach.call(alerts, (alert) => hide(alert));

  const inputs = loginForm.querySelectorAll('input:not(#login)');
  Array.prototype.forEach.call(inputs, (input) => input.value = '');

  const ok = loginForm.querySelector('.btn.ok');
  hide(ok);

  show(enterLoginPassword);

  handleAuthSuccess(authResult);
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

function handleAuthError () {
  const appContainer = document.getElementById('app');
  clear(appContainer);

  delete storage.ticket;
  delete storage.user_uri;
  delete storage.end_time;
  delTicketCookie();

  if (storage.logout) {
    show(loginForm);
    delete storage.logout;
    return;
  }

  // Auto login using NTLM
  const ntlmProvider = new IndividualModel('cfg:NTLMAuthProvider', true, false);
  ntlmProvider.load().then(() => {
    const path = !ntlmProvider.hasValue('v-s:deleted', true) && ntlmProvider.hasValue('rdf:value') && ntlmProvider.get('rdf:value')[0];
    if (path) {
      ntlmAuth(path)
        .then((authResult) => handleAuthSuccess(authResult))
        .catch((err) => {
          console.log(err);
          show(loginForm);
        });
    } else {
      show(loginForm);
    }
  }).catch((error) => {
    console.log(err);
    show(loginForm);
  });
}

// Initialize application if ticket is valid
function handleAuthSuccess (authResult) {
  hide(loginForm);
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
        handleAuthError();
      } else {
        console.log('Refresh ticket in background.');
        Backend.get_ticket_trusted(veda.ticket).then((result) => {
          veda.user_uri = storage.user_uri = result.user_uri;
          veda.ticket = storage.ticket = result.ticket;
          veda.end_time = storage.end_time = result.end_time;
          setTicketCookie(veda.ticket, veda.end_time);
        });
      }
    }, ticketDelay * 0.9);
  }

  const loadIndicator = document.getElementById('load-indicator');
  const loadIndicatorTimer = setTimeout(() => loadIndicator.style.display = '', 250);

  veda.init(veda.user_uri).then(() => {
    clearTimeout(loadIndicatorTimer);
    hide(loadIndicator);
    veda.trigger('started');
  });
}

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

  Promise.resolve()
    .then(() => {
      // Check if ticket is valid
      const ticket = storage.ticket;
      const user_uri = storage.user_uri;
      const end_time = ( new Date() < new Date(parseInt(storage.end_time)) ) && storage.end_time;
      if (ticket && user_uri && end_time) {
        return Backend.is_ticket_valid(ticket).catch(() => false);
      } else {
        return false;
      }
    })
    .then((valid) => {
      if (valid) {
        handleAuthSuccess({
          ticket: storage.ticket,
          user_uri: storage.user_uri,
          end_time: storage.end_time,
        });
      } else {
        const authRequired = new IndividualModel('cfg:AuthRequired', true, false);
        authRequired.load().then((authRequiredParam) => {
          if ( authRequiredParam && authRequiredParam.hasValue('rdf:value', false) ) {
            handleAuthSuccess({
              ticket: '',
              user_uri: 'cfg:Guest',
              end_time: 0,
            });
          } else {
            handleAuthError();
          }
        }).catch((error) => {
          console.log('cfg:AuthRequired load error', error);
          handleAuthError();
        });
      }
    })
    .then(() => {
      clearTimeout(loadIndicatorTimer);
      hide(loadIndicator);
    });
}
