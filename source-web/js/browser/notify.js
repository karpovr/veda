// User notifications
import {sanitize} from '../browser/dom_helpers.js';

export default notify;

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
 * Отображает уведомление на основе указанного типа и сообщения.
 *
 * @param {string} type - Тип уведомления. Возможные значения: 'danger', 'info', 'success', 'warning'.
 * @param {Object|string} input - Сообщение или объект с параметрами уведомления.
 * Если это объект, он должен содержать следующие поля:
 *   @param {string} [input.code] - Код уведомления (по умолчанию пустая строка).
 *   @param {string} [input.name] - Имя уведомления (по умолчанию пустая строка).
 *   @param {string} [input.message] - Сообщение уведомления (по умолчанию пустая строка).
 * Если это строка, она будет использоваться как сообщение.
 *
 * @return {void} Эта функция не возвращает значения.
 *
 * @example
 * // Использование с объектом
 * notify('success', { code: '200', name: 'Operation Successful', message: 'The operation was completed successfully.' });
 *
 * // Использование со строкой
 * notify('danger', 'An error occurred while processing your request.');
 */
function notify (type, input) {
  let code = '';
  let name = '';
  let message = '';

  if (typeof input === 'string') {
    message = input; // Если input - это строка, просто назначаем её в message
  } else if (typeof input === 'object' && input !== null) {
    // Если input - это объект, присваиваем его поля
    code = input.code || '';
    name = input.name || '';
    message = input.message || '';
  }

  console.log(`${new Date().toLocaleString()} [${type.toUpperCase()}] - ${code} - ${name} - ${message}`);

  let iconClass;
  switch (type) {
  case 'danger':
    iconClass = 'fa-times-circle';
    break;
  case 'info':
    iconClass = 'fa-info-circle';
    break;
  case 'success':
    iconClass = 'fa-check-circle';
    break;
  case 'warning':
    iconClass = 'fa-exclamation-circle';
    break;
  default:
    iconClass = '';
  }
  iconClass = 'fa fa-lg ' + iconClass;
  message = message && message.length > 70 ? message.substring(0, 70) + '...' : message;

  const HTML = `
    <div class="alert alert-${sanitize(type)}">
      <span class="${sanitize(iconClass)}"></span>
      <strong>${sanitize(name)}</strong>
      <strong>${sanitize(code)}</strong>
      <span>${sanitize(message)}</span>
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
