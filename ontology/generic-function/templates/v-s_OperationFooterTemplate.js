import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('.action#start', template).click(function () {
    individual['v-s:hasStatus'] = [new IndividualModel('v-s:StatusStarted')];
    individual.save();
  });
  $('.action#stop', template).click(function () {
    Backend.set_in_individual(veda.ticket, {
      '@': individual.id,
      'v-s:hasStatus': [
        {
          type: 'Uri',
          data: 'v-s:StatusStopped',
        },
      ],
    });
  });
  $('.action#restart', template).click(function () {
    individual['v-s:hasStatus'] = [new IndividualModel('v-s:StatusRestarted')];
    individual['v-s:output'] = [''];
    individual['v-s:progress'] = [0];
    individual.save();
  });

  statusHandler();
  individual.on('v-s:hasStatus', statusHandler);
  template.one('remove', function () {
    individual.off('v-s:hasStatus', statusHandler);
  });
  individual.on('v-s:hasStatus', statusHandler);

  function statusHandler () {
    const start = $('.action#start', template);
    const stop = $('.action#stop', template);
    const restart = $('.action#restart', template);
    const status = individual.hasValue('v-s:hasStatus') ? individual['v-s:hasStatus'][0].id : undefined;

    switch (status) {
    case 'v-s:StatusStarted':
    case 'v-s:StatusExecution':
      start.addClass('hidden');
      stop.removeClass('hidden');
      restart.addClass('hidden');
      break;
    case 'v-s:StatusExecuted':
      start.addClass('hidden');
      stop.addClass('hidden');
      restart.removeClass('hidden');
      break;
    default:
      start.removeClass('hidden');
      stop.addClass('hidden');
      restart.addClass('hidden');
      break;
    }
  }
};

export const html = `
  <div class="actions view edit -search clearfix">
    <div class="pull-left">
      <button type="button" class="action btn btn-success view -edit -search" id="start" about="v-s:StartBundle" property="rdfs:label"></button>
      <button type="button" class="action btn btn-info view -edit -search" id="restart" about="v-s:RestartBundle" property="rdfs:label"></button>
      <button type="button" class="action btn btn-danger view -edit -search" id="stop" about="v-s:StopBundle" property="rdfs:label"></button>
    </div>
  </div>
`;
