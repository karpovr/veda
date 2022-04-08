import flatpickr from 'flatpickr/flatpickr.min.js';
import flatpickrStyles from 'flatpickr/flatpickr.min.css';
import {Russian} from 'flatpickr/l10n/ru.js';
import 'adoptedStyleSheets';
import notify from '/js/browser/notify.js';

import {delegateHandler} from '/js/browser/dom_helpers.js';

document.adoptedStyleSheets = [...document.adoptedStyleSheets, flatpickrStyles];

export const pre = function (individual, template, container, mode, extra) {
  const calendar = flatpickr(template.querySelector('#calendar'), {
    inline: true,
    locale: Russian,
    firstDayOfWeek: 1,
    mode: 'multiple',
    disable: individual.get('v-s:holiday'),
    onChange: (_, iso) => {
      individual.set('v-s:holiday', iso.split(', ').map((dateStr) => new Date(dateStr)));
      calendar.changeMonth(new Date(individual.get('v-s:holiday').slice(-1)[0]).getMonth(), false);
    },
  });
  calendar.setDate(individual.get('v-s:holiday'));
  calendar.changeMonth(new Date().getMonth(), false);

  const disableDays = (e) => e.stopPropagation();
  let removeHandler;
  template.addEventListener('view', () => {
    removeHandler = delegateHandler(template, 'click', '.flatpickr-day', disableDays, true);
    calendar.set('disable', individual.get('v-s:holiday'));
  });
  template.addEventListener('edit', () => {
    removeHandler();
    calendar.set('disable', []);
    calendar.setDate(individual.get('v-s:holiday'));
    calendar.changeMonth(new Date().getMonth(), false);
  });

  const redraw = (values) => {
    if (template.getAttribute('mode') === 'view') calendar.set('disable', values);
    calendar.setDate(values);
  };
  individual.on('v-s:holiday', redraw);
  template.addEventListener('remove', () => individual.off('v-s:holiday', redraw));

  template.querySelector('#load-from-file').addEventListener('change', (changeEvent) => {
    const fileInput = changeEvent.target;
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (event) {
        try {
          const json = JSON.parse(event.target.result);
          const holidays = json.holidays.map((dateStr) => new Date(dateStr));
          individual.set('v-s:holiday', holidays);
          notify('success', {name: 'Календарь загружен'});
        } catch (error) {
          notify('danger', error);
        }
      };
      reader.onerror = function (event) {
        notify('danger', {message: 'Ошибка загрузки файла'});
      };
    }
  });
};

export const html = `
  <div class="container sheet">
    <style scoped>
      .flatpickr-disabled {
        background-color: rgb(86, 159, 247, 0.6)!important;
        border: 2px solid white!important;
        color: white!important;
      }
      .selected {
        border: 2px solid white!important;
      }
      pre {
        border: none;
        background-color: transparent;
      }
    </style>
    <h2 about="@" property="rdfs:label"></h2>
    <hr>
    <div class="clearfix">
      <div class="pull-left">
        <div id="calendar"></div>
      </div>
      <div class="pull-left margin-xl-h">
        <h5>Пример содержимого файла для загрузки в формате JSON</h5>
<pre>
{
  "holidays": [
    "2022-04-02",
    "2022-04-09",
    "2022-04-16",
    "2022-04-23",
    "2022-04-30"
  ]
}</pre>
        <a href="https://raw.githubusercontent.com/d10xa/holidays-calendar/master/json/calendar.json">Обновляемый календарь в сети Интернет</a>
        <br><br>
        <input type="file" id="load-from-file" class="-view edit"></input>
      </div>
    </div>
    <br/>
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save edit cancel"></span>
    </div>
  </div>
`;
