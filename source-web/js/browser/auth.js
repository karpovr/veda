// Veda application authentication

'use strict';

import veda from '../common/veda.js';

import Backend from '../common/backend.js';

import IndividualModel from '../common/individual_model.js';

import Sha256 from '../common/lib/sha256.js';

import $ from 'jquery';

import {delegateHandler} from '../browser/dom_helpers.js';

/**
 * Authenticate user
 */
export default function Auth () {
  const storage = window.localStorage;

  // Login invitation
  const loginForm = document.getElementById('login-form');

  loginForm.querySelector('#submit-login-password').addEventListener('click', submitLoginPassword);

  delegateHandler(loginForm, 'keyup', '#login, #password', function (e) {
    if (e.key === 'Enter') {
      submitLoginPassword(e);
    }
  });

  delegateHandler(loginForm, 'click', '.show-password', function (e) {
    const passwords = loginForm.querySelectorAll('.password');
    passwords.forEach((input) => input.type = input.type === 'password' ? 'text' : 'password');
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
        const ntlm = !ntlmProvider.hasValue('v-s:deleted', true) && ntlmProvider.hasValue('rdf:value') && ntlmProvider.get('rdf:value')[0];
        if (ntlm) {
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/ad', true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
            xhr.responseType = 'json';
            xhr.onload = function () {
              if (xhr.status === 200) {
                resolve(xhr.response);
              } else {
                reject(Error('AD form auth failed'));
              }
            };
            xhr.onerror = reject;
            xhr.onabort = reject;
            xhr.send(`login=${login}&password=${password}`);
          });
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
    $('#app').empty();
    delete storage.ticket;
    delete storage.user_uri;
    delete storage.end_time;
    delTicketCookie();

    if (storage.logout) {
      loginForm.style.display = 'block';
      delete storage.logout;
      return;
    }

    // NTLM auth using iframe
    const ntlmProvider = new IndividualModel('cfg:NTLMAuthProvider', true, false);
    ntlmProvider.load().then((ntlmProvider) => {
      const ntlm = !ntlmProvider.hasValue('v-s:deleted', true) && ntlmProvider.hasValue('rdf:value') && ntlmProvider.get('rdf:value')[0];
      if (ntlm) {
        const iframe = document.createElement('iframe');
        iframe.classList.add('hidden');
        loginForm.appendChild(iframe);
        iframe.addEventListener('load', function () {
          try {
            loginForm.style.display = 'none';
            const iframeDoc = iframe.contentWindow.document;
            const ticket = iframeDoc.getElementById('ticket').textContent;
            const user_uri = iframeDoc.getElementById('user_uri').textContent;
            const end_time = iframeDoc.getElementById('end_time').textContent;
            const authResult = {
              ticket: ticket,
              user_uri: user_uri,
              end_time: end_time,
            };
            if (ticket && user_uri && end_time) {
              veda.trigger('login:success', authResult);
            } else {
              throw Error('auto ntlm auth failed');
            }
          } catch (err) {
            console.log(err);
            loginForm.style.display = 'block';
          }
        });
        document.domain = document.domain;
        iframe.setAttribute('src', ntlm);
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
      setTimeout(() => {
        console.log('Ticket expired, re-login.');
        veda.trigger('login:failed');
      }, ticketDelay);
    }

    document.getElementById('load-indicator').style.display = 'block';
    veda.init(veda.user_uri).then(() => {
      document.getElementById('load-indicator').style.display = 'none';
      veda.trigger('started');
    });
  });

  // Logout handler
  delegateHandler(document.body, 'click', '#logout, .logout', function () {
    delete storage.ticket;
    delete storage.user_uri;
    delete storage.end_time;
    delTicketCookie();
    storage.logout = true;
    window.location.reload();
  });

  // Init application
  document.getElementById('load-indicator').style.display = 'block';
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
      document.getElementById('load-indicator').style.display = 'none';
    });
}
