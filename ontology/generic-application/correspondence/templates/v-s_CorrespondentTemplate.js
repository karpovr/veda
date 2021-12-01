import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var self = this;
  correspondentOrganizationHandler.call(this);
  this.on("v-s:correspondentOrganization", correspondentOrganizationHandler);
  template.one("remove", function () {
    self.off("v-s:correspondentOrganization", correspondentOrganizationHandler);
  });
  function correspondentOrganizationHandler () {
    Promise.all([
      self.getPropertyChain("v-s:correspondentOrganization", "v-s:isOwnOrganization"),
      veda.appointment.getOrganization()
    ]).then(function (resolved) {
      var isOwnOrganization = resolved[0][0];
      var userOrganization = resolved[1];

      var isOwn = isOwnOrganization || self.hasValue("v-s:correspondentOrganization", userOrganization);
      var parentRel = template.parent().attr("rel");
      if ( isOwn ) {
        self
          .clearValue("v-s:correspondentDepartmentDescription")
          .clearValue("v-s:correspondentPersonDescription");
        $(".user-organization", template).show();
        $(".other-organization", template).hide();
        template.trigger(parentRel + ":own");
      } else {
        self
          .clearValue("v-s:correspondentDepartment")
          .clearValue("v-s:correspondentPerson");
        $(".user-organization", template).hide();
        $(".other-organization", template).show();
        template.trigger(parentRel + ":foreign");
      }
    });
  }

  if ( container.attr("rel") === "v-s:sender" ) {
    template.addClass("panel-info");
    template.children(":first").addClass("bg-info");
  } else if ( container.attr("rel") === "v-s:recipient" ) {
    template.addClass("panel-success");
    template.children(":first").addClass("bg-success");
  }

  $(".create .create", template).off("click");
  $(".create", template).off("click");
  $(".create .create", template).click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    var modal = $("#notification-modal-template").html();
    modal = $(modal);
    modal.modal({"show": false});
    $("body").append(modal);
    modal.modal("show");
    template.one("remove", function () {
      modal.modal("hide").remove();
    });

    var cntr = $(".modal-body", modal),
        _class = new IndividualModel("v-s:Organization"),
        Organization = new IndividualModel();
    Organization["rdf:type"] = [_class];

    Organization.present(cntr, undefined, "edit");
    Organization.one("beforeReset", function () {
      modal.modal("hide").remove();
    });
    Organization.one("afterSave", function () {
      modal.modal("hide").remove();
      individual["v-s:correspondentOrganization"] = [ Organization ];
    });
  });
};

export const html = `
<div class="panel">
  <div class="panel-body">
    <em about="v-s:correspondentOrganization" property="rdfs:label"></em>
    <div rel="v-s:correspondentOrganization" class="view -edit search">
      <a class="label-template" href="#/@">
        <strong about="@" property="rdfs:label"></strong>,
        <span about="@" property="v-s:postalAddress"></span>
      </a>
    </div>
    <veda-control data-type="link" rel="v-s:correspondentOrganization" class="-view edit -search fulltext create create-modal" data-template="{@.rdfs:label}, {@.v-s:postalAddress}"></veda-control>
    <veda-control data-type="link" rel="v-s:correspondentOrganization" class="-view -edit search fulltext" data-template="{@.rdfs:label}, {@.v-s:postalAddress}"></veda-control>
    <div class="user-organization">
      <hr class="margin-md">
      <em about="v-s:correspondentDepartment" property="rdfs:label"></em>
      <span rel="v-s:correspondentDepartment" class="view edit search" data-template="v-ui:LabelTemplate"></span>
      <veda-control data-type="link" rel="v-s:correspondentDepartment" class="-view edit search fulltext margin-md"></veda-control>
      <hr class="margin-md">
      <em about="v-s:correspondentPerson" property="rdfs:label"></em>
      <span rel="v-s:correspondentPerson" class="view edit search" data-template="v-ui:LabelTemplate"></span>
      <veda-control data-type="link" rel="v-s:correspondentPerson" class="-view edit search fulltext margin-md"></veda-control>
    </div>
    <div class="other-organization">
      <hr class="margin-md">
      <em about="v-s:correspondentDepartmentDescription" property="rdfs:label"></em>
      <span property="v-s:correspondentDepartmentDescription" class="view -edit -search"></span>
      <veda-control data-type="text" property="v-s:correspondentDepartmentDescription" class="-view edit search margin-md"></veda-control>
      <hr class="margin-md">
      <em about="v-s:correspondentPersonDescription" property="rdfs:label"></em>
      <span property="v-s:correspondentPersonDescription" class="view -edit -search"></span>
      <veda-control data-type="text" property="v-s:correspondentPersonDescription" class="-view edit search margin-md"></veda-control>
    </div>
  </div>
</div>
`;