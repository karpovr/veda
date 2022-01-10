import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('v-s:actor', 'cfg:VedaSystem')) {
    template.empty();
  }
  $('#exp', template).click(function (e) {
    e.preventDefault();
    $("div[rel='v-s:processJournal']", template).toggle();
    $(this).children(':first').toggleClass('glyphicon-chevron-down glyphicon-chevron-right');
  });
  if (individual.hasValue('v-wf:onProcess')) {
    const process = individual.get('v-wf:onProcess')[0];
    return process.load().catch(function (err) {
      console.log('process deleted:', process.id);
      $('.on-process', template).remove();
    });
  }
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('rdf:type', 'v-s:ProcessStarted')) {
    $('.start-process', template).show();
    $('.non-start-process', template).hide();
    const process = individual.get('v-wf:onProcess')[0];
    process.load().then(function (process) {
      if (process.hasValue('v-wf:isStopped', true)) {
        $('.process-id', template).addClass('text-danger');
        $('.process-stopped', template).show();
        $('.start-process > #exp', template).trigger('click');
      }
      if (
        (!process.hasValue('v-wf:isStopped') || process.hasValue('v-wf:isStopped', false)) &&
        (!process.hasValue('v-wf:isCompleted') || process.hasValue('v-wf:isCompleted', false))
      ) {
        const actor = individual['v-s:actor'][0];
        const doc = individual['v-s:onDocument'][0];
        const isMemberPromise = veda.user.isMemberOf('v-s:FunctionProcessBreak_Group');
        return Promise.all([doc.canDelete(), isMemberPromise]).then(function (results) {
          const canDelete = results[0];
          const isProcessBreakMember = results[1];
          if (!actor) {
            console.log("Unexpected behavior: can't read v-s:actor from individual");
            return false;
          }
          if (veda.appointment.id === actor.id || veda.appointment.id === 'cfg:AdministratorAppointment' || (canDelete && isProcessBreakMember)) {
            $('.stop-process', template).show();
            $('.stop-process', template).on('click', function (e) {
              e.preventDefault();
              const self = this;
              const warn = new IndividualModel('v-s:AreYouSure');
              warn.load().then(function (warn) {
                warn = warn['rdfs:label'].map(CommonUtil.formatValue).join(' ');
                if (confirm(warn)) {
                  process['v-wf:isStopped'] = [true];
                  $(self).remove();
                  process.save();
                }
              });
            });
          }
        });
      }
    });
  }
};

export const html = `
  <div class="journal-record">
    <hr class="margin-sm" />
    <div class="row">
      <div class="col-md-2 col-sm-3 event-type">
        <span class="start-process" href="#" style="display:none">
          <a href="#" id="exp"><span class="glyphicon glyphicon-chevron-down"></span></a>
          <strong about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></strong>
        </span>
        <span class="non-start-process" about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
      </div>
      <div class="col-md-8 col-sm-6 event-desc">
        <div about="@" rel="v-s:documentVersion" data-template="v-ui:LabelLinkTemplate"></div>
        <div about="@" rel="v-wf:onProcess" class="on-process" data-template="v-ui:DocumentEventTemplate_inline"></div>
        <span about="@" rel="v-s:actor" data-template="v-ui:LabelTemplate"></span>
      </div>
      <div class="col-md-2 col-sm-3 event-date text-right">
        <span about="@" property="v-s:created"></span>
      </div>
    </div>
    <div about="@" rel="v-s:processJournal" data-template="v-ui:SubJournalTemplate"></div>
  </div>
`;
