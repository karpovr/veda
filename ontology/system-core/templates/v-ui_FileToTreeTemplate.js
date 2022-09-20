export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);
  if (individual.hasValue('v-s:valid', false)) {
    $('a', template).remove();
  }
}
export const html = `
  <div>
    <a href="/files/@">
      <span about="@" property="v-s:fileName"></span>
    </a>
  </div>
`;
