import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const loadIndicator = $('#load-indicator');

  const tabs = $('#box-tabs li[data-search]', template);
  tabs.click(function (e) {
    e.preventDefault();
    loadIndicator.show();

    const self = $(this);
    tabs.removeClass('active');
    self.addClass('active');
    individual['activeTab'] = self.data('search');
    $('.tabContainer', template).empty();

    const targetIndidivUri = self.find('a').attr('about');
    const targetIndidiv = new IndividualModel(targetIndidivUri);
    targetIndidiv.present($('.tabContainer', template), new IndividualModel('v-fs:AttributiveSearchTemplate')).then(function () {
      loadIndicator.hide();
    });
  });

  if (!individual['activeTab']) {
    individual['activeTab'] = 'fullText';
  }
  $("#box-tabs li[data-search='" + individual['activeTab'] + "']", template).click();
};

export const html = `
  <div class="container sheet">
    <br />
    <ul id="box-tabs" class="nav nav-tabs nav-right" role="tablist">
      <li class="pull-left"><h2 id="currentTab" class="no-margin" about="@" property="rdfs:label"></h2></li>
      <li data-search="fullText" role="presentation" class="active"><a href="#" about="v-fs:FulltextSearch" property="rdfs:label"></a></li>
      <li data-search="advanced" role="presentation"><a href="#" about="v-fs:AdvancedSearch" property="rdfs:label"></a></li>
      <li data-search="my" role="presentation"><a href="#" about="v-fs:DocumentsSearch" property="rdfs:label"></a></li>
    </ul>
    <br />
    <div class="tabContainer"></div>
  </div>
`;
