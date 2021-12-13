// Listen and display online/offline status

import veda from '../common/veda.js';

const styles = `
  #line-status {
    position: absolute;
    top: 0.7em;
    right: 0.7em;
    z-index: 1;
    height: 0.7em;
    width: 0.7em;
    background-color: lightgrey;
    border-radius: 50%;
  }
  #line-status.online {
    background-color: forestgreen;
  }
  #line-status.offline {
    background-color: crimson;
  }
  #line-status.limited {
    background-color: darkorange;
  }
`;

const HTML = `
  <div id="line-status"></div>
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
function statusHandler (status) {
  const lineStatus = document.getElementById('line-status');
  lineStatus.style.display = 'block';
  lineStatus.classList.remove('online', 'limited', 'offline');
  lineStatus.classList.add(status);
  lineStatus.setAttribute('title', status);
}
veda.on('status', statusHandler);
