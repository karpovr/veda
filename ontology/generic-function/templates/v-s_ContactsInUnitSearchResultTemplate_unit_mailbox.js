import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.attr('href', 'mailto:' + individual['v-s:mailbox'][0]);
};

export const html = ` <a class="view -edit -search" about="@" property="v-s:mailbox"></a> `;
