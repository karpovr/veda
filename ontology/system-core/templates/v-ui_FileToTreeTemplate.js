export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);
  if (individual.hasValue('v-s:valid', false)) {
    $('a', template).remove();
  }
}
export const html = `
  <div>
    <span class="-view edit search" about="@" property="v-s:fileName"></span>
    <a class="view -edit -search" href="/files/@">
      <span about="@" property="v-s:fileName"></span>
    </a>
  </div>
`;
