export const pre = async function (individual, template, container, mode, extra) {
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
  if (await individual.canUpdate()) {
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
  } else {
    editLink.remove();
  }

  async function lockHandler () {
    if (individual.hasValue('v-s:lockedDateTo') && Date.now() < individual['v-s:lockedDateTo'][0]) {
      $('a.edit-link', template).addClass('hide');
      $('.locked', template).removeClass('hide');
    } else {
      $('a.edit-link', template).removeClass('hide');
      $('.locked', template).addClass('hide');
    }
  }
  individual.on('v-s:lockedDateTo', lockHandler);
  template.one('remove', () => individual.off('v-s:lockedDateTo', lockHandler));
  lockHandler();

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
  <div class="margin-sm">
    <style scoped>
      a.disabled {
        color: inherit;
        pointer-events: none;
      }
    </style>
    <span class="label label-primary"></span>
    <sup class="text-success">new</sup>
    <a class="disabled download-link" href="/files/@"><span about="@" property="v-s:fileName"></span></a>
    <small><a href="#" class="edit-link" title="v-s:Edit"><span class="margin-md-h glyphicon glyphicon-edit"></span></a></small>
    <small class="locked"><a title="v-s:Locked"><span class="margin-md-h glyphicon glyphicon-lock"></span></a><span about="@" rel="v-s:lockedBy" data-template="v-ui:LabelTemplate"></small>
  </div>
`;
