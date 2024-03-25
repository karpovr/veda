import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  individual.rights.then(function (rights) {
    const actions = $('#edit-ScheduledAction, #delete', template);
    if (!rights.hasValue('v-s:canUpdate', true)) {
      actions.remove();
    } else {
      individual.on('v-s:hasScheduledAction', scheduledActionHandler);
      template.one('remove', function () {
        individual.off('v-s:hasComment', scheduledActionHandler);
      });
      scheduledActionHandler(individual['v-s:hasScheduledAction']);
    }
    function scheduledActionHandler (values) {
      values.length ? actions.hide() : actions.show();
    }
  });

  if (individual.hasValue('v-s:hasStatus', 'v-s:StatusProcessed')) {
    $('#edit-ScheduledAction', template).remove();
  }

  $('.action', template).click(function (e) {
    e.preventDefault();
    const that = this;
    if (that.id === 'delete') {
      const warning = new IndividualModel('v-s:AreYouSure');
      warning.load().then(function (warning) {
        warning = warning['rdfs:label'].map(CommonUtil.formatValue).join(' ');
        if (confirm(warning)) {
          template[0].dispatchEvent(new Event(that.id));
        }
      });
    } else {
      template[0].dispatchEvent(new Event(that.id));
    }
  });
  async function updateResponsible () {
    if (individual.hasValue('v-s:linkedObject') && individual.hasValue('v-s:propertyInDocument')) {
      const subDoc = await individual["v-s:linkedObject"][0].load();
      const cntr = $('#calculatedResponsible', template);
      let responsibles = subDoc[individual['v-s:propertyInDocument'][0].id];
      cntr.empty();
      responsibles.forEach(resp => { resp.present(cntr, "v-ui:LabelTemplate", "view")});
    }
  }
  updateResponsible();
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#journal', template).on('click', function (e) {
    e.preventDefault();
    const journal_uri = individual.id + 'j';
    const journal = new IndividualModel(journal_uri);
    journal.load().then(function (journal) {
      if (!journal.hasValue('rdf:type', 'rdfs:Resource')) {
        riot.route('#/' + journal_uri);
      } else {
        const journalEmpty = new IndividualModel('v-s:JournalEmpty');
        journalEmpty.load().then(function (journalEmpty) {
          journalEmpty = journalEmpty.toString();
          alert(journalEmpty);
        });
      }
    });
  });
};

export const html = `
  <div class="media" style="overflow:initial;">
    <div class="media-body" style="overflow:initial;">
      <div id="ScheduledAction-content">
        <span rel="v-s:creator">
          <span>
            <strong rel="v-s:employee" data-template="v-ui:LabelTemplate"></strong>
            <small rel="v-s:occupation" data-template="v-ui:LabelTemplate"></small>
          </span>
        </span>
        <small>
          <span>&bullet;&nbsp;&nbsp;</span>
          <span property="v-s:created"></span>
        </small>
        <em about="v-s:description" property="rdfs:label"></em>
        <div property="v-s:description" class="view -edit -search"></div>
        <veda-control data-type="text" rows="1" property="v-s:description" class="-view edit -search"></veda-control>
        <div class="row">
          <div class="col-md-4">
            <em about="v-s:responsible" property="rdfs:label"></em>
            <div rel="v-s:responsible" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-s:responsible" class="-view edit -search fulltext"></veda-control>
          </div>
          <div class="col-md-4">
            <em about="v-s:CalculatedResponsibleBundle" property="rdfs:label"></em>
            <div id="calculatedResponsible"></div>
          </div>
          <div class="col-md-4">
            <em about="v-s:controller" property="rdfs:label"></em>
            <div rel="v-s:controller" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-s:controller" class="-view edit -search fulltext"></veda-control>
          </div>
        </div>
        <div class="row">
          <div class="col-md-3">
            <em about="v-s:TaskDateBundle" property="rdfs:label"></em>
            <div property="v-s:dateToPlan" class="view -edit -search"></div>
            <veda-control data-type="dateTime" property="v-s:dateToPlan" class="-view edit -search"></veda-control>
          </div>
          <div class="col-md-3">
            <em about="v-s:TaskPeriodBundle" property="rdfs:label"></em>
            <div rel="v-s:hasPeriod" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-s:hasPeriod" class="-view edit -search fulltext"></veda-control>
          </div>
          <div class="col-md-3">
            <em about="v-s:TaskGiveAwatDateBundle" property="rdfs:label"></em>
            <div property="v-s:dateToFact" class="view edit -search"></div>
          </div>
          <div class="col-md-3">
            <em about="v-s:hasStatus" property="rdfs:label"></em>
            <div rel="v-s:hasStatus" class="view edit -search" data-template="v-ui:LabelTemplate"></div>
          </div>
        </div>

        <small>
          <a href="#" id="edit-ScheduledAction" class="action" about="v-s:Edit" property="rdfs:label"></a>
          &nbsp;
          <a href="#" id="delete" class="action" about="v-s:Delete" property="rdfs:label"></a>
          &nbsp;
          <a href="#" id="journal" class="action" about="v-s:Journal" property="rdfs:label"></a>
        </small>
      </div>
      <div id="new-reply"></div>
      <hr class="margin-sm" />
      <div about="@" rel="v-s:hasScheduledAction" data-template="v-s:RecursiveCommentTemplate"></div>
    </div>
  </div>
`;
