import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#add-ScheduledAction', template).click(function () {
    const addScheduledAction = $(this).hide();
    const _class = new IndividualModel('v-s:ScheduledAction');
    const ScheduledAction = new IndividualModel();
    const cntr = $('#new-ScheduledAction', template).empty();
    const tmpl = 'v-s:SingleScheduledActionTemplate';
    ScheduledAction['rdf:type'] = [_class];
    ScheduledAction['v-s:backwardTarget'] = [individual];
    ScheduledAction['v-s:backwardProperty'] = [new IndividualModel('v-s:hasScheduledAction')];
    ScheduledAction['v-s:canRead'] = [true];
    ScheduledAction['v-s:mutualMembership'] = [true];
    ScheduledAction['v-s:scriptHandlered'] = [false];
    ScheduledAction.present(cntr, tmpl, 'edit');
    ScheduledAction.one('afterSave beforeReset', function () {
      addScheduledAction.show();
      cntr.empty();
    });
  });

  template.on('click', '#reply.action', function (e) {
    e.preventDefault();
    const ScheduledActionTemplate = $(this).closest('[resource]');
    const targetScheduledAction = new IndividualModel(ScheduledActionTemplate.attr('resource'));
    const cntr = $('#new-reply', ScheduledActionTemplate).first().empty();
    const _class = new IndividualModel('v-s:ScheduledAction');
    const tmpl = new IndividualModel('v-s:SingleScheduledActionTemplate');
    const reply = new IndividualModel();
    reply['rdf:type'] = [_class];
    reply['v-s:backwardTarget'] = [targetScheduledAction];
    reply['v-s:backwardProperty'] = [new IndividualModel('v-s:hasScheduledAction')];
    reply['v-s:canRead'] = [true];
    reply.present(cntr, tmpl, 'edit');
    reply.one('afterSave beforeReset', function () {
      cntr.empty();
    });
  });

  template.on('click', '#edit-ScheduledAction.action', function (e) {
    e.preventDefault();
    const tmpl = new IndividualModel('v-s:SingleScheduledActionTemplate');
    const ScheduledActionTemplate = $(this).closest('[resource]');
    const ScheduledAction = new IndividualModel(ScheduledActionTemplate.attr('resource'));
    const cntr = $('#new-reply', ScheduledActionTemplate).first().empty();
    const ScheduledActionСontent = $('#ScheduledAction-content', ScheduledActionTemplate).hide();
    ScheduledAction.present(cntr, tmpl, 'edit');
    ScheduledAction.one('afterSave beforeReset', function () {
      ScheduledActionСontent.show();
      cntr.empty();
    });
  });
};

export const html = `
  <div>
    <h3 about="v-s:ScheduledActionsBundle" property="rdfs:label"></h3>
    <div about="@" rel="v-s:hasScheduledAction" data-template="v-s:RecursiveScheduledActionTemplate"></div>
    <div id="new-ScheduledAction"></div>
    <button class="margin-sm btn btn-success" id="add-ScheduledAction" about="v-s:AddScheduledAction" property="rdfs:label"></button>
  </div>
`;
