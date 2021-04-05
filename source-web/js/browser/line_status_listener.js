// Listen and display online/offline status

import veda from '../common/veda.js';

const styles = `
  #line-status {
    font-size: 0.7em;
    margin: 0.7em 0 -2em;
  }
  #line-status.online > *:not(.online),
  #line-status.offline > *:not(.offline),
  #line-status.limited > *:not(.limited) {
    display: none;
  }
`;

const HTML = `
  <div class="container-fluid text-right online" id="line-status" style="display:none;">
    <span class="online"><span class="text-success glyphicon glyphicon-ok-sign"></span> ONLINE</span>
    <span class="limited"><span class="text-warning glyphicon glyphicon-exclamation-sign"></span> LIMITED</span>
    <span class="offline"><span class="text-danger glyphicon glyphicon-remove-sign"></span> OFFLINE</span>
  </div>
`;

const wrapper = document.createElement('div');
wrapper.id = 'line-wrapper';
wrapper.innerHTML = HTML;

const scopedStyle = document.createElement('style');
scopedStyle.setAttribute('scoped', '');
scopedStyle.textContent = styles.trim();
wrapper.appendChild(scopedStyle);

document.body.insertBefore(wrapper, document.body.firstChild);

/**
 * Veda status event handler. Sets the line status indicator
 * @param {string} status
 */
function statusHandler(status) {
  const lineStatus = document.getElementById('line-status');
  lineStatus.style.display = 'block';
  lineStatus.classList.remove('online', 'limited', 'offline');
  lineStatus.classList.add(status);
}
veda.on('status', statusHandler);
