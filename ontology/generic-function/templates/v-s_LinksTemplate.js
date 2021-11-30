import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  template.one("remove", function () {
    individual.activeTab = $("#links-tabs li.active a", template).attr("href");
  });
  individual.activeTab = individual.activeTab || "#links-list";
  $("#links-tabs a[href='" + individual.activeTab + "']", template).parent().addClass("active");
  $("#links-tabs-content " + individual.activeTab, template).addClass("active");
};

export const html = `
<div>
  <br>
  <ul class="nav nav-tabs nav-right" role="tablist" id="links-tabs">
    <li role="presentation" class="pull-left"><h3 class="no-margin" about="v-s:hasLink" property="rdfs:label"></h3></li>
    <!--li role="presentation"><a href="#links-graph" role="tab" data-toggle="tab" about="v-s:LinksGraphTemplate" property="rdfs:comment"></a></li-->
    <li role="presentation"><a href="#links-tree" role="tab" data-toggle="tab" about="v-s:LinksTreeTemplate" property="rdfs:comment"></a></li>
    <li role="presentation"><a href="#links-list" role="tab" data-toggle="tab" about="v-s:LinksListTemplate" property="rdfs:comment"></a></li>
  </ul>
  <br>
  <div class="tab-content" id="links-tabs-content">
    <div role="tabpanel" class="tab-pane" id="links-list">
      <div about="@" data-template="v-s:LinksListTemplate"></div>
    </div>
    <div role="tabpanel" class="tab-pane" id="links-tree">
      <div about="@" data-template="v-s:LinksTreeTemplate"></div>
    </div>
    <!--div role="tabpanel" class="tab-pane" id="links-graph">
      <div about="@" data-template="v-s:LinksGraphTemplate"></div>
    </div-->
  </div>
</div>
`;