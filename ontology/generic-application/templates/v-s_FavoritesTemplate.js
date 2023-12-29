import IndividualModel from '/js/common/individual_model.js';
import {delegateHandler, clear} from '/js/browser/dom_helpers.js';
import Sha256 from 'sha256';

async function createDefaultFavoritesFolder () {
  try {
    if (veda.user.aspect.hasValue('v-s:hasFavoriteFolder')) return;

    const defaultFavoritesFolder = new IndividualModel();
    defaultFavoritesFolder['rdf:type'] = 'v-s:Folder';
    defaultFavoritesFolder['rdfs:label'] = ['Избранное^ru', 'Favorites^en'];
    await defaultFavoritesFolder.save();

    await veda.user.aspect.addValue('v-s:hasFavoriteFolder', defaultFavoritesFolder);
    await veda.user.aspect.save();
  } catch (error) {
    console.error('Ошибка при создании папки Избранное:', error);
    alert('Произошла ошибка при создании папки Избранное. Пожалуйста, попробуйте еще раз.');
  }
}

export const pre = async function (individual, template, container, mode, extra) {
  await createDefaultFavoritesFolder();

  setDragDrop(template);

  delegateHandler(template, 'click', '.content .delete', async function (e) {
    e.preventDefault();
    const folderUri = this.closest('[typeof="v-s:Folder"]').getAttribute('resource');
    const folder = new IndividualModel(folderUri);
    const resourceUri = this.closest('[resource]').getAttribute('resource');
    const resource = new IndividualModel(resourceUri);
    try {
      await folder.removeValue('v-s:hasItem', resource);
      await folder.save();
      await resource.remove();
    } catch (error) {
      console.log('Ошибка удаления объекта:', error);
      alert('Ошибка удаления объекта: ' + error.message);
    }
  }, true);

  delegateHandler(template, 'click', '.folder-name', async function (e) {
    const folderUri = this.getAttribute('about');
    individual['v-s:chosenFavoriteFolder'] = folderUri;
    try {
      await individual.save();
    } catch (error) {
      console.log('Ошибка выбора папки:', error);
      alert('Произошла ошибка при выборе папки. Пожалуйста, попробуйте еще раз.');
    }
  }, true);

  delegateHandler(template, 'click', '.add-current', async function () {
    try {
      const current = await getCurrent();
      if (!current) return;

      const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);

      const defaultFavoritesFolder = veda.user.aspect['v-s:hasFavoriteFolder'][0];
      await removeFavorite(subscriptionId, defaultFavoritesFolder);

      const folderUri = this.closest('[resource]').getAttribute('resource');
      const folder = new IndividualModel(folderUri);
      await folder.load();

      const subscription = new IndividualModel(subscriptionId);
      subscription['rdf:type'] = 'v-s:Subscription';
      subscription['v-s:onDocument'] = current;
      subscription['v-s:creator'] = veda.user;
      await subscription.save();

      await folder.addValue('v-s:hasItem', subscription);
      await folder.save();
    } catch (error) {
      console.log('Ошибка при добавлении объекта в папку:', error);
      alert('Произошла ошибка при добавлении объекта в папку. Пожалуйста, попробуйте еще раз.');
    }
  }, true);
};

async function getCurrent () {
  const hash = window.location.hash;
  const current_uri = hash ? decodeURI(hash).slice(2).split('/')[0] : '';
  const re = /^(\w|-)+:.*?$/;
  if (!re.test(current_uri)) return;
  const current = new IndividualModel(current_uri);
  try {
    await current.load();
    return current;
  } catch (error) {
    console.log('Error loading current individual', error);
  }
}

async function removeFavorite (favorite, folder) {
  await folder.load();
  await folder.removeValue('v-s:hasItem', favorite);
  await folder.save();
  for (const childFolder of folder['v-s:hasFolder']) {
    await removeFavorite(favorite, childFolder);
  }
}

export const post = async function (individual, template, container, mode, extra) {
  const contentsEl = template.querySelector('.content');
  async function chosenFolderHandler () {
    clear(contentsEl);
    template.querySelector('.folder-name.active')?.classList.remove('active');
    let chosen;
    if (!individual.hasValue('v-s:chosenFavoriteFolder')) {
      chosen = individual['v-s:hasFavoriteFolder'][0];
    } else {
      chosen = individual['v-s:chosenFavoriteFolder'][0];
    }
    await chosen.present(contentsEl, folderTemplate);
    template.querySelector(`.folder-name[about="${chosen.id}"]`)?.classList.add('active');
  }
  individual.on('v-s:chosenFavoriteFolder', chosenFolderHandler);
  template.addEventListener('remove', () => individual.off('v-s:chosenFavoriteFolder', chosenFolderHandler));
  await chosenFolderHandler();
};

const folderTemplate = `
  <div>
    <ol rel="v-s:hasItem" class="folder-content">
      <li class="padding-sm" style="border-bottom:1px dotted #eee;" draggable="true">
        <style scoped>
          .item-actions {
            cursor: pointer;
            width:2em;
            height:2em;
            border-radius:2em;
          }
          .item-actions > span {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
          .item-actions:hover {
            background-color:#eee;
          }
        </style>
        <div style="display:flex;">
          <div style="flex-grow:1;" about="@" rel="v-s:onDocument">
            <a href="#/@" about="@" data-template="v-ui:ClassNameLabelTemplate" draggable="false"></a>
          </div>
          <div class="dropdown pull-right">
            <div class="item-actions dropdown-toggle" data-toggle="dropdown">
              <span class="glyphicon glyphicon-option-vertical"></span>
            </div>
            <ul class="dropdown-menu">
              <li><a class="delete" href="#" about="v-s:Delete" property="rdfs:label"></a></li>
            </ul>
          </div>
        </div>
      </li>
    </ol>
    <div><i class="text-muted margin-xl-h"><small>Избранные документы можно перемещать по папкам, используя перетаскивание</small></i></div>
    <!--button class="add-current btn btn-default margin-xl-h margin-md">Добавить текущий объект</button-->
  <div>
`;

function setDragDrop (template) {
  delegateHandler(template, 'dragstart', '[resource][draggable="true"]', dragstartHandler);

  delegateHandler(template, 'dragenter', '.droppable', dragenterHandler);
  delegateHandler(template, 'dragover', '.droppable', dragenterHandler);
  delegateHandler(template, 'dragleave', '.droppable', dragleaveHandler);

  delegateHandler(template, 'dragend', '[resource][draggable="true"]', dragendHandler);
  delegateHandler(template, 'drop', '.droppable', dragendHandler);
  delegateHandler(template, 'drop', '.droppable', dropHandler);

  function dragenterHandler (e) {
    if (e.dataTransfer.types.includes('veda/uri')) {
      e.preventDefault();
      this.style.outline = '2px solid #888';
    }
  }

  function dragleaveHandler (e) {
    this.style.outline = '2px solid #eee';
  }

  function dragstartHandler (e) {
    [...template.querySelectorAll('.droppable')].forEach((droppable) => droppable.style.outline = '2px solid #eee');
    const resource = this.getAttribute('resource');
    const relEl = this.closest('[rel]');
    if (relEl) {
      const rel = relEl.getAttribute('rel');
      e.dataTransfer.setData('veda/rel', rel);
      const sourceEl = relEl.closest('[resource]');
      if (sourceEl) {
        const source = sourceEl.getAttribute('resource');
        e.dataTransfer.setData('veda/source', source);
      }
    }
    e.dataTransfer.setData('veda/uri', resource);
    e.dataTransfer.effectAllowed = 'move';
  }

  function dragendHandler (e) {
    [...template.querySelectorAll('.droppable')].forEach((droppable) => droppable.style.outline='none');
  }

  async function dropHandler (e) {
    const subscriptionUri = e.dataTransfer.getData('veda/uri');
    const subscription = new IndividualModel(subscriptionUri);
    if (!subscription.hasValue('rdf:type', 'v-s:Subscription')) return;

    const sourceUri = e.dataTransfer.getData('veda/source');
    const source = new IndividualModel(sourceUri);
    const sourceRel = e.dataTransfer.getData('veda/rel');
    const targetUri = e.target.closest('[resource]').getAttribute('resource');
    const target = new IndividualModel(targetUri);
    if (source === target) return;
    if (target.hasValue('rdf:type', 'v-s:Folder')) {
      if (!target.hasValue('v-s:hasItem', subscription)) {
        const values = target.get('v-s:hasItem');
        values.unshift(subscription);
        target.set('v-s:hasItem', values);
      }
    } else if (target.hasValue('rdf:type', 'v-s:PersonalAspect')) {
      if (!target.hasValue('v-s:hasFavorite', subscription)) {
        const values = target.get('v-s:hasFavorite');
        values.unshift(subscription);
        target.set('v-s:hasFavorite', values);
      }
    }
    await source.removeValue(sourceRel, subscription);
    try {
      await target.save();
      await source.save();
    } catch (error) {
      console.log(error);
      alert('Ошибка записи объекта: ' + error.message);
    }
  }
}

export const html = `
<div class="container">
  <h4 class="text-center" style="text-transform: uppercase">
    <i class="fa fa-star text-muted margin-md-h"></i><span about="v-s:Favorites" property="rdfs:label"></span>
  </h4>
  <ol rel="v-s:hasFavorite" class="columns-3 no-margin">
    <li draggable="true">
      <div rel="v-s:onDocument" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
    </li>
  </ol>
  <hr class="margin-lg" />
  <div class="row">
    <div class="col-lg-4 col-12">
      <div class="folders-list">
        <ul style="margin:0;" class="folders-tree" about="@" rel="v-s:hasFavoriteFolder" data-template="v-s:FavoriteFolderTreeTemplate"></ul>
      </div>
    </div>
    <div class="col-lg-8 col-12">
      <div class="content"></div>
    </div>
  </div>
</div>
`;
