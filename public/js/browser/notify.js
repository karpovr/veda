// Notification module

"use strict";

import veda from "../common/veda";

export default veda.Notify = Notify;

function Notify() {
  // Singleton pattern
  if (Notify.prototype._singletonInstance) {
    return Notify.prototype._singletonInstance;
  }
  // Notify function
  var notificationContainer = $("#notification-container");
  var notificationTmpl = $("#notification-template").html();
  function notify(type, note) {
    console.log( (new Date()).toISOString(), type + ":", JSON.stringify(note) );
    var notification = $(notificationTmpl).addClass("alert-" + type).prependTo(notificationContainer),
        durationFade = 200,
        durationShown = 5000,
        code = note.code,
        name = note.name,
        message = note.message && note.message.length > 70 ? note.message.substring(0, 70) + "..." : note.message,
        iconClass = "fa fa-lg " + (
          type === "danger"  ? "fa-times-circle" :
          type === "info"    ? "fa-info-circle" :
          type === "success" ? "fa-check-circle" :
          type === "warning" ? "fa-exclamation-circle" : ""
        ),
        timeout = setTimeout(function () {
          notification.hide(durationFade, function () { $(this).remove(); });
        }, durationShown);
    notification.find(".note-icon").addClass( iconClass );
    notification.find(".note-code").text( code );
    notification.find(".note-name").text( name );
    notification.find(".note-message").text( message );
    notification.one("remove", function () { clearTimeout(timeout); });
    notification.show(durationFade);
    notificationContainer
      .children()
      .slice(3)
      .hide(durationFade, function () { $(this).remove(); });
  }
  return (Notify.prototype._singletonInstance = notify);
};
