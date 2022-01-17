import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  let renderedCount = 0;
  const tbody = $('#tbody', template);
  const task_template = 'v-ui:SimplifiedJournalTemplate_task';
  const doc_uri = this.id.replace(/.$/, '');
  const doc = new IndividualModel(doc_uri);
  $('#refresh', template).click(buildJournal);
  buildJournal();

  function buildJournal () {
    renderedCount = 0;
    tbody.empty();
    Backend.query({
      ticket: veda.ticket,
      query: "'rdf:type'=='v-wf:DecisionForm' && 'v-wf:onDocument'=='" + doc_uri + "'",
      sort: "'v-s:created' desc",
    })
      .then(function (query_res) {
        const tasks_uris = query_res.result;
        if (tasks_uris.length) {
          return Backend.get_individuals({
            ticket: veda.ticket,
            uris: tasks_uris,
          });
        }
      })
      .then(renderTasks);
  }

  function renderTasks (tasksJSONs) {
    if (!tasksJSONs || !tasksJSONs.length) {
      return;
    }
    const taskJSON = tasksJSONs.pop();
    const task = new IndividualModel(taskJSON);
    task
      .present(tbody, task_template)
      .then(function (renderedTemplate) {
        $('.sequence-number', renderedTemplate).text(++renderedCount);
      })
      .then(function () {
        renderTasks(tasksJSONs);
      });
  }

  $('#on-document', template).attr('about', doc_uri);

  $('.createReport0', template).on('click', function () {
    BrowserUtil.createReport('v-s:Journal_printBlank', doc);
  });
};

export const html = `
  <div class="container sheet">
    <br />
    <ul id="box-tabs" class="nav nav-tabs nav-right" role="tablist">
      <li class="pull-left"><h2 class="no-margin" about="v-s:Journal" property="rdfs:label"></h2></li>
      <li role="presentation">
        <a href="#/@//v-ui:JournalTemplate" class="btn btn-link"><span about="v-ui:JournalTemplate" property="rdfs:label"></span></a>
      </li>
      <li role="presentation" class="active">
        <a href="#/@//v-ui:SimplifiedJournalTemplate" class="btn btn-link"><span about="v-ui:SimplifiedJournalTemplate" property="rdfs:label"></span></a>
      </li>
    </ul>
    <br />
    <div class="clearfix">
      <div class="pull-left">
        <h4 id="on-document" data-template="v-ui:ClassNameLabelLinkTemplate"></h4>
      </div>
      <div class="pull-right">
        <button type="button" class="action btn btn-info view -edit -search createReport0" about="v-s:PrintBlank" property="rdfs:label"></button>
      </div>
    </div>
    <br />
    <div id="tasks" class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th width="1%">#</th>
            <th width="15%" about="v-wf:from" property="rdfs:label"></th>
            <th width="15%" about="v-wf:to" property="rdfs:label"></th>
            <th width="25%" about="v-s:description" property="rdfs:label"></th>
            <th width="15%" about="v-s:created" property="rdfs:label"></th>
            <th about="v-wf:takenDecision" property="rdfs:label"></th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
      <button class="btn btn-default" id="refresh" about="v-s:RefreshBundle" property="rdfs:label"></button>
    </div>
  </div>
`;
