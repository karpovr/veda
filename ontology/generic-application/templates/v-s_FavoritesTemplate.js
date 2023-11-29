import IndividualModel from '/js/common/individual_model.js';
import {delegateHandler, clear} from '/js/browser/dom_helpers.js';

export const pre = async function (individual, template, container, mode, extra) {
  setDragDrop(template);

  const createFolderBtn = template.querySelector('.create-folder');
  createFolderBtn.addEventListener('click', async () => {
    const folder = new IndividualModel;
    folder['rdf:type'] = 'v-s:Folder';
    const label = prompt('Введите название', 'Новый список');
    if (label) {
      folder['rdfs:label'] = label;
      try {
        await folder.save();
        await individual.addValue('v-s:hasFavoriteFolder', folder);
        await individual.save();
      } catch (error) {
        console.log(error);
        alert('Ошибка записи объекта: ' + error.message);
      }
    }
  });

  delegateHandler(template, 'click', '.folders-list-item', async function (e) {
    const folderUri = this.getAttribute('resource');
    if (folderUri && folderUri === individual.id) {
      individual.clearValue('v-s:chosenFavoriteFolder');
    } else {
      individual['v-s:chosenFavoriteFolder'] = folderUri;
    }
    await individual.save();
  }, true);

  delegateHandler(template, 'click', '.folders-list-item .rename', async function (e) {
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

  delegateHandler(template, 'click', '.folders-list-item .delete', async function (e) {
    e.preventDefault();
    const folderUri = this.closest('[resource]').getAttribute('resource');
    const folder = new IndividualModel(folderUri);
    if (confirm('Вы дествительно хотите удалить объект?')) {
      try {
        await individual.removeValue(undefined, folder);
        await individual.save();
        await Promise.all(folder['v-s:hasItem'].map((item) => item.remove()));
        await folder.remove();
      } catch (error) {
        console.log(error);
        alert('Ошибка удаления объекта: ' + error.message);
      }
    }
  }, true);

  delegateHandler(template, 'click', '.content .delete', async function (e) {
    e.preventDefault();
    const parentUri = (this.closest('.folder-content') ?? this.closest('.favorites-list')).getAttribute('resource');
    const parent = new IndividualModel(parentUri);
    const resourceUri = this.closest('[resource]').getAttribute('resource');
    const resource = new IndividualModel(resourceUri);
    try {
      await parent.removeValue(undefined, resource);
      await parent.save();
      await resource.remove();
    } catch (error) {
      console.log(error);
      alert('Ошибка удаления объекта: ' + error.message);
    }
  }, true);
};

export const post = async function (individual, template, container, mode, extra) {
  const contentsEl = template.querySelector('.content');
  async function chosenFolderHandler () {
    template.querySelector('.folders-list .active')?.classList.remove('active');
    clear(contentsEl);
    if (individual.hasValue('v-s:chosenFavoriteFolder')) {
      const chosen = individual['v-s:chosenFavoriteFolder'][0];
      template.querySelector(`.folders-list [resource="${chosen.id}"]`)?.classList.add('active');
      await chosen.present(contentsEl, folderTemplate);
    } else {
      template.querySelector('.folders-list .root')?.classList.add('active');
      await individual.present(contentsEl, favoritesTemplate);
    }
  }
  individual.on('v-s:chosenFavoriteFolder', chosenFolderHandler);
  template.addEventListener('remove', () => individual.off('v-s:chosenFavoriteFolder', chosenFolderHandler));
  chosenFolderHandler();
};

const favoritesTemplate = `
  <ol rel="v-s:hasFavorite" class="favorites-list">
    <li class="padding-md" style="border-bottom:1px dotted #eee;" draggable="true">
      <div style="display:flex;">
        <div style="flex:auto;" about="@" rel="v-s:onDocument">
          <a style="display:block;" href="#/@" about="@" data-template="v-ui:ClassNameLabelTemplate" draggable="false"></a>
        </div>
        <div class="dropdown pull-right">
          <a href="" style="text-decoration:none; color:dimgray" class="options pull-right glyphicon glyphicon-option-vertical dropdown-toggle" data-toggle="dropdown"></a>
          <ul class="dropdown-menu">
            <li><a class="delete" href="#">Удалить</a></li>
          </ul>
        </div>
      </div>
    </li>
  </ol>
`;

const folderTemplate = `
  <ol rel="v-s:hasItem" class="folder-content">
    <li class="padding-md" style="border-bottom:1px dotted #eee;" draggable="true">
      <div style="display:flex;">
        <div style="flex:auto;" about="@" rel="v-s:onDocument">
          <a style="display:block;" href="#/@" about="@" data-template="v-ui:ClassNameLabelTemplate" draggable="false"></a>
        </div>
        <div class="dropdown pull-right">
          <a href="" style="text-decoration:none; color:dimgray;" class="options pull-right glyphicon glyphicon-option-vertical dropdown-toggle" data-toggle="dropdown"></a>
          <ul class="dropdown-menu">
            <li><a class="delete" href="#">Удалить</a></li>
          </ul>
        </div>
      </div>
    </li>
  </ol>
`;

function setDragDrop (template) {
  delegateHandler(template, 'dragstart', '[resource][draggable="true"]', dragstartHandler);

  delegateHandler(template, 'dragenter', '.droppable', dragenterHandler);
  delegateHandler(template, 'dragover', '.droppable', dragenterHandler);

  delegateHandler(template, 'dragend', '[resource][draggable="true"]', dragendHandler);
  delegateHandler(template, 'drop', '.droppable', dragendHandler);
  delegateHandler(template, 'drop', '.droppable', dropHandler);

  function dragenterHandler (e) {
    if (e.dataTransfer.types.includes('veda/uri')) {
      e.preventDefault();
    }
  }

  function dragstartHandler (e) {
    [...template.querySelectorAll('.droppable')].forEach((droppable) => droppable.style.outline='2px dashed green');
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
  <style scoped>
    /*.folders-list .folders-list-item:not(.active) .options {
      display: none;
    }
    .folders-list .folders-list-item.active .options {
      display: initial;
    }*/
  </style>
  <h4 class="text-center" style="text-transform: uppercase">
    <i class="fa fa-star text-muted margin-md-h"></i><span about="v-s:Favorites" property="rdfs:label"></span>
  </h4>
  <hr class="margin-lg" />
  <div class="row">
    <div class="col-lg-3 col-12">
      <div class="list-group folders-list" style="position:stiky;">
        <div about="@">
          <button class="list-group-item folders-list-item root droppable">Прочие</button>
        </div>
        <div rel="v-s:hasFavoriteFolder">
          <button class="list-group-item folders-list-item droppable" about="@">
            <div>
              <span about="@" data-template="v-ui:LabelTemplate"></span>
              <div class="dropdown pull-right">
                <span class="options pull-right glyphicon glyphicon-option-vertical dropdown-toggle" data-toggle="dropdown"></span>
                <ul class="dropdown-menu">
                  <li><a class="rename" href="#">Переименовать</a></li>
                  <li><a class="delete" href="#">Удалить</a></li>
                </ul>
              </div>
            </div>
          </button>
        </div>
      </div>
      <div class="clearfix">
        <button class="btn btn-default pull-right create-folder">Создать список</button>
      </div>
    </div>
    <div class="col-lg-9 col-12 sheet">
      <div class="content"></div>
      <i class="text-muted margin-xl-h"><small>Избранные документы можно перемещать по спискам, используя перетаскивание</small></i>
    </div>
  </div>
</div>
`;
