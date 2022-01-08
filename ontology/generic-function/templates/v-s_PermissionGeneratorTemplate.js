import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#subject', template).change(function () {
    var uri = $(this).val();
    if (uri) {
      individual['v-s:permissionSubject'] = [new IndividualModel(uri)];
    } else {
      individual['v-s:permissionSubject'] = [];
    }
  });

  $('#subjectGroup', template).change(function () {
    var uri = $(this).val();
    if (uri) {
      individual['v-s:subjectGroupGenerator'] = [new IndividualModel(uri)];
    } else {
      individual['v-s:subjectGroupGenerator'] = [];
    }
  });

  $('#object', template).change(function () {
    var uri = $(this).val();
    if (uri) {
      individual['v-s:permissionObject'] = [new IndividualModel(uri)];
    } else {
      individual['v-s:permissionObject'] = [];
    }
  });

  $('#objectGroup', template).change(function () {
    var uri = $(this).val();
    if (uri) {
      individual['v-s:objectGroupGenerator'] = [new IndividualModel(uri)];
    } else {
      individual['v-s:objectGroupGenerator'] = [];
    }
  });
};

export const html = `
  <div class="container sheet">
    <h2 about="v-s:PermissionGenerator" property="rdfs:label"></h2>
    <hr />
    <em about="rdfs:label" property="rdfs:label"></em>
    <div property="rdfs:label" class="view -edit -search"></div>
    <veda-control data-type="string" property="rdfs:label" class="-view edit search"></veda-control>

    <em about="rdfs:comment" property="rdfs:label"></em>
    <div property="rdfs:comment" class="view -edit -search"></div>
    <veda-control data-type="text" rows="2" property="rdfs:comment" class="-view edit search"></veda-control>

    <hr />

    <em about="v-s:permissionSubject" property="rdfs:label"></em>
    <div rel="v-s:permissionSubject" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
    <input id="subject" type="text" class="-view edit search form-control" />

    <em about="v-s:subjectGroupGenerator" property="rdfs:label"></em>
    <div rel="v-s:subjectGroupGenerator" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
    <input id="subjectGroup" type="text" class="-view edit search form-control" />

    <em about="v-s:subjectGroupGeneratorValue" property="rdfs:label"></em>
    <div property="v-s:subjectGroupGeneratorValue" class="view -edit -search"></div>
    <veda-control data-type="generic" property="v-s:subjectGroupGeneratorValue" class="-view edit search"></veda-control>

    <hr />

    <em about="v-s:permissionObject" property="rdfs:label"></em>
    <div rel="v-s:permissionObject" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
    <input id="object" type="text" class="-view edit search form-control" />

    <em about="v-s:objectGroupGenerator" property="rdfs:label"></em>
    <div rel="v-s:objectGroupGenerator" data-template="v-ui:LabelLinkTemplate" class="view -edit search"></div>
    <input id="objectGroup" type="text" class="-view edit search form-control" />

    <em about="v-s:objectGroupGeneratorValue" property="rdfs:label"></em>
    <div property="v-s:objectGroupGeneratorValue" class="view -edit -search"></div>
    <veda-control data-type="generic" property="v-s:objectGroupGeneratorValue" class="-view edit search"></veda-control>

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
    <br />
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
    </div>
  </div>
`;
