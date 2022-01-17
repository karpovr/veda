import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (mode === 'edit' && individual.hasValue('v-wf:processedDocument')) {
    const stages = ['review'];
    const complex = 's-wf:ComplexRouteStartForm_';
    const simple = 's-wf:SimpleRouteStartForm_';
    const doc = individual['v-wf:processedDocument'][0];

    return doc.getPropertyChain('v-s:recipient', 'v-s:correspondentPerson').then(function (correspondentPerson) {
      individual.addSimpleStartForm(stages, complex);
      individual[complex + 'review'][0][simple + 'visible'] = [true];
      individual[complex + 'review'][0][simple + 'editable'] = [true];
      individual[complex + 'review'][0][simple + 'deadlineDays'] = [10];
      individual[complex + 'review'][0][simple + 'participant'] = correspondentPerson;
    });
  }
};

export const html = `
  <div about="@" data-embedded="true" data-template="s-wf:ComplexRouteStartForm_Common_Template" class="view edit"></div>
`;
