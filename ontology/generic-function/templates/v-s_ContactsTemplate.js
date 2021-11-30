import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  var loadIndicator = $("#load-indicator");

  var tabs = $("#box-tabs li[data-type]", template);
  tabs.click(function(e){
    e.preventDefault();
    loadIndicator.show();

    var self = $(this);
    tabs.removeClass("active");
    self.addClass("active");
    individual["activeTab"] = self.data("type");
    $(".tabContainer", template).empty();


    if (individual["activeTab"] == "search") {
      return new IndividualModel("v-s:Contacts")
        .present($(".tabContainer", template), "v-s:ContactsStructureTemplate")
        .then(function(){
          loadIndicator.hide();
        });
    } else  if (individual["activeTab"] == "my"){
      return veda.user.aspect
        .present($(".tabContainer", template), "v-s:FavoriteContactTemplate")
        .then(function(){
          loadIndicator.hide();
        });
    }
    var targetIndidivUri = self.find("a").attr("about");
    var targetIndidiv = new IndividualModel(targetIndidivUri);
  });

  if (!individual["activeTab"]) {
    individual["activeTab"] = "search";
  }
  $("#box-tabs li[data-type='"+individual["activeTab"]+"']", template).click();
};

export const html = `
<div class="container-fluid sheet">
  <br>
  <ul id="box-tabs" class="nav nav-tabs nav-right" role="tablist">
    <li class="pull-left"><h2 id="currentTab" class="no-margin" about="@" property="rdfs:label"></h2></li>
    <li data-type="my" role="presentation"><a href="#" about="v-ft:MyBundle" property="rdfs:label"></a></li>
    <li data-type="search" role="presentation" class="active"><a href="#" about="v-s:ContactsBundle" property="rdfs:label"></a></li>
  </ul>
  <br>
  <div class="tabContainer"></div>
</div>
`;