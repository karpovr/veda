import flatpickr from 'flatpickr/flatpickr.min.js';
import flatpickrStyles from 'flatpickr/flatpickr.min.css';
import {Russian} from 'flatpickr/l10n/ru.js';

import {delegateHandler} from '/js/browser/dom_helpers.js';

document.adoptedStyleSheets = [...document.adoptedStyleSheets, flatpickrStyles];

export const post = function (individual, template, container, mode, extra) {
  const calendar = flatpickr(template.querySelector('#calendar'), {
    inline: true,
    locale: Russian,
    firstDayOfWeek: 1,
    mode: 'multiple',
    disable: individual.get('v-s:holiday'),
    onChange: (selected) => {
      individual.set('v-s:holiday', selected);
      calendar.changeMonth(new Date(selected.slice(-1)[0]).getMonth(), false);
    },
  });
  calendar.setDate(individual.get('v-s:holiday'));
  calendar.changeMonth(new Date().getMonth(), false);

  const disableDays = (e) => e.stopPropagation();
  let removeHandler = delegateHandler(template, 'click', '.flatpickr-day', disableDays, true);
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

  template.querySelector('#load-from-net').addEventListener('click', async () => {
    const fetched = await fetch('https://raw.githubusercontent.com/d10xa/holidays-calendar/master/json/calendar.json');
    if (fetched.ok) {
      const json = await fetched.json();
      const holidays = json.holidays.map((dateStr) => new Date(dateStr));
      individual.set('v-s:holiday', holidays);
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
    </style>
    <div id="calendar"></div>
    <br/>
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save edit cancel"></span>
      <button id="load-from-net" class="btn btn-warning -view edit">Обновить из сети</button>
    </div>
  </div>
`;
