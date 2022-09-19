import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const fn = individual['v-s:fileName'][0];
  const idx = fn.lastIndexOf('.');
  const ext = fn.substr(idx + 1);
  $('span#icon', template).text(ext);
};

export const html = `
  <div class="panel panel-default" style="word-wrap:break-word; display: inline-block; margin:5px 5px 0 0; overflow: hidden">
    <div class="panel-body" style="padding:7px;">
      <span id="icon" class="label label-primary"></span>
      <span class="-view edit search" about="@" property="v-s:fileName"></span>
      <a class="view -edit -search" href="/files/@">
        <span about="@" property="v-s:fileName"></span>
      </a>
    </div>
  </div>
`;
