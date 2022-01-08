import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('a', template).attr('href', 'mailto:' + individual['v-s:mailbox'][0]);
};

export const html = `
  <span>
    <a class="view -edit -search" about="@" property="v-s:mailbox"></a>
    <veda-control property="v-s:mailbox" data-type="string" class="-view edit search"></veda-control>
  </span>
`;
