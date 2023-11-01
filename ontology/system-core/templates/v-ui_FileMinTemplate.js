export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('v-s:valid', false)) {
    $('a', template).addClass('invalid');
  }
  const fn = individual['v-s:fileName'][0];
  const idx = fn.lastIndexOf('.');
  const ext = fn.substr(idx + 1);
  $('.label', template).text(ext);

  const editLink = $('a.edit-link', template);
  const base = `${location.origin}/webdav/${veda.ticket}`;
  if ('docx|odt'.includes(ext)) {
    editLink.attr('href', `ms-word:ofe|u|${base}/${individual.id.replace(':', '_')}/${fn}`);
  } else if ('xlsx|ods'.includes(ext)) {
    editLink.attr('href', `ms-excel:ofe|u|${base}/${individual.id.replace(':', '_')}/${fn}`);
  } else if ('pptx|odp'.includes(ext)) {
    editLink.attr('href', `ms-powerpoint:ofe|u|${base}/${individual.id.replace(':', '_')}/${fn}`);
  } else {
    editLink.remove();
  }

  function newHandler () {
    if (individual.isNew()) {
      $('a', template).addClass('disabled');
      $('a.edit-link', template).addClass('hidden');
    } else {
      $('a', template).removeClass('disabled');
      $('a.edit-link', template).removeClass('hidden');
      $('sup', template).remove();
    }
  }
  individual.one('afterSave', newHandler);
  template.one('remove', () => individual.off('afterSave', newHandler));
  newHandler();
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
    <a class="disabled download-link" href="/files/@"><span about="@" property="v-s:fileName"></span></a>
    <a href="#" class="edit-link margin-sm-h"><span class="fa fa-lg fa-pencil-square-o"></span></a>
  </div>
`;
