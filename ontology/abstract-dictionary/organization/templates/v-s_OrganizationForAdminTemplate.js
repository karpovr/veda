import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function forAdmin() {
    if (veda.appointment.id == 'cfg:AdministratorAppointment' && individual.id != 'd:org_RU1121003135') $("#rigthsForAdmin").removeClass('hide');
  }
  forAdmin();

  $("#add-OrgVedaAccount", template).click(function () {
    var org = individual.id;
    var org1 = org.slice(6);
    var org_gr = new IndividualModel(individual + "_group");

    var _class = new IndividualModel("v-s:Membership"),
      OrgWithVedaAccount = new IndividualModel();
    OrgWithVedaAccount["rdf:type"] = [_class];
    OrgWithVedaAccount["v-s:memberOf"] = [new IndividualModel("v-s:OrganizationsWithVedaAccount")];
    OrgWithVedaAccount["v-s:resource"] = [org_gr];
    OrgWithVedaAccount.id = "v-s:OrganizationsWithVedaAccount" + "_" + org1;
    OrgWithVedaAccount.save();
  });
  $("#add-OrgADAccount", template).click(function () {
    var org = individual.id;
    var org1 = org.slice(6);
    var org_gr = new IndividualModel(individual + "_group");

    var _class = new IndividualModel("v-s:Membership"),
      OrgWithADAccount = new IndividualModel();
    OrgWithADAccount["rdf:type"] = [_class];
    OrgWithADAccount["v-s:memberOf"] = [new IndividualModel("v-s:OrganizationsWithADAccount")];
    OrgWithADAccount["v-s:resource"] = [org_gr];
    OrgWithADAccount.id = "v-s:OrganizationsWithADAccount" + "_" + org1;
    OrgWithADAccount.save();
  });
  $("#add-OrgWithLimited", template).click(function () {
    var org = individual.id;
    var org1 = org.slice(6);
    var org_gr = new IndividualModel(individual + "_group");

    var _class = new IndividualModel("v-s:Membership"),
      OrgWithLimited = new IndividualModel();
    OrgWithLimited["rdf:type"] = [_class];
    OrgWithLimited["v-s:memberOf"] = [new IndividualModel("v-s:OrganizationsWithLimitedClassTypes")];
    OrgWithLimited["v-s:resource"] = [org_gr];
    OrgWithLimited.id = "v-s:OrganizationsWithLimitedClassTypes" + "_" + org1;
    OrgWithLimited.save();
  });
  $("#add-OrgWithoutLimited", template).click(function () {
    var org = individual.id;
    var org1 = org.slice(6);
    var org_gr = new IndividualModel(individual + "_group");

    var _class = new IndividualModel("v-s:Membership"),
      OrgWithoutLimited = new IndividualModel();
    OrgWithoutLimited["rdf:type"] = [_class];
    OrgWithoutLimited["v-s:memberOf"] = [new IndividualModel("v-s:OrganizationsWithoutLimitedClassTypes")];
    OrgWithoutLimited["v-s:resource"] = [org_gr];
    OrgWithoutLimited.id = "v-s:OrganizationsWithoutLimitedClassTypes" + "_" + org1;
    OrgWithoutLimited.save();
  });

  var membershipRegistry = new IndividualModel("v-s:OrganizationMembershipRegistry", false);
  var orgUri = individual.id;
  var membershipContainer = $(".memberships", template);
  membershipRegistry.load().then(function (loaded) {
    loaded["v-fs:top"] = [10];
    loaded["v-fs:fulltextQuery"] = ["'rdf:type' == 'v-s:Membership' && 'v-s:resource' == '" + orgUri + "_group'"];
    //loaded["v-fs:fulltextQuery"] = ["'rdf:type'=='v-s:Membership'"];
    loaded.present(membershipContainer, "v-fs:AttributiveSearchInlineTemplate");
  })
};

export const html = `
<div>
  <div class="container sheet">
    <h2>
      <span about="v-s:Organization" property="rdfs:label"></span>
      <small about="@" property="rdfs:label"></small>
    </h2>
    <hr>
    <!--<h3 about="v-s:hasMembership" property="rdfs:label"></h3>-->
    <div class="memberships" data-limit="10"></div>

    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br>
    <!-- BUTTONS -->
    <div class="actions">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true"
        data-buttons="edit save cancel delete journal"></span>
      <span id="rigthsForAdmin" class="hide">
        <button class="btn btn-secondary view -edit -search" id="add-OrgVedaAccount">
          <span about="v-s:AddInGroupOrgWithVedaAccount" property="rdfs:label"></span>
        </button>
        <button class="btn btn-secondary view -edit -search" id="add-OrgADAccount">
          <span about="v-s:AddInGroupOrgWithVedaADAccount" property="rdfs:label"></span>
        </button>
        <button class="btn btn-secondary view -edit -search" id="add-OrgWithLimited">
          <span about="v-s:AddInGroupOrgWithLimitedClassTypes" property="rdfs:label"></span>
        </button>
        <button class="btn btn-secondary view -edit -search" id="add-OrgWithoutLimited">
          <span about="v-s:AddInGroupOrgWithoutLimitedClassTypes" property="rdfs:label"></span>
        </button>
      </span>
    </div>
  </div>
  <div about="@" class="container sheet view edit -search" data-template="v-s:LinksTemplate" data-embedded="true"></div>
  <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
</div>
`;