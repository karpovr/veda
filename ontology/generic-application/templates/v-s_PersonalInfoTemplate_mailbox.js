import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);
  const address = 'mailto:' + individual['v-s:mailbox'][0];
  $('a', template).attr('href', address);
};

export const html = `
  <span>
    <a class="view -edit -search" about="@" property="v-s:mailbox"></a>
    <veda-control property="v-s:mailbox" data-type="string" class="-view edit search"></veda-control>
  </span>
`;
