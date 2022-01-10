import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  individual.canUpdate().then(function (canUpdate) {
    if (canUpdate && !individual.hasValue('v-wf:read', true)) {
      return Backend.set_in_individual({
        ticket: veda.ticket,
        individual: {
          '@': individual.id,
          'v-wf:read': [
            {
              data: true,
              type: 'Boolean',
            },
          ],
        },
      });
    }
  });
};

export const html = '<div class="hidden"></div>';
