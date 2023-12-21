import $ from 'jquery';
import veda from '/js/common/veda.js';
import Sha256 from 'sha256';
import IndividualModel from '/js/common/individual_model.js';
import CommonUtil from '/js/common/util.js';
import riot from 'riot';

export const pre = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  riot.route(indicateFavorite);

  template
    .tooltip({
      container: template,
      placement: 'bottom',
      trigger: 'hover',
      title: async function () {
        const title = template.hasClass('fa-star') ?
          new IndividualModel('v-s:RemoveFromFavorites') :
          new IndividualModel('v-s:AddToFavorites');
        try {
          await title.load();
          template.find('.tooltip-inner').text(title.toString());
          return title.toString();
        } catch (error) {
          console.error('Ошибка загрузки подсказки:', error);
          return 'Ошибка загрузки подсказки';
        }
      },
    })
    .click(showSubscriptionDialog);

  async function indicateFavorite () {
    try {
      const current = await getCurrent(location.hash);
      if (!current) return;
      const isJournaling = await current.is('v-s:Journaling');
      template.toggle(isJournaling);
      if (isJournaling) {
        const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);
        const isFavoriteFolder = await isFavorite(subscriptionId, veda.user.aspect['v-s:hasFavoriteFolder'][0]);
        template.toggleClass('fa-star', isFavoriteFolder).toggleClass('fa-star-o', !isFavoriteFolder);
      }
    } catch (error) {
      console.error('Произошла ошибка при индикации избранного:', error);
    }
  }

  async function showSubscriptionDialog (e) {
    try {
      e.preventDefault();

      const current = await getCurrent(location.hash);
      if (!current) return;

      await createDefaultFavoritesFolder();

      const favoritesFolder = veda.user.aspect['v-s:hasFavoriteFolder'][0];
      const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);

      const container = document.createElement('div');
      container.innerHTML = dialogTemplate;
      document.body.appendChild(container);
      const dialog = container.querySelector('.dialog');
      const select = container.querySelector('.select-folder');
      const submit = container.querySelector('.submit-folder');
      const cancel = container.querySelector('.cancel-folder');
      const remove = container.querySelector('.remove-favorite');

      const addFolderBtn = container.querySelector('.add-folder-button');
      const addFolderDialog = container.querySelector('.add-folder-dialog');
      const addFolderNameInput = container.querySelector('.add-folder-name-input');
      const addFolderParentInput = container.querySelector('.add-folder-parent-input');
      const addFolderOkButton = container.querySelector('.add-folder-ok-button');
      const addFolderCancelButton = container.querySelector('.add-folder-cancel-button');

      addFolderBtn.addEventListener('click', () => {
        addFolderDialog.showModal();
      });

      addFolderOkButton.addEventListener('click', async () => {
        try {
          const parentFolderId = addFolderParentInput.value;
          const folderName = addFolderNameInput.value;

          if (!folderName) {
            alert('Введите имя новой папки.');
            return;
          }

          const newFolder = await createFolder(folderName, parentFolderId);

          const option = document.createElement('option');
          option.value = newFolder.id;
          option.label = folderName;
          select.appendChild(option);

          select.value = newFolder.id;
          submit.value = select.value;

          addFolderDialog.close();
        } catch (error) {
          console.error('Произошла ошибка при создании папки:', error);
          alert('Произошла ошибка при создании папки. Пожалуйста, попробуйте еще раз.');
        }
      });

      addFolderCancelButton.addEventListener('click', () => {
        addFolderDialog.close();
      });

      const favoriteFolders = await getFavoriteFolders(favoritesFolder);
      populateDropdown(addFolderParentInput, favoriteFolders);

      const folders = await getFavoriteFolders(veda.user.aspect['v-s:hasFavoriteFolder'][0]);
      populateDropdown(select, folders, subscriptionId);

      select.addEventListener('change', () => {
        submit.value = select.value;
      });

      dialog.addEventListener('close', async () => {
        try {
          if (!submit.value) {
            await indicateFavorite();
            document.body.removeChild(container);
            return;
          }
          await removeFavorite(subscriptionId, favoritesFolder);
          const folderId = dialog.returnValue;
          const folder = new IndividualModel(folderId);
          const subscription = new IndividualModel();
          subscription.id = subscriptionId;
          subscription['rdf:type'] = 'v-s:Subscription';
          subscription['v-s:onDocument'] = current;
          subscription['v-s:creator'] = veda.user;
          await subscription.save();
          await folder.addValue('v-s:hasItem', subscription);
          await folder.save();
          await indicateFavorite();
          document.body.removeChild(container);
        } catch (error) {
          console.error('Ошибка сохранения избранного:', error);
          alert('Произошла ошибка при сохранении избранного. Пожалуйста, попробуйте еще раз.');
        }
      });

      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
      });

      cancel.addEventListener('click', () => {
        submit.value = '';
        dialog.close();
      });

      remove.addEventListener('click', async () => {
        try {
          if (await isFavorite(subscriptionId, favoritesFolder)) {
            const subscription = new IndividualModel(subscriptionId);
            await removeFavorite(subscription, favoritesFolder);
            await subscription.remove();
          }
          submit.value = '';
          dialog.close();
        } catch (error) {
          console.error('Ошибка удаления избранного:', error);
          alert('Произошла ошибка при удалении избранного. Пожалуйста, попробуйте еще раз.');
        }
      });

      submit.value = select.value;
      dialog.returnValue = '';
      dialog.showModal();
    } catch (error) {
      console.error('Ошибка отображения диалога подписки:', error);
      alert('Произошла ошибка при отображении диалога подписки. Пожалуйста, попробуйте еще раз.');
    }
  }

  const dialogTemplate = `
    <dialog class="dialog" style="border: 2px solid gray; border-radius: 0.5em; min-width:30em;">
      <form class="form clearfix" method="dialog">
        <div class="form-group">
          <label>Выберите папку</label>
          <select class="select-folder form-control"></select>
        </div>
        <button type="submit" class="submit-folder btn btn-primary">Ok</button>
        <button type="button" class="remove-favorite btn btn-link" about="v-s:Delete" property="rdfs:label">Удалить</button>
        <button type="button" class="cancel-folder btn btn-default pull-right" about="v-s:Cancel" property="rdfs:label">Отмена</button>
        <button type="button" class="add-folder-button btn btn-default pull-right margin-sm-h">Создать папку</button>
      </form>

      <!-- Added dialog for creating a new folder -->
      <dialog class="add-folder-dialog" style="border: 2px solid gray; border-radius: 0.5em; min-width:30em;">
        <form class="add-folder-form">
          <div class="form-group">
            <label>Наименование</label>
            <input type="text" class="add-folder-name-input form-control" required>
          </div>
          <div class="form-group">
            <label>Родительская папка</label>
            <select class="add-folder-parent-input form-control"></select>
          </div>
          <div class="form-group text-right">
            <button type="button" class="add-folder-ok-button btn btn-primary">Ok</button>
            <button type="button" class="add-folder-cancel-button btn btn-default">Отмена</button>
          </div>
        </form>
      </dialog>
    </dialog>
  `;
};

async function getCurrent (hash) {
  const current_uri = hash ? decodeURI(hash).slice(2).split('/')[0] : '';
  const re = /^(\w|-)+:.*?$/;
  if (!re.test(current_uri)) return;
  let current = new IndividualModel(current_uri);
  await current.load();
  const isTask = current.hasValue('rdf:type', 'v-wf:DecisionForm');
  if (isTask) current = current['v-wf:onDocument'][0];
  return current;
}

async function isFavorite (favorite, folder) {
  if (!favorite || !folder) return false;
  await folder.load();
  if (folder.hasValue('v-s:hasItem', favorite)) return true;
  for (const childFolder of folder['v-s:hasFolder']) {
    if (await isFavorite(favorite, childFolder)) return true;
  }
  return false;
}

async function removeFavorite (favorite, folder) {
  await folder.load();
  await folder.removeValue('v-s:hasItem', favorite);
  await folder.save();
  for (const childFolder of folder['v-s:hasFolder']) {
    await removeFavorite(favorite, childFolder);
  }
}

async function getFavoriteFolders (folder, folders = []) {
  if (!folder) return folders;
  folders.push(folder);
  await folder.load();
  for (const childFolder of folder['v-s:hasFolder']) {
    await getFavoriteFolders(childFolder, folders);
  }
  return folders;
}

async function createDefaultFavoritesFolder () {
  if (veda.user.aspect.hasValue('v-s:hasFavoriteFolder')) return;
  const folder = new IndividualModel();
  folder['rdf:type'] = 'v-s:Folder';
  folder['rdfs:label'] = ['Избранное^ru', 'Favorites^en'];
  await folder.save();
  await veda.user.aspect.addValue('v-s:hasFavoriteFolder', folder);
  await veda.user.aspect.save();
}

async function createFolder (folderName, parentFolderId) {
  const newFolder = new IndividualModel();
  newFolder['rdf:type'] = 'v-s:Folder';
  newFolder['rdfs:label'] = [folderName];

  if (parentFolderId) {
    const parentFolder = new IndividualModel(parentFolderId);
    await parentFolder.load();
    parentFolder.addValue('v-s:hasFolder', newFolder);
    await parentFolder.save();
  }

  await newFolder.save();
  return newFolder;
}

function populateDropdown (select, folders, selectedFolderId) {
  for (const folder of folders) {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder['rdfs:label'].map(CommonUtil.formatValue).filter(Boolean);
    if (folder.id === selectedFolderId) option.selected = true;
    select.appendChild(option);
  }
}

export const html = `
  <a href="#" class="fa fa-lg" style="display:none;"></a>
`;
