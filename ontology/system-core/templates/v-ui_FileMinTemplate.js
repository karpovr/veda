export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function newHandler () {
    if (individual.isNew()) {
      $('a', template).removeAttr('href').addClass('disabled');
    } else {
      $('a', template).attr('href', `/files/${individual.id}`).removeClass('disabled');;
      $('sup', template).remove();
    }
  }
  individual.one('afterSave', newHandler);
  template.one('remove', () => individual.off('afterSave', newHandler));
  newHandler();

  if (individual.hasValue('v-s:valid', false)) {
    $('a', template).addClass('invalid');
  }
  const fn = individual['v-s:fileName'][0];
  const idx = fn.lastIndexOf('.');
  const ext = fn.substr(idx + 1);
  $('.label', template).text(ext);
};
export const html = `
  <div>
    <style scoped>
      a.disabled {
        color: inherit;
        pointer-events: none;
      }
    </style>
    <span class="label label-primary"></span>
    <sup class="text-success">new</sup>
    <a class="disabled"><span about="@" property="v-s:fileName"></span></a>
  </div>
`;
