// Veda application authentication

veda.Module(function (veda) { "use strict";

  var storage = typeof localStorage !== "undefined" ? localStorage : {
    clear: function () {
      var self = this;
      Object.keys(this).map(function (key) {
        if (typeof self[key] !== "function") delete self[key];
      });
    }
  };

  // Login invitation
  var loginForm = $(".login-form");

  $("#submit-login-password", loginForm).click( function (e) {
    e.preventDefault();
    var login = $("#login", loginForm).val(),
      password = $("#password", loginForm).val(),
      hash = Sha256.hash(password);

    // Try internal authentication
    veda.login(login, hash)
      // Try ntlm authentication
      .catch(function (error) {
        console.log(error);
        if (ntlm) {
          var params = {
            type: "POST",
            url: ntlm + "ad/",
            data: {
              "login": login,
              "password": password
            },
            async: true
          };
          return $.ajax(params);
        } else {
          throw error;
        }
      })
      .then(handleLoginSuccess)
      .catch(handleLoginError);
  });

  $("#submit-new-password", loginForm).click( function (e) {
    e.preventDefault();
    var login = $("#login", loginForm).val(),
      password = $("#new-password", loginForm).val(),
      secret = $("#secret", loginForm).val(),
      hash = Sha256.hash(password);

    veda.login(login, hash, secret)
      .then(handleLoginSuccess)
      .catch(handleLoginError);
  });

  $("#forgot-password, #request-secret", loginForm).click( function (e) {
    e.preventDefault();
    var login = $("#login", loginForm).val(),
      secret = "?";

    veda.login(login, undefined, secret)
      .then(handleLoginSuccess)
      .catch(handleLoginError);
  });

  function handleLoginError(error) {
    var enterLoginPassword = $("#enter-login-password", loginForm).hide();
    var enterNewPassword = $("#enter-new-password", loginForm).hide();
    var loginFailedError = $("#login-failed-error", loginForm).hide();
    var passwordExpiredError = $("#password-expired-error", loginForm).hide();
    var newPasswordError = $("#password-expired-error", loginForm).hide();
    var invalidSecretError = $("#invalid-secret-error", loginForm).hide();
    var invalidPasswordError = $("#invalid-password-error", loginForm).hide();
    var secretRequestInfo = $("#secret-request-info", loginForm).hide();
    switch (error.code) {
      case 465: // Empty password
      case 466: // New password is equal to old
      case 467: // Invalid password
        enterNewPassword.show();
        invalidPasswordError.show();
        break;
      case 468: // Invalid secret
        enterNewPassword.show();
        invalidSecretError.show();
        break;
      case 469: // Password expired
        enterNewPassword.show();
        passwordExpiredError.show();
        secretRequestInfo.show();
        break;
      case 472: // Not authorized
      case 473: // Authentication failed
        enterLoginPassword.show();
        loginFailedError.show();
        break;
    }
  }

  function handleLoginSuccess(authResult) {
    var enterLoginPassword = $("#enter-login-password", loginForm).show();
    var enterNewPassword = $("#enter-new-password", loginForm).hide();
    var loginFailedError = $("#login-failed-error", loginForm).hide();
    var passwordExpiredError = $("#password-expired-error", loginForm).hide();
    var newPasswordError = $("#password-expired-error", loginForm).hide();
    var invalidSecretError = $("#invalid-secret-error", loginForm).hide();
    var invalidPasswordError = $("#invalid-password-error", loginForm).hide();
    var secretRequestInfo = $("#secret-request-info", loginForm).hide();
    veda.trigger("login:success", authResult);
  }

  // NTLM auth using iframe
  var ntlm;
  var iframe = $("<iframe>", {"class": "hidden"});
  var ntlmProvider = new veda.IndividualModel("cfg:NTLMAuthProvider", true, false);
  ntlmProvider.load().then(function (ntlmProvider) {
    ntlm = !ntlmProvider.hasValue("v-s:deleted", true) && ntlmProvider.hasValue("rdf:value") && ntlmProvider.get("rdf:value")[0];
    if (ntlm) {
      iframe.appendTo(credentials);
    }
  });

  veda.on("login:failed", function () {
    $("#app").empty();
    delete storage.ticket;
    delete storage.user_uri;
    delete storage.end_time;
    veda.Util.delCookie("ticket");
    if ( ntlm ) {
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

  // Initialize application if ticket is valid
  veda.on("login:success", function (authResult) {
    loginForm.hide();
    veda.user_uri = storage.user_uri = authResult.user_uri;
    veda.ticket = storage.ticket = authResult.ticket;
    veda.end_time = storage.end_time = authResult.end_time;
    veda.Util.setCookie("ticket", authResult.ticket, { path:"/files" });
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
    veda.start();
  });

  // Logout handler
  veda.on("logout", function () {
    $("#app").empty();
    delete storage.ticket;
    delete storage.user_uri;
    delete storage.end_time;
    veda.Util.delCookie("ticket");
    loginForm.show();
  });

  // Init application
  veda.init()
    .then(function () {
      // Check if ticket in cookies is valid
      var ticket = storage.ticket,
          user_uri = storage.user_uri,
          end_time = ( new Date() < new Date(parseInt(storage.end_time)) ) && storage.end_time;
      if (ticket && user_uri && end_time) {
        return veda.Backend.is_ticket_valid(ticket);
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
        var authRequired = new veda.IndividualModel("cfg:AuthRequired");
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
    });
});
