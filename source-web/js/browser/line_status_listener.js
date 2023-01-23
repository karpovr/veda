// Listen and display online/offline status

import veda from '../common/veda.js';

import UpdateService from '../browser/update_service.js';

const styles = `
  #line-status {
    position: fixed;
    top: 0;
    z-index: 9999;
    height: 3px;
    width: 100%;
    background-color: lightgrey;
  }
  #line-status.online {
    background-color: transparent;
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

// Line status sources
(async () => {
  if ('serviceWorker' in navigator) {
    async function setStatus () {
      let status;
      if (navigator.serviceWorker.onLine && navigator.onLine && updateService.onLine) {
        status = 'online';
      } else if (serviceWorker.onLine && navigator.onLine && !updateService.onLine) {
        status = 'limited';
      } else {
        status = 'offline';
      }
      veda.status = status;
      veda.trigger('status', status);
      if (status === 'offline') {
        checkStatus();
      }
    }

    async function checkStatus () {
      const registration = await serviceWorker.ready;
      registration.active.postMessage('status');
    }

    const serviceWorker = navigator.serviceWorker;
    serviceWorker.addEventListener('message', (event) => {
      if ('onLine' in event.data) {
        serviceWorker.onLine = event.data.onLine;
        setStatus();
      }
    });

    const updateService = new UpdateService();
    await updateService.start();
    updateService.on('online', setStatus);
    updateService.on('offline', setStatus);

    window.addEventListener('online', setStatus);
    window.addEventListener('offline', setStatus);
  }
})();
