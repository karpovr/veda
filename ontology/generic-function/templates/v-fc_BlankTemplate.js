import $ from 'jquery';
import riot from 'riot';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  return individual.initBlank();
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var self = individual,
      objectContainer = $("#object-container", template),
      object = self.object;

  var _class = object["rdf:type"][0];

  _class.rights.then(function (rights) {

    if (rights.hasValue("v-s:canCreate", true)) {
      var object_template = self.get("v-fc:targetTemplate")[0];
      object.present(objectContainer, object_template, "edit")
        .then(function (objectTemplate) {
          objectTemplate = $(objectTemplate);
          objectTemplate.one("cancel", cancelHandler);
          object.one("afterSave", saveHandler);
          objectTemplate.one("remove", function () {
            object.off("afterSave", saveHandler);
          })
        });
    } else {
      $("#no-rights", template).removeClass("hidden");
    }

    function cancelHandler () {
      delete self.object;
      window.history.back();
    }
    function saveHandler () {
      delete self.object;
      riot.route("#/" + object.id);
    }
  });
};

export const html = `
<div>
  <div id="object-container"></div>
  <div id="no-rights" class="alert alert-warning container hidden">
    <strong about="v-s:Attention" property="rdfs:label"></strong> <span about="v-s:NoRightsForOperation" property="rdfs:label"></span>
    <button class="btn btn-default" about="v-fc:Back" property="rdfs:label" onclick="window.history.back();"></button>
  </div>
</div>
`;