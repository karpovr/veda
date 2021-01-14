// Check browser version

import bowser from 'bowser';

const template = `
  <style scoped>
    #update-overlay {
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
    #update-overlay > * {
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
  </style>
  <div id="update-overlay">
    <div>
      <h3>Ваш браузер устарел ($BROWSER).<br>
      <small>Пожалуйста, обновите браузер или используйте альтернативный.</small></h3>
      <h3>Your browser is out of date ($BROWSER).<br>
      <small>Please, update your browser or use an alternative one.</small></h3>
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
  yandex: '>=80',
});

if (!isOk) {
  const name = browser.getBrowser().name;
  const vsn = browser.getBrowser().version;
  const container = document.createElement('div');
  container.innerHTML = template.split('$BROWSER').join(name + ' ' + vsn);
  document.body.appendChild(container);
}
