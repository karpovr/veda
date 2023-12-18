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
        const title = template.hasClass('fa-star') ? new IndividualModel('v-s:RemoveFromFavorites') : new IndividualModel('v-s:AddToFavorites');
        await title.load();
        template.find('.tooltip-inner').text(title.toString());
        return title.toString();
      },
    })
    .click(async function (e) {
      e.preventDefault();
      const current = await getCurrent(location.hash);
      if (!current) return;
      // Create default favorites folder
      if (!veda.user.aspect.hasValue('v-s:hasFavoriteFolder')) {
        const folder = new IndividualModel();
        folder['rdf:type'] = 'v-s:Folder';
        folder['rdfs:label'] = ['Избранное^ru', 'Favorites^en'];
        await folder.save();
        await veda.user.aspect.addValue('v-s:hasFavoriteFolder', folder);
        await veda.user.aspect.save();
      }
      const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);
      const favoritesFolder = veda.user.aspect['v-s:hasFavoriteFolder'][0];
      try {
        if (await isFavorite(subscriptionId, favoritesFolder)) {
          const subscription = new IndividualModel(subscriptionId);
          await removeFavorite(subscription, favoritesFolder);
          await subscription.remove();
        } else {
          const subscription = new IndividualModel();
          subscription.id = subscriptionId;
          subscription['rdf:type'] = [new IndividualModel('v-s:Subscription')];
          subscription['v-s:onDocument'] = [current];
          subscription['v-s:creator'] = [veda.user];
          await subscription.save();
          await favoritesFolder.addValue('v-s:hasItem', subscription);
          await favoritesFolder.save();
        }
        await indicateFavorite();
      } catch (error) {
        console.error('Update user aspect failed', error);
        alert('Ошибка добаления избранного: ' + error.message);
      }
    })
    .click(() => subscriptionDialog());

  async function indicateFavorite () {
    const current = await getCurrent(location.hash);
    if (!current) return;
    const isJournaling = await current.is('v-s:Journaling');
    if (isJournaling) {
      const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);
      template.show();
      if (await isFavorite(subscriptionId, veda.user.aspect['v-s:hasFavoriteFolder'][0])) {
        template.addClass('fa-star').removeClass('fa-star-o');
      } else {
        template.removeClass('fa-star').addClass('fa-star-o');
      }
    } else {
      template.hide();
    }
  }
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
  let result = false;
  await folder.load();
  if (folder.hasValue('v-s:hasItem', favorite)) return true;
  for (const childFolder of folder['v-s:hasFolder']) {
    result = result || await isFavorite(favorite, childFolder);
    if (result) break;
  }
  return result;
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

export const html = `
  <a href="#" class="fa fa-lg" style="display:none;"></a>
`;

const dialogTemplate = `
  <dialog class="dialog" style="border: 2px solid gray; border-radius: 0.5em; min-width:20em;">
    <form class="form" method="dialog">
      <div class="form-group">
        <label>Выберите папку</label>
        <select class="select-folder form-control"></select>
      </div>
      <veda-control data-type="link" rel="v-s:itemOf" data-tree-root=""></veda-control>
      <button type="submit" class="submit-folder btn btn-primary">Ok</button>
      <button type="button" class="cancel-folder btn btn-default">Удалить</button>
    </form>
  </dialog>
`;

async function subscriptionDialog (subscription) {
  const container = document.createElement('div');
  container.innerHTML = dialogTemplate;
  document.body.appendChild(container);
  const dialog = container.querySelector('.dialog');
  const select = container.querySelector('.select-folder');
  const submit = container.querySelector('.submit-folder');
  const cancel = container.querySelector('.cancel-folder');
  const folders = await getFavoriteFolders(veda.user.aspect['v-s:hasFavoriteFolder'][0]);
  for (const folder of folders) {
    const option = document.createElement('option');
    option.value = folder.id;
    option.label = folder['rdfs:label'].map(CommonUtil.formatValue).filter(Boolean);
    select.appendChild(option);
  }
  select.addEventListener('change', () => submit.value = select.value);
  dialog.addEventListener('close', async () => {
    const folder = dialog.returnValue;
    document.body.removeChild(container);
    // payload
  });
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  cancel.addEventListener('click', () => {
    submit.value = '';
    dialog.close();
  });
  submit.value = select.value;
  dialog.returnValue = '';
  dialog.showModal();
}

