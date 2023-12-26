/**
 * @module Authentication
 */

import veda from '../common/veda.js';
import Backend from '../common/backend.js';
import IndividualModel from '../common/individual_model.js';
import Sha256 from '../common/lib/sha256.js';
import {delegateHandler, clear} from '../browser/dom_helpers.js';
import Captcha from 'captcha';

/**
 * Authenticate user using NTLM provider
 * @param {string} path - The path to the NTLM provider
 * @param {string} login - The user's login
 * @param {string} password - The user's password
 * @return {Promise<Object>} - A promise that resolves to the authentication result
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
 * Handles the submit event for login form
 * @param {Event} event - The submit event
 * @return {void}
 */
function submitLoginPassword (event) {
  event.preventDefault();
  const passwordInput = loginForm.querySelector('#password');
  const login = loginForm.querySelector('#login').value.trim();
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
      console.error('NTLM auth failed');
      return Backend.authenticate({
        login,
        password: hash,
        href: `${window.location.origin}${window.location.pathname}${window.location.hash ? `?hash=${encodeURIComponent(window.location.hash)}` : ''}`,
      });
    })
    .then(handleLoginSuccess)
    .catch(handleLoginError);
}

delegateHandler(loginForm, 'input', '#new-password, #confirm-new-password, #secret', validateNewPassword);

const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.{8,})/;

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
  const login = loginForm.querySelector('#login').value.trim();
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

  // Captcha
  const myCaptcha = new Captcha({
    el: '#captcha-input',
    requiredValue: '',
    clearOnSubmit: true,
    resetOnError: true,
    focusOnError: true,
    canvasClass: 'captcha-canvas',
    canvasStyle: {
      width: 100,
      height: 15,
      textBaseline: 'top',
      font: '15px sans-serif',
      textAlign: 'left',
      fillStyle: '#000',
    },
    callback: function (response, $captchaInputElement, numberOfTries) {
      if (response === 'success') {
        Array.prototype.forEach.call(loginForm.querySelectorAll('.alert, .fieldset'), (item) => hide(item));
        show(enterLoginPassword);
      }
      if (response === 'error') {
        return;
      }
    },
  });
  function captchaSubmit (e) {
    myCaptcha.validate();
  };
  document.getElementById('captcha-submit').addEventListener('click', captchaSubmit);
  document.getElementById('captcha-input').addEventListener('change', captchaSubmit);

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
  case 303: // See Other
    error.response.text()
      .then((href) => window.location.href = href)
      .catch((error) => console.log('Redirect error:', error));
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
 * Handles login success
 * @param {Object} authResult - The authentication result
 * @return {void}
 */
function handleLoginSuccess (authResult) {
  const enterLoginPassword = loginForm.querySelector('#enter-login-password');

  const alerts = loginForm.querySelectorAll('.alert');
  alerts.forEach((alert) => hide(alert));

  const inputs = loginForm.querySelectorAll('input:not(#login)');
  inputs.forEach((input) => input.value = '');

  const ok = loginForm.querySelector('.btn.ok');
  hide(ok);

  show(enterLoginPassword);

  initWithCredentials(authResult);
}

function getCookie (name) {
  const cookies = new Map(document.cookie.split('; ').map((v)=>v.split(/=(.*)/s).map(decodeURIComponent)));
  return cookies.get(name);
}

function setCookie (name, value, expires) {
  document.cookie = `${name}=${value}; expires=${new Date(parseInt(expires)).toGMTString()}; samesite=strict; path=/; ${window.location.protocol === 'https:' ? 'secure;' : ''}`;
}

function delCookie (name) {
  setCookie(name, null, 0);
}

/**
 * Handles authentication errors
 * @return {void}
 */
function handleAuthError () {
  const appContainer = document.getElementById('app');
  clear(appContainer);

  storage.removeItem('ticket');
  storage.removeItem('user_uri');
  storage.removeItem('end_time');
  delCookie('ticket');

  if (storage.getItem('logout')) {
    show(loginForm);
    storage.removeItem('logout');
    return;
  }

  // Auto login using NTLM
  const ntlmProvider = new IndividualModel('cfg:NTLMAuthProvider', true, false);
  ntlmProvider.load().then(() => {
    const path = !ntlmProvider.hasValue('v-s:deleted', true) && ntlmProvider.hasValue('rdf:value') && ntlmProvider.get('rdf:value')[0];
    if (path) {
      ntlmAuth(path)
        .then((authResult) => initWithCredentials(authResult))
        .catch((err) => {
          console.error('NTLM auth failed');
          show(loginForm);
        });
    } else {
      show(loginForm);
    }
  }).catch((error) => {
    show(loginForm);
  });
}

// Activity handler
localStorage.lastActivity = Date.now();
const activityHandler = () => {
  localStorage.lastActivity = Date.now();
};
document.body.addEventListener('keyup', activityHandler);
document.body.addEventListener('click', activityHandler);

const bc = new BroadcastChannel('auth_channel');
bc.onmessage = (event) => {
  console.log('Auth message received');
  handleAuthSuccess(event.data, true);
};

// Check & refresh credentials
let refreshInterval;

/**
 * Handles authentication success
 * @param {Object} authResult - The authentication result
 * @param {boolean} [isBroadcast=false] - Indicates if the authentication result is from a broadcast message
 * @return {void}
 */
function handleAuthSuccess (authResult, isBroadcast = false) {
  if (!isBroadcast) bc.postMessage(authResult);
  veda.ticket = authResult.ticket;
  storage.setItem('ticket', veda.ticket);
  veda.user_uri = authResult.user_uri;
  storage.setItem('user_uri', veda.user_uri);
  veda.end_time = authResult.end_time;
  storage.setItem('end_time', veda.end_time);
  setCookie('ticket', veda.ticket, veda.end_time);
  // Re-login on ticket expiration
  if ( veda.end_time ) {
    const granted = Date.now();
    const expires = parseInt(veda.end_time);
    const lifetime = expires > granted ? expires - granted : 0;
    const hh = Math.floor(lifetime / 1000 / 60 / 60);
    const mm = Math.floor((lifetime % (1000 * 60 * 60)) / 1000 / 60);
    const ss = Math.floor((lifetime % (1000 * 60)) / 1000);
    console.log(`Ticket will expire in ${hh < 10 ? '0' + hh : hh}:${mm < 10 ? '0' + mm : mm}:${ss < 10 ? '0' + ss : ss}`);

    clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      const expired = expires <= Date.now();
      const almostExpired = expires - lifetime * 0.1 <= Date.now() && !expired;
      const expiresSoon = expires - lifetime * 0.2 <= Date.now() && !expired;
      if (expired || almostExpired) {
        clearInterval(refreshInterval);
        console.log('Ticket expired, re-login.');
        handleAuthError();
      } else if (expiresSoon && granted < Number(localStorage.lastActivity)) {
        clearInterval(refreshInterval);
        console.log('Refresh ticket in background.');
        Backend.get_ticket_trusted(veda.ticket).then(handleAuthSuccess).catch(handleAuthError);
      }
    }, Math.ceil(lifetime / 10 || 10000));
  }
}

/**
 * Initializes the application with the provided authentication result
 * @param {Object} authResult - The authentication result
 * @return {void}
 */
function initWithCredentials (authResult) {
  hide(loginForm);
  handleAuthSuccess(authResult);

  const loadIndicator = document.getElementById('load-indicator');
  const loadIndicatorTimer = setTimeout(() => loadIndicator.style.display = '', 250);

  veda.init(veda.user_uri).then(() => {
    clearTimeout(loadIndicatorTimer);
    hide(loadIndicator);
    veda.trigger('started');
  });
}

// Logout handler
delegateHandler(document.body, 'click', '#logout, .logout', function () {
  Backend.logout(veda.ticket).catch((error) => console.log('Logout failed', error));
  storage.removeItem('ticket');
  storage.removeItem('user_uri');
  storage.removeItem('end_time');
  delCookie('ticket');
  storage.setItem('logout', true);
  window.location.reload();
});

function adjustTicket ({id, user_uri, end_time}) {
  return {
    ticket: id,
    user_uri,
    end_time,
  };
}

/**
 * Initializes the authentication flow
 * @return {Promise<void>}
 */
export default async function auth () {
  const loadIndicator = document.getElementById('load-indicator');
  const loadIndicatorTimer = setTimeout(() => loadIndicator.style.display = '', 250);

  // Try to get auth result from cookie
  try {
    let authResult = getCookie('auth');
    if (authResult) {
      authResult = adjustTicket(JSON.parse(atob(authResult)));
      Object.entries(authResult).forEach(([key, value]) => storage.setItem(key, value));
      delCookie('auth');
    }
  } catch (error) {
    console.log(error);
    delCookie('auth');
  }

  // Check if ticket is valid
  const ticket = storage.getItem('ticket');
  const user_uri = storage.getItem('user_uri');
  const end_time = Date.now() < parseInt(storage.getItem('end_time'));
  let valid;
  if (ticket && user_uri && end_time) {
    try {
      valid = await Backend.is_ticket_valid(ticket);
    } catch (error) {
      valid = false;
    }
  } else {
    valid = false;
  }

  // Init application
  if (valid) {
    initWithCredentials({ticket, user_uri, end_time});
  } else {
    try {
      const {ticket, user_uri, end_time} = await Backend.authenticate('guest', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      const authRequiredParam = await Backend.get_individual(ticket, 'cfg:AuthRequired');
      const {'rdf:value': [{data: isAuthRequired}]} = authRequiredParam;
      if (!isAuthRequired) {
        initWithCredentials({ticket, user_uri, end_time});
      } else {
        handleAuthError();
      }
    } catch (error) {
      console.error('cfg:AuthRequired load failed');
      handleAuthError();
    }
  }

  clearTimeout(loadIndicatorTimer);
  hide(loadIndicator);
}
