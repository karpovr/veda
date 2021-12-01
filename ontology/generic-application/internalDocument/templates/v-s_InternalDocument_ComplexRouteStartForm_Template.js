import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (mode === "edit" && individual.hasValue("v-wf:processedDocument")) {
  var stages = ['coordination1', 'coordination2', 'coordination3', 'sign', 'approval', 'review', 'examination', 'instruction'];
  var complex = "s-wf:ComplexRouteStartForm_";
  var simple = "s-wf:SimpleRouteStartForm_";
  var doc = individual['v-wf:processedDocument'][0];

  return doc.load().then(function (doc) {

    return Promise.all([
      doc.hasValue("v-s:initiator") ? doc["v-s:initiator"][0].getChief() : undefined,
      doc.hasValue("v-s:creator") ? doc["v-s:creator"][0].getChief() : undefined,
      doc.hasValue("v-s:responsibleDepartment") ? doc["v-s:responsibleDepartment"][0].getChief() : undefined
    ]).then(function (chiefs) {
      var initiatorChief = chiefs[0];
      var creatorChief = chiefs[1];
      var responsibleDepartmentChief = chiefs[2];

      individual.addSimpleStartForm(stages, complex);

      individual[complex+'coordination1'][0][simple+'visible'] = [true];
      individual[complex+'coordination1'][0][simple+'editable'] = [true];
      individual[complex+'coordination2'][0][simple+'visible'] = [true];
      individual[complex+'coordination2'][0][simple+'editable'] = [true];
      individual[complex+'coordination3'][0][simple+'visible'] = [true];
      individual[complex+'coordination3'][0][simple+'editable'] = [true];

      if ( initiatorChief ) {
        individual[complex+'sign'][0][simple+'participant'] = [ initiatorChief ];
      } else if ( creatorChief ) {
        individual[complex+'sign'][0][simple+'participant'] = [ creatorChief ];
      }

      if ( responsibleDepartmentChief ) {
        individual[complex+'review'][0][simple+'participant'] = [ responsibleDepartmentChief ];
      } else if ( creatorChief ) {
        individual[complex+'review'][0][simple+'participant'] = [ creatorChief ];
      }

      individual[complex+'sign'][0][simple+'visible'] = [true];
      individual[complex+'sign'][0][simple+'editable'] = [true];
      individual[complex+'sign'][0][simple+'deadlineDays'] = [5];
      individual[complex+'sign']["v-wf:StartForm_canEdit"] = [true];
      individual[complex+'approval'][0][simple+'visible'] = [true];
      individual[complex+'approval'][0][simple+'editable'] = [true];
      individual[complex+'approval'][0][simple+'deadlineDays'] = [5];
      individual[complex+'review'][0][simple+'visible'] = [true];
      individual[complex+'review'][0][simple+'editable'] = [true];
      individual[complex+'review'][0][simple+'deadlineDays'] = [3];

      //Ознакомление
      if ( doc.hasValue('v-s:copyTo') ) {
        var copy = doc["v-s:copyTo"];
        individual[complex+'examination'][0][simple+'visible'] = [true];
        individual[complex+'examination'][0][simple+'editable'] = [true];
        individual[complex+'examination'][0][simple+'participant'] = copy;
      } else {
        individual[complex+'examination'][0][simple+'visible'] = [true];
        individual[complex+'examination'][0][simple+'editable'] = [true];
      }

      //Поручение
      individual[complex+'instruction'][0][simple+'visible'] = [true];
      individual[complex+'instruction'][0][simple+'editable'] = [true];
    });
  });
}
};

export const html = `
<div about="@" data-embedded="true" data-template="s-wf:ComplexRouteStartForm_Common_Template" class="view edit"></div>
`;