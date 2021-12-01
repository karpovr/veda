import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  return System.import("moment").then(function (module) {
    var moment = module.default;
    return System.import("fullcalendar").then(function (module) {
      var fullCalendar = module.default;
      return System.import("fullcalendar-locale").then(function (module) {
        var locale = module.default;
        return System.import("fullcalendar-style").then(function (module) {
          var rulesTxt = "";
          var list = module.default.cssRules || module.default.rules;
          var len = list.length;
          for (var i = 0; i < len; i++) {
            rulesTxt += " " + list[i].cssText;
          }
          var style = document.createElement("style");
          style.textContent = rulesTxt;
          template.prepend(style);

          /*var counter_uri = "d:taskCounter_" + veda.user.id.split(":").join("_");
          var counter = new IndividualModel(counter_uri);*/
          var fullCalendarOptions = {
            eventSources: [
              {
                events: function(start, end, timezone, callback) {
                  individual.getEvents(start, end).then(function (events) {
                    // Update counter if counter & events count do not match
                    /*var counter_uri = "d:taskCounter_" + veda.user.id.split(":").join("_");
                    var counter = new IndividualModel(counter_uri);
                    counter.load().then(function (counter) {
                      if ( counter.isNew() ) {
                        counter["rdf:type"] = [ new IndividualModel("v-ft:TaskCounter") ];
                      }
                      if ( !counter.hasValue("v-ft:inboxWeekCount", events.length) && start.toDate() <= new Date() && new Date() <= end.toDate() ) {
                        counter["v-ft:inboxWeekCount"] = [events.length];
                        counter.save();
                      }
                    });*/
                    callback(events);
                  });
                }
              }
            ],
            header: {
              left:   'today',
              center: 'prev title next',
              right:  'month,agendaWeek,agendaDay,listWeek'
            },
            navLinks: true,
            firstDay: 1,
            defaultView: 'agendaWeek',
            weekNumbers: true,
            weekNumberCalculation: "ISO",
            businessHours: {
              dow: [ 1, 2, 3, 4, 5 ],
              start: '8:00',
              end: '18:00'
            },
            locale: Object.keys(veda.user.preferences.language)[0].toLowerCase(),
            timezone: 'local',
            height: function () {
              var top = $('#fullcalendar', template).offset().top;
              var bottom = container.next().offset().top;
              return (bottom - top - 30);
            }
          };

          var calendar = $('#fullcalendar', template);
          calendar.fullCalendar(fullCalendarOptions);
          template.one("remove", function () {
            calendar.fullCalendar("destroy");
          });

        });
      });
    });
  });
};

export const html = `
<div class="container-fluid sheet">
  <br>
  <div id="fullcalendar"></div>
</div>
`;