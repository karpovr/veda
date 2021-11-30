import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  $("#exp", template).click(function (e) {
    e.preventDefault();
    $("div[rel='v-s:subJournal']", template).toggle();
    $(this).children(":first").toggleClass("glyphicon-chevron-down glyphicon-chevron-right");
  });
};

export const html = `
<div class="journal-record">
  <hr class="margin-sm">
  <div class="row">
    <div class="col-md-2 col-sm-3 event-type">
      <a id="exp" href="#"><span class="glyphicon glyphicon-chevron-down"></span></a>
      <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
    </div>
    <div class="col-md-8 col-sm-6 event-desc">
      <span about="@" property="rdfs:label"></span>
    </div>
    <div class="col-md-2 col-sm-3 event-date text-right">
      <span about="@" property="v-s:created"></span>
    </div>
  </div>
  <div about="@" rel="v-s:subJournal" data-template="v-ui:SubJournalTemplate"></div>
</div>
`;