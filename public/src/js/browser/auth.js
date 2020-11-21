// Veda application authentication

"use strict";

import veda from "../common/veda.js";

import Backend from "../common/backend.js";

import IndividualModel from "../common/individual_model.js";

import Sha256 from "../common/lib/sha256.js";

export default function Auth() {

  var storage = typeof localStorage !== "undefined" && localStorage !== null ? localStorage : {
    clear: function () {
      var self = this;
      Object.keys(this).map(function (key) {
        if (typeof self[key] !== "function") delete self[key];
      });
    }
  };

  // Login invitation
  var loginForm = $(".login-form");

  $("#submit-login-password", loginForm).click(submitLoginPassword);
  $("#login, #password", loginForm).keyup(function (e) {
    if (e.which === 13) {
      submitLoginPassword(e);
    }
  });

  function submitLoginPassword(e) {
    e.preventDefault();
    var passwordInput = $("#password", loginForm);
    var login = $("#login", loginForm).val(),
      password = passwordInput.val(),
      hash = Sha256.hash(password);
      passwordInput.val("");

    var ntlmProvider = new IndividualModel("cfg:NTLMAuthProvider", true, false);
    return ntlmProvider.load().then(function (ntlmProvider) {
      var ntlm = !ntlmProvider.hasValue("v-s:deleted", true) && ntlmProvider.hasValue("rdf:value") && ntlmProvider.get("rdf:value")[0];
      if (ntlm) {
        var params = {
          type: "POST",
          url: "/ad/",
          data: {
            "login": login,
            "password": password
          },
          dataType: "json",
          async: true
        };
        return $.ajax(params);
      } else {
        throw new Error();
      }
    })
    .catch(function () {
      return Backend.authenticate(login, hash);
    })
    .then(handleLoginSuccess)
    .catch(handleLoginError)
  }

  $("#new-password, #confirm-new-password, #secret", loginForm).on("input", validateNewPassword);
  var re = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{6,})");
  function validateNewPassword() {
    var submit = $("#submit-new-password", loginForm);
    var newPasswordGroup = $("#new-password-group", loginForm);
    var newPassword = $("#new-password", loginForm);
    var confirmNewPassword = $("#confirm-new-password", loginForm);
    var passwordStrength = $(".password-strength", loginForm);
    var passwordMustMatch = $(".password-must-match", loginForm);
    var secret = $("#secret", loginForm);
    var enterSecret = $(".enter-secret", loginForm);

    var reMatch = re.test( newPassword.val() );
    var passwordsMatch = confirmNewPassword.val() === newPassword.val();
    var isSecret = !!secret.val();
    var isValid = reMatch && passwordsMatch && isSecret;

    if ( !reMatch ) {
      passwordStrength.show();
    } else {
      passwordStrength.hide();
    }
    if ( !passwordsMatch ) {
      passwordMustMatch.show();
    } else {
      passwordMustMatch.hide();
    }
    if ( !isSecret ) {
      enterSecret.show();
    } else {
      enterSecret.hide();
    }
    if ( !isValid ) {
      submit.attr("disabled", "disabled");
    } else {
      submit.removeAttr("disabled", "disabled");
    }
  }

  $("#submit-new-password", loginForm).click( function (e) {
    e.preventDefault();
    var login = $("#login", loginForm).val(),
      password = $("#new-password", loginForm).val(),
      secret = $("#secret", loginForm).val(),
      hash = Sha256.hash(password);

    Backend.authenticate(login, hash, secret)
      .then(handleLoginSuccess)
      .catch(handleLoginError)
      .then(function () {
        $("#new-password", loginForm).val("");
        $("#confirm-new-password", loginForm).val("");
      });
  });

  var changePasswordPressed;
  $("#change-password", loginForm).click( function (e) {
    e.preventDefault();
    changePasswordPressed = true;
    var login = $("#login", loginForm).val(),
      secret = "?";

    Backend.authenticate(login, undefined, secret)
      .then(handleLoginSuccess)
      .catch(handleLoginError);
  });

  var captchaRendered = false;
  function reCAPTCHA(onSuccess, onExpired, onError) {
    if (!captchaRendered) {
      var reCAPTCHA_key = new IndividualModel("cfg:reCAPTCHA_client_key");
      reCAPTCHA_key.load().then(function (reCAPTCHA_key) {
        window.captchaCallback = function() {
          grecaptcha.render("recaptcha", {
            "sitekey": reCAPTCHA_key.get("rdf:value")[0].toString(),
            "theme": "light",
            "callback": onSuccess,
            "expired-callback": onExpired,
            "error-callback": onError,
          });
          captchaRendered = true;
        };
        var captchaScript = document.createElement("script");
        captchaScript.src = "https://www.google.com/recaptcha/api.js?onload=captchaCallback&render=explicit";
        document.head.appendChild(captchaScript);
      });
    } else {
      grecaptcha.reset();
    }
  }

  function handleLoginError(error) {
    var enterLoginPassword = $("#enter-login-password", loginForm).hide();
    var enterNewPassword = $("#enter-new-password", loginForm).hide();

    var invalidSecretWarning = $("#invalid-secret-warning", loginForm).hide();
    var emptyPasswordWarning = $("#empty-password-warning", loginForm).hide();
    var equalPasswordWarning = $("#equal-password-warning", loginForm).hide();
    var invalidPasswordWarning = $("#invalid-password-warning", loginForm).hide();
    var frequentPassChangeWarning = $("#frequent-pass-change-warning", loginForm).hide();
    var passChangeNotAllowedWarning = $("#pass-change-not-allowed-warning", loginForm).hide();
    var secretExpiredWarning = $("#secret-expired-warning", loginForm).hide();

    var passwordExpiredError = $("#password-expired-error", loginForm).hide();
    var loginFailedError = $("#login-failed-error", loginForm).hide();
    var authLockedError = $("#auth-locked-error", loginForm).hide();
    var passChangeLockedError = $("#pass-change-locked-error", loginForm).hide();
    var unavailableError = $("#unavailable-error", loginForm).hide();

    var secretRequestInfo = $("#secret-request-info", loginForm).hide();
    $("input:not(#login)", loginForm).val("");

    var ok = $(".btn.ok", loginForm).hide();
    var okHandler;

    switch (error.code) {
      case 423: // Password change is allowed once a day
        frequentPassChangeWarning.show();
        ok.show();
        okHandler = function () {
          frequentPassChangeWarning.hide();
          enterLoginPassword.show();
        };
        break;
      case 429: // Too many auth fails
        authLockedError.show();
        ok.show();
        okHandler = function () {
          authLockedError.hide();
          enterLoginPassword.show();
        };
        break;
      case 430: // Too many pass change fails
        passChangeLockedError.show();
        ok.show();
        okHandler = function () {
          passChangeLockedError.hide();
          enterLoginPassword.show();
        };
        break;
      case 463: // Password change not allowed
        passChangeNotAllowedWarning.show();
        ok.show();
        okHandler = function () {
          passChangeNotAllowedWarning.hide();
          enterLoginPassword.show();
        };
        break;
      case 464: // Secret expired
        secretExpiredWarning.show();
        ok.show();
        okHandler = function () {
          secretExpiredWarning.hide();
          enterLoginPassword.show();
        };
        break;
      case 465: // Empty password
        emptyPasswordWarning.show();
        ok.show();
        okHandler = function () {
          emptyPasswordWarning.hide();
          enterLoginPassword.show();
        };
        break;
      case 466: // New password is equal to old
        equalPasswordWarning.show();
        ok.show();
        okHandler = function () {
          equalPasswordWarning.hide();
          enterLoginPassword.show();
        };
        break;
      case 467: // Invalid password
        invalidPasswordWarning.show();
        ok.show();
        okHandler = function () {
          invalidPasswordWarning.hide();
          enterLoginPassword.show();
        };
        break;
      case 468: // Invalid secret
        invalidSecretWarning.show();
        ok.show();
        okHandler = function () {
          invalidSecretWarning.hide();
          enterLoginPassword.show();
        };
        break;
      case 469: // Password expired
        if ( !changePasswordPressed ) {
          passwordExpiredError.show();
          ok.show();
          okHandler = function () {
            passwordExpiredError.hide();
            enterNewPassword.show();
            secretRequestInfo.show();
          };
        } else {
          enterNewPassword.show();
          secretRequestInfo.show();
        }
        break;
      case 472: // Not authorized
      case 473: // Authentication failed
        loginFailedError.show();
        reCAPTCHA(onSuccess, onExpired, onSuccess);
        break;
      default:
        unavailableError.show();
        ok.show();
        okHandler = function () {
          unavailableError.hide();
          enterLoginPassword.show();
        };
        break;
    }
    ok.off("click").one("click", okHandler).one("click", okHide);
    function okHide() {
      $(this).hide();
    }
    function onSuccess() {
      $(".alert, fieldset", loginForm).hide();
      enterLoginPassword.show();
    }
    function onExpired() {
      $(".alert, fieldset", loginForm).hide();
      loginFailedError.show();
    }
  }

  function handleLoginSuccess(authResult) {
    var enterLoginPassword = $("#enter-login-password", loginForm).show();
    var enterNewPassword = $("#enter-new-password", loginForm).hide();

    var invalidSecretWarning = $("#invalid-secret-warning", loginForm).hide();
    var emptyPasswordWarning = $("#empty-password-warning", loginForm).hide();
    var equalPasswordWarning = $("#equal-password-warning", loginForm).hide();
    var invalidPasswordWarning = $("#invalid-password-warning", loginForm).hide();
    var frequentPassChangeWarning = $("#frequent-pass-change-warning", loginForm).hide();
    var passChangeNotAllowedWarning = $("#pass-change-not-allowed-warning", loginForm).hide();
    var secretExpiredWarning = $("#secret-expired-warning", loginForm).hide();

    var passwordExpiredError = $("#password-expired-error", loginForm).hide();
    var loginFailedError = $("#login-failed-error", loginForm).hide();
    var authLockedError = $("#auth-locked-error", loginForm).hide();
    var passChangeLockedError = $("#pass-change-locked-error", loginForm).hide();
    var unavailableError = $("#unavailable-error", loginForm).hide();

    var secretRequestInfo = $("#secret-request-info", loginForm).hide();
    $("input:not(#login)", loginForm).val("");

    var ok = $(".btn.ok", loginForm).hide();

    veda.trigger("login:success", authResult);
  }

  function setTicketCookie(ticket, expires) {
    document.cookie = "ticket=" + ticket + "; expires=" + new Date(parseInt(expires)).toGMTString() + "; samesite=strict; path=/;";
  }
  function delTicketCookie() {
    setTicketCookie(null, 0);
  }

  veda.on("login:failed", function () {
    $("#app").empty();
    delete storage.ticket;
    delete storage.user_uri;
    delete storage.end_time;
    delTicketCookie();

    if (storage.logout) {
      loginForm.show();
      delete storage.logout;
      return;
    }

    // NTLM auth using iframe
    var ntlmProvider = new IndividualModel("cfg:NTLMAuthProvider", true, false);
    ntlmProvider.load().then(function (ntlmProvider) {
      var ntlm = !ntlmProvider.hasValue("v-s:deleted", true) && ntlmProvider.hasValue("rdf:value") && ntlmProvider.get("rdf:value")[0];
      if (ntlm) {
        var iframe = $("<iframe>", {"class": "hidden"});
        iframe.appendTo(loginForm);
        iframe.one("load", function () {
          try {
            loginForm.hide();
            var body = iframe.contents().find("body"),
              ticket = $("#ticket", body).text(),
              user_uri = $("#user_uri", body).text(),
              end_time = $("#end_time", body).text(),
              authResult = {
                ticket: ticket,
                user_uri: user_uri,
                end_time: end_time
              };
            if (ticket && user_uri && end_time) {
              veda.trigger("login:success", authResult);
            } else {
              throw "auto ntlm auth failed";
            }
          } catch (err) {
            console.log(err);
            loginForm.show();
          }
        });
        document.domain = document.domain;
        iframe.attr("src", ntlm);
      } else {
        loginForm.show();
      }
    });
  });

  // Initialize application if ticket is valid
  veda.on("login:success", function (authResult) {
    loginForm.hide();
    veda.user_uri = storage.user_uri = authResult.user_uri;
    veda.ticket = storage.ticket = authResult.ticket;
    veda.end_time = storage.end_time = authResult.end_time;
    setTicketCookie(veda.ticket, veda.end_time);
    // Re-login on ticket expiration
    if( veda.end_time ) {
      var ticketDelay = parseInt(veda.end_time) - Date.now();
      var ticketDelayHours = Math.floor(ticketDelay / 1000 / 60 / 60);
      var ticketDelayMinutes = Math.floor(ticketDelay / 1000 / 60 - ticketDelayHours  * 60);
      console.log("Ticket will expire in %d hrs. %d mins.", ticketDelayHours, ticketDelayMinutes);
      setTimeout(function () {
        console.log("Ticket expired, re-login.");
        veda.trigger("login:failed");
      }, ticketDelay);
    }
    $("#load-indicator").show();
    veda.init(veda.user_uri).then(function () {
      $("#load-indicator").hide();
      veda.trigger("started");
    });
  });

  // Logout handler
  $(document).on("click", "#logout, .logout", function () {
    delete storage.ticket;
    delete storage.user_uri;
    delete storage.end_time;
    delTicketCookie();
    storage.logout = true;
    location.reload();
  });

  // Init application
  $("#load-indicator").show();
  veda.init("cfg:Guest")
    .then(function () {
      // Check if ticket is valid
      var ticket = storage.ticket,
          user_uri = storage.user_uri,
          end_time = ( new Date() < new Date(parseInt(storage.end_time)) ) && storage.end_time;
      if (ticket && user_uri && end_time) {
        return Backend.is_ticket_valid(ticket);
      } else {
        return false;
      }
    })
    .then(function (valid) {
      if (valid) {
        veda.trigger("login:success", {
          ticket: storage.ticket,
          user_uri: storage.user_uri,
          end_time: storage.end_time
        });
      } else {
        var authRequired = new IndividualModel("cfg:AuthRequired");
        authRequired.load().then(function (authRequiredParam) {
          if ( authRequiredParam && authRequiredParam.hasValue("rdf:value", false) ) {
            veda.trigger("login:success", {
              ticket: "",
              user_uri: "cfg:Guest",
              end_time: 0
            });
          } else {
            veda.trigger("login:failed");
          }
        });
      }
    })
    .then(function () {
      $("#load-indicator").hide();
    });

}
