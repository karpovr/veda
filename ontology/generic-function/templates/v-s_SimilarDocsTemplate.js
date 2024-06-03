import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.one('remove', function () {
    individual.activeTab = $('#links-tabs li.active a', template).attr('href');
  });
  individual.activeTab = individual.activeTab || '#links-list';
  $("#links-tabs a[href='" + individual.activeTab + "']", template)
    .parent()
    .addClass('active');
  $('#links-tabs-content ' + individual.activeTab, template).addClass('active');
};

export const html = `
  <div>
    <br />
    <ul class="nav nav-tabs nav-right" role="tablist" id="links-tabs">
      <li role="presentation" class="pull-left"><h3 class="no-margin" about="v-s:hasSimilarDoc" property="rdfs:label"></h3></li>      
    </ul>
    <br />
    <div class="tab-content" id="links-tabs-content">
      <div role="tabpanel" class="tab-pane" id="links-list">
        <div about="@" data-template="v-s:SimilarDocsListTemplate"></div>
      </div>
    </div>
  </div>
`;
