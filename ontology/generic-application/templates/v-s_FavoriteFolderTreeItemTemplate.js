export const pre = async function (individual, template, container, mode, extra) {
  const arrow = template.querySelector('.arrow');
  function showHideArrow () {
    if (individual.hasValue('v-s:hasFolder')) {
      arrow.classList.remove('hide');
    } else {
      arrow.classList.add('hide');
    }
  }
  individual.on('v-s:hasFolder', showHideArrow);
  template.addEventListener('remove', () => individual.off('v-s:hasFolder', showHideArrow));
  showHideArrow();

  const subFolder = template.querySelector('.sub-folder');
  arrow.addEventListener('click', () => {
    arrow.classList.toggle('arrow-right');
    arrow.classList.toggle('arrow-down');
    subFolder.classList.toggle('hide');
  });
};

export const html = `
  <li>
    <div class="folder">
      <div class="arrow arrow-down"></div>
      <div class="folder-name droppable" about="@" data-template="v-ui:LabelTemplate"></div>
      <div class="dropdown">
        <div class="folder-actions dropdown-toggle" data-toggle="dropdown">
          <span class="glyphicon glyphicon-option-vertical"></span>
        </div>
        <ul class="dropdown-menu">
          <li><a class="create" href="#">Создать папку</a></li>
          <li><a class="rename" href="#">Переименовать</a></li>
          <li><a class="delete" href="#">Удалить</a></li>
        </ul>
      </div>
    </div>
    <ul class="sub-folder" about="@" rel="v-s:hasFolder" data-template="v-s:FavoriteFolderTreeItemTemplate"></ul>
  </li>
`;
