import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  Promise.all([import('moment'), import('fullcalendar'), import('fullcalendar-locale'), import('fullcalendar-style')]).then((resolved) => {
    const moment = resolved.shift().default;
    const fullcalendar = resolved.shift().default;
    const locale = resolved.shift().default;
    const rules = resolved.shift().default;
    const list = rules.cssRules || rules.rules;
    const len = list.length;
    let rulesTxt = '';
    for (let i = 0; i < len; i++) {
      rulesTxt += ' ' + list[i].cssText;
    }
    const style = document.createElement('style');
    style.textContent = rulesTxt;
    template.prepend(style);

    const fullCalendarOptions = {
      eventSources: [
        {
          events: (start, end, timezone, callback) => {
            individual.getEvents(start, end).then((events) => {
              callback(events);
            });
          },
        },
      ],
      header: {
        left: 'today',
        center: 'prev title next',
        right: 'month,agendaWeek,agendaDay,listWeek',
      },
      navLinks: true,
      firstDay: 1,
      defaultView: 'agendaWeek',
      weekNumbers: true,
      weekNumberCalculation: 'ISO',
      businessHours: {
        dow: [1, 2, 3, 4, 5],
        start: '8:00',
        end: '18:00',
      },
      locale: Object.keys(veda.user.preferences.language)[0].toLowerCase(),
      timezone: 'local',
      height: () => {
        const top = $('#fullcalendar', template).offset().top;
        const bottom = container.next().offset().top;
        return bottom - top - 30;
      },
    };

    const calendar = $('#fullcalendar', template);
    calendar.fullCalendar(fullCalendarOptions);
    template.one('remove', () => calendar.fullCalendar('destroy'));
  });
};

export const html = `
  <div class="container-fluid sheet">
    <br />
    <div id="fullcalendar"></div>
  </div>
`;
