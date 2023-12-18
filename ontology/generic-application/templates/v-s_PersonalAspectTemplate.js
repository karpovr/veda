import $ from 'jquery';

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
    <ul class="nav nav-right" role="tablist">
      <li class="pull-left"><h2 class="no-margin" about="v-s:PersonalAspectTemplate" property="rdfs:comment" style="color:#555;"></h2></li>
      <li class="pull-right"><span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel"></span></li>
    </ul>
    <br />
    <div class="row" style="display: flex; flex-flow: row wrap;">
      <div
        class="col-md-4 col-sm-6 col-xs-12"
        style="display: flex;"
        about="@"
        rel="v-s:owner"
        data-template="v-s:PersonalImageTemplate"
        data-embedded="true"></div>
      <div class="col-md-4 col-sm-6 col-xs-12" style="display: flex;" about="@" rel="v-s:owner" data-template="v-s:PersonalInfoTemplate"></div>
      <div class="col-md-4 col-sm-6 col-xs-12" style="display: flex;" about="@" rel="v-s:owner" data-embedded="true">
        <div about="@" style="display: flex; width: 100%" rel="v-ui:hasPreferences" data-template="v-s:PersonalPreferencesTemplate" data-embedded="true"></div>
      </div>
    </div>
    <div class="row" style="display: flex; flex-flow: row wrap;">
      <div class="blanks col-md-4 col-sm-6 col-xs-12" style="display: flex;">
        <div class="sheet" style="width:100%;">
          <h4 class="text-center" style="text-transform: uppercase">
            <i class="fa fa-file-text-o text-muted margin-md-h"></i><span about="v-s:CreateBundle" property="rdfs:label"></span>
          </h4>
          <div rel="v-s:hasBlank">
            <a href="#/@" class="btn btn-success btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
          <div rel="v-s:hasCreate">
            <a href="#/@" class="btn btn-success btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
        </div>
      </div>
      <div class="registries col-md-4 col-sm-6 col-xs-12" style="display: flex;">
        <div class="sheet" style="width:100%;">
          <h4 class="text-center" style="text-transform: uppercase">
            <i class="fa fa-table text-muted margin-md-h"></i><span about="v-s:FindBundle" property="rdfs:label"></span>
          </h4>
          <div rel="v-s:hasRegistry">
            <a href="#/@" class="btn btn-info btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
        </div>
      </div>
      <div class="reports col-md-4 col-sm-6 col-xs-12" style="display: flex;">
        <div class="sheet" style="width:100%;">
          <h4 class="text-center" style="text-transform: uppercase">
            <i class="fa fa-bar-chart text-muted margin-md-h"></i><span about="v-s:Report" property="rdfs:label"></span>
          </h4>
          <div rel="v-s:hasReport">
            <a href="#/@" class="btn btn-warning btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
        </div>
      </div>
    </div>
    <div class="sheet" about="@" data-template="v-s:FavoritesTemplate"></div>
  </div>
`;
