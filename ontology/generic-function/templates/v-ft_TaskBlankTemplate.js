import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const folder = decodeURIComponent(location.hash).substr(2).split('/')[0];
  $('#folder', template).attr('about', folder);
  $('#box-tabs', template)
    .find('a')
    .filter(function () {
      return this.hash.substr(2) === folder;
    })
    .parent()
    .addClass('active');

  if (folder === 'v-ft:Inbox' || folder === 'v-ft:Completed') {
    $('.to', template).remove();
    $('.advanced_from', template).remove();
  } else {
    $('.from', template).remove();
    $('.advanced_to', template).remove();
  }
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.advanced) {
    $('.advanced-search', template).removeClass('hidden');
  }
  $('.advanced-toggle', template).click(function (e) {
    e.preventDefault();
    individual.advanced = !individual.advanced;
    if (individual.advanced) {
      $('.advanced-search', template).removeClass('hidden');
    } else {
      $('.advanced-search', template).addClass('hidden');
    }
  });
};

export const html = `
  <div>
    <br />
    <ul id="box-tabs" class="nav nav-tabs nav-right" role="tablist">
      <li class="pull-left"><h2 id="folder" class="no-margin" property="rdfs:label"></h2></li>
      <li role="presentation"><a href="#/v-ft:OutboxCompleted" about="v-ft:OutboxCompleted" property="rdfs:label"></a></li>
      <li role="presentation"><a href="#/v-ft:Completed" about="v-ft:Completed" property="rdfs:label"></a></li>
      <li role="presentation"><a href="#/v-ft:Outbox" about="v-ft:Outbox" property="rdfs:label"></a></li>
      <li role="presentation"><a href="#/v-ft:Inbox" about="v-ft:Inbox" property="rdfs:label"></a></li>
    </ul>
    <br />
    <div about="@" data-template="v-ft:ActorFilterTemplate"></div>
    <div class="row">
      <div class="col-md-4 from">
        <em about="v-wf:from" property="rdfs:label"></em>
        <veda-control property="v-wf:from" data-single="true" data-delegated="true" data-actor-type="v-s:Person v-s:Position" data-type="actor"></veda-control>
      </div>
      <div class="col-md-4 to">
        <em about="v-wf:to" property="rdfs:label"></em>
        <veda-control property="v-wf:to" data-single="true" data-delegated="true" data-actor-type="v-s:Person v-s:Position" data-type="actor"></veda-control>
      </div>
      <div class="col-md-8" about="@" rel="v-wf:onDocument" data-template="v-ft:TaskBlankTemplate_onDocument"></div>
    </div>
    <small
      class="advanced-toggle text-muted"
      about="v-fs:AdvancedSearchBundle"
      property="rdfs:label"
      style="border-bottom:1px dashed #707070; cursor:pointer;"></small>
    <div class="advanced-search hidden">
      <div class="row">
        <div class="col-md-4">
          <em about="v-s:description" property="rdfs:label"></em>
          <veda-control property="rdfs:label" data-type="string"></veda-control>
        </div>
        <div class="col-md-4">
          <em about="v-s:created" property="rdfs:label"></em>
          <veda-control property="v-s:created" data-type="date"></veda-control>
          <div property="v-s:created"></div>
        </div>
        <div class="col-md-4">
          <em about="v-wf:dateGiven" property="rdfs:label"></em>
          <veda-control property="v-wf:dateGiven" data-type="date"></veda-control>
          <div property="v-wf:dateGiven"></div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-4" about="@" data-embedded="true" rel="v-wf:takenDecision">
          <div>
            <em about="v-ft:DecisionDateBundle" property="rdfs:label"></em>
            <veda-control property="v-s:created" data-type="date"></veda-control>
            <div property="v-s:created"></div>
          </div>
        </div>
        <div class="col-md-4 advanced_from">
          <em about="v-wf:from" property="rdfs:label"></em>
          <veda-control property="v-wf:from" data-single="true" data-delegated="true" data-actor-type="v-s:Person v-s:Position" data-type="actor"></veda-control>
        </div>
        <div class="col-md-4 advanced_to">
          <em about="v-wf:to" property="rdfs:label"></em>
          <veda-control property="v-wf:to" data-single="true" data-delegated="true" data-actor-type="v-s:Person v-s:Position" data-type="actor"></veda-control>
        </div>
      </div>
    </div>
  </div>
`;
