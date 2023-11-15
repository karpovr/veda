import IndividualModel from '/js/common/individual_model.js';
import $ from 'jquery';

export const pre = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const createFolderBtn = $('.create-folder', template);
  createFolderBtn.click(async () => {
    const folder = new IndividualModel;
    folder['rdf:type'] = 'v-s:Folder';
    folder['rdfs:label'] = `Новая папка ${Math.floor(Math.random() * 99 + 1)}`;
    await folder.save();
    individual.addValue('v-s:hasFolder', folder);
    await individual.save();
  });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  let subscriptions = individual['v-s:hasFavorite'];
  const subscribeDiff = [];
  function favoriteHandler () {
    if (individual['v-s:hasFavorite'].length < subscriptions.length) {
      subscriptions.forEach(function (subscribe) {
        const isExist = individual['v-s:hasFavorite'].some(function (f) {
          return f.id == subscribe.id;
        });
        if (!isExist) subscribeDiff.push(subscribe);
      });
    }
    subscriptions = individual['v-s:hasFavorite'];
  }

  function saveHandler () {
    if (subscribeDiff.length > 0) {
      subscribeDiff.forEach(function (subscribe) {
        subscribe.remove();
      });
    }
  }

  individual.on('beforeSave', saveHandler);
  individual.on('v-s:hasFavorite', favoriteHandler);
  template.one('remove', function () {
    individual.off('v-s:hasFavorite', favoriteHandler);
    individual.off('beforeSave', saveHandler);
  });
};

export const html = `
<div class="container">
  <h4 class="text-center" style="text-transform: uppercase">
    <i class="fa fa-star text-muted margin-md-h"></i><span about="v-s:Favorites" property="rdfs:label"></span>
  </h4>
  <hr class="margin-lg" />
  <div class="row">
    <div class="col-lg-3 col-12 sheet">
      <ul class="list-group" rel="v-s:hasFolder">
        <a href="#" class="list-group-item" about="@" data-template="v-ui:LabelTemplate"></a>
      </ul>
      <ol rel="v-s:hasFolder">
        <li about="@" data-template="v-ui:LabelLinkTemplate"></li>
      </ol>
      <div class="clearfix">
        <button class="btn btn-default pull-right create-folder">Создать папку</button>
      </div>
    </div>
    <div class="col-lg-9 col-12 sheet">
      <ol rel="v-s:hasFavorite" class="columns-3">
        <li rel="v-s:onDocument" data-template="v-ui:ClassNameLabelLinkTemplate"></li>
      </ol>
    </div>
  </div>
</div>
`;
