import $ from 'jquery';
import veda from '/js/common/veda.js';
import Notify from '/js/browser/notify.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var notify = new Notify();

  if ( !individual.hasValue("v-s:creator", veda.appointment || veda.user) ) {
    $(".action.save-registry", template).click(function () {
      var personalLabel = prompt( new IndividualModel("v-fs:EnterLabel").toString(), individual.toString() );
      if (!personalLabel) { return; }
      individual.clone()
      .then(function (personalRegistry) {
        personalRegistry["rdf:type"] = [ new IndividualModel("v-fs:PersonalSearch") ];
        personalRegistry["v-fs:searchResult"] = [];
        personalRegistry["v-fs:selected"] = [];
        personalRegistry["v-fs:operation"] = [];
        personalRegistry["v-fs:authorized"] = [];
        personalRegistry["v-fs:cursor"] = [];
        personalRegistry["v-fs:estimated"] = [];
        personalRegistry["v-fs:limit"] = [];
        personalRegistry["v-fs:top"] = [];
        personalRegistry["v-s:creator"] = [];
        personalRegistry["v-s:created"] = [];
        personalRegistry["rdfs:isDefinedBy"] = [];
        personalRegistry["rdfs:label"] = [ personalLabel ];

        var columns = $(".set-columns-wrapper .dropdown-menu .checkbox", template);
        var visibleColumns = [];
        columns.each(function(i) {
          var elem = $(this);
          var input = $("input", elem);
          if (input.is(":checked")) {
            visibleColumns.push(elem);
          }
        });
        if (visibleColumns.length > 0) {
          personalRegistry["v-fs:hasVisibleColumns"] = visibleColumns.map(function(c) {
            var uri = $("span.column-name span", c).attr("about");
            console.log(uri);
            return new veda.IndividualModel(uri);
          });
        }

        var searchBlank = individual.hasValue("v-fs:searchBlank") ? individual["v-fs:searchBlank"][0] : undefined;
        if (searchBlank && searchBlank.object) {
          return searchBlank.clone()
          .then(function(personalRegistryBlank) {
            personalRegistryBlank["rdfs:isDefinedBy"] = [];
            personalRegistryBlank.object = searchBlank.object;
            return personalRegistryBlank.updateBlank();
          })
          .then(function(personalRegistryBlank) {
            personalRegistry["v-fs:searchBlank"] = [ personalRegistryBlank ];
            return personalRegistry.save();
          });
        } else {
          return personalRegistry.save();
        }
      })
      .then(function(personalRegistry) {
        return veda.user.aspect.load().then(function (aspect) {
          aspect.addValue("v-s:hasRegistry", personalRegistry);
          return aspect.save();
        });
      })
      .then(function () {
        return new IndividualModel("v-fs:RegistrySuccessfullySaved").load();
      })
      .then(function (message) {
        notify("success", { message: message });
      })
      .catch(function (error) {
        notify("danger", { message: error });
      });
    });
  } else {
    $(".action.save-registry", template).remove();
  }

  individual.rights.then(function (rights) {
    if ( rights.hasValue("v-s:canUpdate", true) ) {
      $(".action.update-registry", template).click(function () {
        individual["v-fs:searchResult"] = [];
        var searchBlank = individual.hasValue("v-fs:searchBlank") ? individual["v-fs:searchBlank"][0] : undefined;
        if (searchBlank && searchBlank.object) {
          searchBlank.updateBlank()
          .then(function () {
            return new IndividualModel("v-fs:RegistrySuccessfullyUpdated").load();
          })
          .then(function (message) {
            notify("success", { message: message.toString() });
          })
          .catch(function (error) {
            notify("danger", { message: error });
          });
        }
      });
    } else {
      $(".action.update-registry", template).remove();
    }

    if ( rights.hasValue("v-s:canDelete", true) ) {
      $(".action.delete-registry", template).click(function () {
        veda.user.aspect.load()
        .then(function (aspect) {
          aspect.removeValue("v-s:hasRegistry", individual);
          return aspect.save();
        })
        .then(function () {
          return individual.delete();
        })
        .then(function () {
          return new IndividualModel("v-fs:RegistrySuccessfullyDeleted").load();
        })
        .then(function (message) {
          return notify("success", { message: message });
        })
        .catch(function (error) {
          notify("danger", { message: error });
        });
      });
    } else {
      $(".action.delete-registry", template).remove();
    }
  });
};

export const html = `
<div>
  <div class="container sheet">
    <div class="ribbon-wrapper top-left">
      <div class="ribbon top-left primary" about="v-fs:SearchBundle" property="rdfs:label"></div>
    </div>
    <div class="actions text-right">
      <button class="action save-registry btn btn-primary" about="v-fs:SavePersonalRegistry" property="rdfs:label"></button>
      <button class="action update-registry btn btn-primary" about="v-fs:UpdatePersonalRegistry" property="rdfs:label"></button>
      <button class="action delete-registry btn btn-link" about="v-s:Delete" property="rdfs:label"></button>
    </div>
  </div>
  <div class="margin-lg" about="@" data-template="v-fs:AttributiveSearchTemplate">
</div>
`;
