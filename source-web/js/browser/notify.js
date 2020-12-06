// Notify module

"use strict";

import veda from "../common/veda.js";

export default veda.Notify = Notify;

function Notify() {
  if (Notify.prototype._single) {
    return Notify.prototype._single;
  }

  return (Notify.prototype._single = notify);
}

const styles = `
  #notifications {
    max-width: 50%;
    max-height: 50%;
    position: fixed;
    bottom: 10px;
    right: 10px;
    z-index: 99999;
    overflow: hidden;
  }
  #notifications > * {
    display: block;
    white-space: nowrap;
  }
`;

const wrapper = document.createElement("div");
wrapper.id = "notification-wrapper";
document.body.appendChild(wrapper);

const container = document.createElement("div");
container.id = "notifications";

const scopedStyle = document.createElement("style");
scopedStyle.setAttribute("scoped", "");
scopedStyle.textContent = styles.trim();

wrapper.appendChild(scopedStyle);
wrapper.appendChild(container);

function notify (type = "info", {code = "", name = "", message = ""}) {
  console.log(`${new Date().toLocaleString()} [${type.toUpperCase()}] - ${code} - ${name} - ${message}`);

  let iconClass;
  switch (type) {
    case "danger" : iconClass = "fa-times-circle"; break;
    case "info"   : iconClass = "fa-info-circle"; break;
    case "success": iconClass = "fa-check-circle"; break;
    case "warning": iconClass = "fa-exclamation-circle"; break;
  }
  iconClass = "fa fa-lg " + iconClass;
  message = message && message.length > 70 ? message.substring(0, 70) + "..." : message;

  const HTML = `
    <div class="alert alert-${type}">
      <span class="${iconClass}"></span>
      <strong>${code}</strong>
      <strong>${name}</strong>
      <span>${message}</span>
    </div>
  `;

  const template = document.createElement("template");
  template.innerHTML = HTML.trim();
  const note = template.content.firstChild;
  container.insertBefore(note, container.firstChild);

  setTimeout(function () {
    container.removeChild(note);
  }, 5000);
}
