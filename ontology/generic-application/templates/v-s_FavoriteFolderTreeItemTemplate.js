export const pre = async function (individual, template, container, mode, extra) {
  const folderState = template.querySelector('.folder-state');
  function showHideFolderState () {
    if (individual.hasValue('v-s:hasFolder')) {
      folderState.classList.remove('hide');
    } else {
      folderState.classList.add('hide');
    }
  }
  individual.on('v-s:hasFolder', showHideFolderState);
  template.addEventListener('remove', () => individual.off('v-s:hasFolder', showHideFolderState));
  showHideFolderState();

  const subFolder = template.querySelector('.sub-folder');
  folderState.addEventListener('click', () => {
    folderState.classList.toggle('folder-state-closed');
    folderState.classList.toggle('folder-state-opened');
    subFolder.classList.toggle('hide');
  });
};

export const html = `
  <li>
    <div class="folder">
      <div class="folder-state folder-state-opened"></div>
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
