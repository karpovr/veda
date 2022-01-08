import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var fn = individual['v-s:fileName'][0],
    idx = fn.lastIndexOf('.'),
    ext = fn.substr(idx + 1);
  $('span#icon', template).text(ext);
};

export const html = `
  <div class="panel panel-default" style="word-wrap:break-word; display: inline-block; margin:5px 5px 0 0; overflow: hidden">
    <div class="panel-body" style="padding:7px;">
      <span id="icon" class="label label-primary"></span>
      <a href="/files/@">
        <span about="@" property="v-s:fileName"></span>
      </a>
    </div>
  </div>
`;
