// Check browser version

import bowser from 'bowser';

const template = `
  <style scoped>
    #outdated-overlay {
      position: fixed;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0,0,0,0.5);
      z-index: 9999;
    }
    #outdated-overlay div {
      position: absolute;
      top: 50%;
      left: 50%;
      color: white;
      padding:1.5em;
      border-radius: 0.25em;
      background-color: rgba(0,0,0,0.7);
      transform: translate(-50%,-50%);
      -ms-transform: translate(-50%,-50%);
    }
    #outdated-overlay button {
      font-size: 1.3em;
      font-weight: 500;
      color: #333;
    }
  </style>
  <div id="outdated-overlay">
    <div>
      <h3>Ваш браузер устарел ($BROWSER)<br>
      <small>Некоторые функции могут не работать или работать некорректно.
      <br>Пожалуйста, обновите браузер или используйте альтернативный *</small></h3>
      <h3>Your browser is out of date ($BROWSER)<br>
      <small>Some functions may not work or work incorrectly.
      <br>Please, update your browser or use an alternative one *</small></h3>
      <hr>
      <p>* Edge 80+, Chrome 80+, Firefox 65+, Opera 65+, Safari 11+, Yandex 20+</p>
      <button id="outdated-ok">Ok</button>
    </div>
  </div>
`;

const browser = bowser.getParser(window.navigator.userAgent);

const isOk = browser.satisfies({
  edge: '>=80',
  chrome: '>=80',
  chromium: '>=80',
  firefox: '>=65',
  opera: '>=65',
  safari: '>=11',
  yandex: '>=20',
});

const delay = 14 * 24 * 60 * 60 * 1000;

const outdated = parseInt(window.localStorage.outdated) || 0;

if (!isOk && (Date.now() - outdated > delay)) {
  const name = browser.getBrowser().name;
  const vsn = browser.getBrowser().version;
  const container = document.createElement('div');
  container.id = 'outdated';
  container.innerHTML = template.split('$BROWSER').join(name + ' ' + vsn);
  document.body.appendChild(container);
  const ok = document.getElementById('outdated-ok');
  ok.addEventListener('click', okHandler);
}

function okHandler() {
  this.removeEventListener('click', okHandler);
  const container = document.getElementById('outdated');
  container.remove();
  window.localStorage.outdated = Date.now();
}
