import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var isMutual = container.attr("data-mutual") === "true";
  var rowTmpl = $("tbody", template).html();

  $("#add-link", template).click(function () {
    $(".links-table", template).removeClass("hidden");
    var cntr = $("[rel='v-s:hasLink']", template),
        _class = new IndividualModel("v-s:Link"),
        Link = new IndividualModel();
    Link["rdf:type"] = [_class];
    Link["v-s:from"] = [individual];

    individual.isSync(false);

    if (isMutual) {
      Link["v-s:mutualMembership"] = [ true ];
    }
    Link.present(cntr, rowTmpl, "edit").then(function (newRow) {
      Link.one("beforeReset", function () {
        newRow.remove();
      });
      Link.one("afterSave", function () {
        newRow.remove();
      });
      if ( individual.isNew() ) {

        newRow.find(".action#save").hide();
      }
    });
  });

  individual.on("afterSave", saveHandler);
  template.one("remove", function () {
    individual.off("afterSave", saveHandler);
  });
  function saveHandler() {
    var children = $("[rel='v-s:hasLink']", template).children();
    children.each(function () {
      var link_template = $(this);
      var link_uri = link_template.attr("resource");
      var link = new IndividualModel(link_uri);
      this["v-s:type"] = [];
      link.save();
      link_template[0].dispatchEvent(new Event("view"));
    });
  }
  individual.on("v-s:hasLink", linksHandler);
  template.one("remove", function () {
    individual.off("v-s:hasLink", linksHandler);
  });
  linksHandler();
  function linksHandler () {
    if ( individual.hasValue("v-s:hasLink") ) {
      $(".links-table", template).removeClass("hidden");
    } else {
      $(".links-table", template).addClass("hidden");
    }
  }
  function cl(){
    console.log(this);
  }
  individual.on("beforeSave", cl);
  template.one("remove", function () {
    individual.off("beforeSave", cl);
  });
};

export const html = `
<div>
  <table class="hidden links-table table table-condensed table-striped table-sortable">
    <thead>
      <tr>
        <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
        <th width="45%" about="v-s:Document" property="rdfs:label"></th>
        <th width="10%" about="v-s:created" property="rdfs:label"></th>
        <th width="20%" about="rdfs:comment" property="rdfs:label"></th>
        <th width="15%" about="v-s:creator" property="rdfs:label"></th>
        <th width="9%"></th>
      </tr>
    </thead>
    <tbody about="@" rel="v-s:hasLink" data-embedded="true" data-limit="5" data-more="true" data-template="v-s:LinksListTemplate_inline"></tbody>
  </table>
  <button class="margin-sm btn btn-success" id="add-link" about="v-s:AddLink" property="rdfs:label"></button>
</div>
`;