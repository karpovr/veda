// User notifications

import veda from '../common/veda.js';

export default veda.Notify = Notify;

/**
 * Notify singleton constructor
 * @return {Function} notify function
 */
function Notify () {
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

const wrapper = document.createElement('div');
wrapper.id = 'notification-wrapper';
document.body.appendChild(wrapper);

const container = document.createElement('div');
container.id = 'notifications';

const scopedStyle = document.createElement('style');
scopedStyle.setAttribute('scoped', '');
scopedStyle.textContent = styles.trim();

wrapper.appendChild(scopedStyle);
wrapper.appendChild(container);

/**
 * Notify function
 * @param {string} type - notification type following bootstrap contextual classes ( info | success | warning | danger )
 * @param {Object} note - note object with properties 'code', 'name', 'message'
 * @return {void}
 */
function notify (type = 'info', {code = '', name = '', message = ''}) {
  console.log(`${new Date().toLocaleString()} [${type.toUpperCase()}] - ${code} - ${name} - ${message}`);

  let iconClass;
  switch (type) {
  case 'danger': iconClass = 'fa-times-circle'; break;
  case 'info': iconClass = 'fa-info-circle'; break;
  case 'success': iconClass = 'fa-check-circle'; break;
  case 'warning': iconClass = 'fa-exclamation-circle'; break;
  }
  iconClass = 'fa fa-lg ' + iconClass;
  message = message && message.length > 70 ? message.substring(0, 70) + '...' : message;

  const HTML = `
    <div class="alert alert-${type}">
      <span class="${iconClass}"></span>
      <strong>${name}</strong>
      <strong>${code}</strong>
      <span>${message}</span>
    </div>
  `;

  const fragment = document.createDocumentFragment();
  const note = document.createElement('div');
  fragment.appendChild(note);
  note.innerHTML = HTML.trim();
  container.insertBefore(fragment, container.firstChild);

  setTimeout(() => {
    container.removeChild(note);
  }, 5000);
}
