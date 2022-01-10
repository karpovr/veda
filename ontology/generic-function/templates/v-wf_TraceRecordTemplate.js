import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const pre = $('pre', template);
  const txt = pre.text();
  const re = new RegExp('"([w-]+:[w-]+)"', 'g');
  const txt2 = txt.replace(re, "<a href='#/$1'>'$1'</a>");
  pre.html(txt2);
};

export const html = `
  <div class="journal-record">
    <style>
      pre {
        font-size: 10px;
      }
    </style>
    <hr class="margin-sm" />
    <div class="row">
      <div class="col-md-2 col-sm-3 event-type">
        <span property="rdfs:label"></span>
      </div>
      <div class="col-md-8 col-sm-6 event-desc">
        <pre property="rdfs:comment"></pre>
      </div>
      <div class="col-md-2 col-sm-3 event-date text-right">
        <span about="@" property="v-s:created"></span>
      </div>
    </div>
  </div>
`;
