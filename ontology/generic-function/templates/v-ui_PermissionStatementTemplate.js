import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#object', template).change(function () {
    const uri = $(this).val();
    if (uri) {
      individual['v-s:permissionObject'] = [new IndividualModel(uri)];
    } else {
      individual['v-s:permissionObject'] = [];
    }
  });

  $('#subject', template).change(function () {
    const uri = $(this).val();
    if (uri) {
      individual['v-s:permissionSubject'] = [new IndividualModel(uri)];
    } else {
      individual['v-s:permissionSubject'] = [];
    }
  });
};

export const html = `
  <div class="container sheet">
    <h2 about="v-s:PermissionStatement" property="rdfs:label"></h2>
    <hr />
    <em about="v-s:permissionObject" property="rdfs:label"></em>
    <div rel="v-s:permissionObject" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
    <input id="object" type="text" class="-view edit search form-control" />
    <em about="v-s:permissionSubject" property="rdfs:label"></em>
    <div rel="v-s:permissionSubject" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
    <input id="subject" type="text" class="-view edit search form-control" />
    <hr />
    <div class="checkbox">
      <label>
        <veda-control property="v-s:canCreate" data-type="boolean"></veda-control>
        <em about="v-s:canCreate" property="rdfs:label"></em>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <veda-control property="v-s:canRead" data-type="boolean"></veda-control>
        <em about="v-s:canRead" property="rdfs:label"></em>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <veda-control property="v-s:canUpdate" data-type="boolean"></veda-control>
        <em about="v-s:canUpdate" property="rdfs:label"></em>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <veda-control property="v-s:canDelete" data-type="boolean"></veda-control>
        <em about="v-s:canDelete" property="rdfs:label"></em>
      </label>
    </div>
    <hr />
    <div class="checkbox">
      <label>
        <veda-control property="v-s:deleted" data-type="boolean"></veda-control>
        <em about="v-s:deleted" property="rdfs:label"></em>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <veda-control property="v-s:dropCount" data-type="boolean"></veda-control>
        <em about="v-s:dropCount" property="rdfs:label"></em>
      </label>
    </div>
    <hr />
    <div about="@" data-template="v-ui:SystemPropertiesNewTemplate" data-embedded="true"></div>
    <br />
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
    </div>
  </div>
`;
