import IndividualModel from '/js/common/individual_model.js';
import {delegateHandler} from '/js/browser/dom_helpers.js';

export const post = async function (individual, template, container, mode, extra) {
  delegateHandler(template, 'click', '.create', async function (e) {
    e.preventDefault();
    const folderUri = this.closest('[resource]').getAttribute('resource');
    const folder = new IndividualModel(folderUri);
    const label = prompt('Введите название', 'Новая папка');
    if (label) {
      const subFolder = new IndividualModel;
      subFolder['rdf:type'] = 'v-s:Folder';
      subFolder['rdfs:label'] = label;
      try {
        await subFolder.save();
        await folder.addValue('v-s:hasFolder', subFolder);
        await folder.save();
      } catch (error) {
        console.log(error);
        alert('Ошибка записи объекта: ' + error.message);
      }
    }
  }, true);

  delegateHandler(template, 'click', '.rename', async function (e) {
    e.preventDefault();
    const resourceUri = this.closest('[resource]').getAttribute('resource');
    const resource = new IndividualModel(resourceUri);
    const label = prompt('Введите название', resource.toString());
    if (label) {
      resource['rdfs:label'] = label;
      try {
        await resource.save();
      } catch (error) {
        console.log(error);
        alert('Ошибка записи объекта: ' + error.message);
      }
    }
  }, true);

  delegateHandler(template, 'click', '.delete', async function (e) {
    e.preventDefault();
    const parentFolderUri = this.closest('[resource]').parentNode.closest('[resource]').getAttribute('resource');
    const parentFolder = new IndividualModel(parentFolderUri);
    const folderUri = this.closest('[resource]').getAttribute('resource');
    const folder = new IndividualModel(folderUri);
    if (confirm('Вы дествительно хотите удалить объект?')) {
      try {
        await parentFolder.removeValue(undefined, folder);
        await parentFolder.save();
        await removeFolder(folder);
      } catch (error) {
        console.log(error);
        alert('Ошибка удаления объекта: ' + error.message);
      }
    }
  }, true);

  const folderState = template.querySelector('.folder-state');
  const folderCount = template.querySelector('.folder-count');
  function showHideFolderState () {
    if (individual.hasValue('v-s:hasFolder')) {
      folderState.classList.remove('hide');
    } else {
      folderState.classList.add('hide');
    }
    folderCount.textContent = individual['v-s:hasItem'].length;
  }
  individual.on('v-s:hasFolder', showHideFolderState);
  individual.on('v-s:hasItem', showHideFolderState);
  template.addEventListener('remove', () => {
    individual.off('v-s:hasFolder', showHideFolderState);
    individual.off('v-s:hasItem', showHideFolderState);
  });
  showHideFolderState();

  const subFolder = template.querySelector('.sub-folder');
  folderState.addEventListener('click', () => {
    folderState.classList.toggle('folder-state-closed');
    folderState.classList.toggle('folder-state-opened');
    subFolder.classList.toggle('hide');
  });
};

async function removeFolder (folder) {
  await Promise.all(folder['v-s:hasItem'].map((item) => item.remove()));
  await Promise.all(folder['v-s:hasFolder'].map((folder) => removeFolder(folder)));
  await folder.remove();
}

export const html = `
  <li>
    <style scoped>
      .folders-tree ul.sub-folder {
        padding-top:0.5em;
        padding-bottom:0.5em;
        padding-left:2em;
      }
      .folders-tree ul.sub-folder:empty {
        display:none;
      }
      .folders-tree li {
        list-style-type:none;
        position:relative;
      }
      .folders-tree .folder {
        display: flex;
        align-items: center;
      }
      .folders-tree .folder-name {
        border-radius:2em;
        padding: 0.5em;
        flex-grow: 1;
      }
      .folders-tree .folder-name.active {
        background-color:#337ab7;
        color:white;
      }
      .folders-tree .folder-name:not(.active):hover {
        border-radius:2em;
        background-color:#eee;
        cursor: pointer;
      }
      .folders-tree .folder-state-closed, .folders-tree .folder-state-opened {
        border-radius:2em;
        cursor: pointer;
        width: 2em;
        height: 2em;
        position: absolute;
        left: -2em;
        color: black;
      }
      .folders-tree .folder-state-closed::before, .folders-tree .folder-state-opened::before {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .folders-tree .folder-state-opened::before {
        content: "▼";
      }
      .folders-tree .folder-state-closed::before {
        content: "►";
      }
      .folders-tree .folder-state:hover {
        background-color:#eee;
      }
      .folders-tree .folder-actions {
        cursor: pointer;
        width:2em;
        height:2em;
        border-radius:2em;
      }
      .folders-tree .folder-actions > span {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .folders-tree .folder-actions:hover {
        background-color:#eee;
      }
    </style>
    <div class="folder">
      <div class="folder-state folder-state-opened"></div>
      <div class="folder-name droppable" about="@">
        <div>
          <span about="@" property="rdfs:label"></span>
          <div class="folder-count pull-right"></div>
        </div>
      </div>
      <div class="dropdown">
        <div class="folder-actions dropdown-toggle" data-toggle="dropdown">
          <span class="glyphicon glyphicon-option-vertical"></span>
        </div>
        <ul class="dropdown-menu">
          <li><a class="create" href="#">Создать папку</a></li>
          <li><a class="rename" href="#">Переименовать</a></li>
        </ul>
      </div>
    </div>
    <ul class="sub-folder" about="@" rel="v-s:hasFolder" data-template="v-s:FavoriteFolderTreeItemTemplate"></ul>
  </li>
`;
