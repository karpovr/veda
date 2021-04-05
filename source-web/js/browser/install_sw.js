// Register service worker and install PWA

import veda from '../common/veda.js';

if ('serviceWorker' in navigator) {
  const HTML = `
    <div class="container margin-xl" id="install-app" style="display:none;">
      <div class="well well-sm text-center no-margin bg-white">
        Установить приложение на главный экран? Install the application on the main screen?
        <button id="install-btn" class="btn btn-sm btn-primary margin-md margin-md-h">Установить / Install</button>
        <button id="reject-install-btn" class="btn btn-sm btn-link" style="margin-left:0;padding-left:0;">Отказаться / Refuse</button>
      </div>
    </div>
  `;
  const wrapper = document.createElement('div');
  wrapper.id = 'install-wrapper';
  wrapper.innerHTML = HTML;
  document.body.insertBefore(wrapper, document.body.firstChild);

  // Install SW
  navigator.serviceWorker.register('/sw-simple.js', {scope: window.location.pathname})
    .then((registration) => {
      console.log('Service worker registered:', registration.scope);

      // Update application on `update` event
      veda.on('update', function () {
        registration.update()
          .catch(console.log)
          .then(function (registration) {
            window.location.reload();
          });
      });
    })
    .catch((error) => console.log(`Registration failed with ${error}`));

  // Receive and log server worker `veda_version` value
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log(`Service worker veda_version = ${event.data}`);
  });

  // Ask server worker the value of its veda_version
  navigator.serviceWorker.ready.then((registration) => {
    registration.active.postMessage('veda_version');
  });

  // Install application prompt
  const showAddToHomeScreen = () => {
    const installApp = document.getElementById('install-app');
    const installBtn = document.getElementById('install-btn');
    const rejectInstallBtn = document.getElementById('reject-install-btn');
    installApp.style.display = 'block';
    installBtn.addEventListener('click', addToHomeScreen);
    rejectInstallBtn.addEventListener('click', rejectInstall);
  };

  const addToHomeScreen = () => {
    const installApp = document.getElementById('install-app');
    installApp.style.display = 'none'; // Hide the prompt
    deferredPrompt.prompt(); // Wait for the user to respond to the prompt
    deferredPrompt.userChoice
      .then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted install prompt');
        } else {
          console.log('User dismissed install prompt');
        }
        deferredPrompt = null;
      });
  };

  const rejectInstall = () => {
    const installApp = document.getElementById('install-app');
    installApp.style.display = 'none';
    localStorage.rejectedInstall = true;
  };

  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    if (!localStorage.rejectedInstall) {
      showAddToHomeScreen();
    }
  });
}
