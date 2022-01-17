import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const membershipRegistryBlank = new IndividualModel('v-s:MembershipRegistryBlank');
  const membershipRegistryBlankPromise = membershipRegistryBlank.load().then(function (membershipRegistryBlank) {
    delete membershipRegistryBlank.object;
    membershipRegistryBlank['v-s:memberOf'] = [individual];
    return membershipRegistryBlank.init();
  });

  const membershipBlank = new IndividualModel('v-s:MembershipBlank');
  const membershipBlankPromise = membershipBlank.load().then(function (membershipBlank) {
    delete membershipBlank.object;
    membershipBlank['v-s:memberOf'] = [individual];
    return membershipBlank.init();
  });

  return Promise.all([membershipRegistryBlankPromise, membershipBlankPromise]);
};

export const html = `
  <div class="container sheet">
    <div about="@" data-embedded="true" data-template="v-ui:CommonOntologyTemplate"></div>
    <div class="panel panel-default">
      <div class="panel-heading">
        <span about="v-s:MembershipRegistry" property="rdfs:label"></span
        ><a href="#/v-s:MembershipBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a>
      </div>
      <div class="panel-body" about="v-s:MembershipRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
    </div>
    <br />
    <br />
    <div class="actions">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete destroy"></span>
    </div>
  </div>
`;
