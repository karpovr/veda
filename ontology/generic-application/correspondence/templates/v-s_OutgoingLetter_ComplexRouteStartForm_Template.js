import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (mode === 'edit' && individual.hasValue('v-wf:processedDocument')) {
    const stages = ['coordination1', 'coordination2', 'sign'];
    const complex = 's-wf:ComplexRouteStartForm_';
    const simple = 's-wf:SimpleRouteStartForm_';
    const doc = individual['v-wf:processedDocument'][0];

    return doc.getPropertyChain('v-s:sender', 'v-s:correspondentPerson').then(function (correspondentPerson) {
      individual.addSimpleStartForm(stages, complex);
      individual[complex + 'coordination1'][0][simple + 'visible'] = [true];
      individual[complex + 'coordination1'][0][simple + 'editable'] = [true];
      individual[complex + 'coordination1'][0][simple + 'deadlineDays'] = [3];
      individual[complex + 'coordination2'][0][simple + 'visible'] = [true];
      individual[complex + 'coordination2'][0][simple + 'editable'] = [true];
      individual[complex + 'coordination2'][0][simple + 'deadlineDays'] = [3];
      individual[complex + 'sign'][0][simple + 'visible'] = [true];
      individual[complex + 'sign'][0][simple + 'editable'] = [true];
      individual[complex + 'sign'][0][simple + 'deadlineDays'] = [3];
      individual[complex + 'sign'][0][simple + 'participant'] = correspondentPerson;
    });
  }
};

export const html = '<div about="@" data-embedded="true" data-template="s-wf:ComplexRouteStartForm_Common_Template" class="view edit"></div>';
