import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import Util from '/js/common/util.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  template.on("click", "#edit, #save, #cancel, #delete", function (e) {
    e.preventDefault();
    var action = this.id;
    if (action === "delete") {
      var warning = new IndividualModel("v-s:AreYouSure");
      warning.load().then(function (warning) {
        if ( confirm( warning["rdfs:label"].map(Util.formatValue).join(" ") ) ) {
          template.parent().closest("[resource]")[0].dispatchEvent(new Event(action));
        }
      });
    } else {
      template.parent().closest("[resource]")[0].dispatchEvent(new Event(action));
    }
  });

  // var allButtons = "edit save cancel delete";
  var defaultButtons = "edit save cancel delete";
  return individual.rights.then(function (rights) {
    var canUpdate = rights.hasValue("v-s:canUpdate", true);
    var canDelete = rights.hasValue("v-s:canDelete", true);
    var enabledButtons = (container.data("buttons") || defaultButtons).split(" ");
    enabledButtons.forEach(function (id) {
      if ( !canUpdate && (id === "save" || id === "edit" || id === "cancel") ) { return; }
      if ( !canDelete && (id === "delete") ) { return; }
      $("#" + id, template).removeClass("rm");
    });
    $(".rm", template).remove();
  });
};

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  // Respect validation state of parent template
  var closest = template.parent().closest("[resource]");
  closest.on("internal-validated", function (e) {
    var validation = e.detail;
    if (validation.state) {
      $(".action#save", template).removeAttr("disabled");
    } else {
      $(".action#save", template).attr("disabled", "disabled");
    }
    e.stopPropagation();
  });
};

export const html = `
<span>
  <!--<button title="v-s:Edit" type="button" class="action btn btn-xs btn-default view -edit -search glyphicon glyphicon-pencil" id="edit"></button>-->
  <button title="v-s:Save" type="button" class="action btn btn-xs btn-success -view edit -search glyphicon glyphicon-ok" id="save"></button>
  <button title="v-s:Cancel" type="button" class="action btn btn-xs btn-default -view edit -search glyphicon glyphicon-repeat" id="cancel"></button>
  <button title="v-s:Delete" type="button" class="action btn btn-xs btn-default view edit -search glyphicon glyphicon-remove" id="delete"></button>
</span>
`;