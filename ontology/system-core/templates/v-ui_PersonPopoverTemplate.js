import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue("v-s:hasImage")) {
    $(".media-left", template).remove();
  }
  if (!individual.hasValue("v-s:dateAbsenceTo")) {
    $(".absence-block", template).remove();
  };
};

export const html = `
<div class="media" style="margin-top:0px;">
  <span class="close">&nbsp;&times;</span>
  <div class="media-left" style="width:96px">
    <a href="#/@" about="@" rel="v-s:hasImage" data-template="v-ui:ImageTemplate"></a>
    <!-- <a href="#/@" about="@" rel="v-s:hasImage">
      <div about="@" rel="v-s:thumbnail" data-template="v-ui:ImageTemplate"></div>
    </a> -->
  </div>
  <div class="media-body" style="width:auto">
    <strong class="media-heading">
      <span>
        <span about="@" property="v-s:lastName"></span>
        <span about="@" property="v-s:firstName"></span>
        <span about="@" property="v-s:middleName"></span>
      </span>
    </strong>
    <hr class="no-margin">
    <div about="@" rel="v-s:hasAppointment">
      <small about="@" rel="v-s:occupation">
        <span about="@" property="rdfs:label"></span>
      </small>
    </div>
    <div about="@" rel="v-s:hasCommunicationMean">
      <div>
        <small about="@" property="v-s:description"></small>
      </div>
    </div>
    <div class="absence-block">
      <hr class="no-margin">
      <div>
        <small>
          <span about="v-s:AbsenceUntilBundle" property="rdfs:label"></span>
          <span about="@" property="v-s:dateAbsenceTo"></span>
        </small>
      </div>
      <div>
        <small>
          <span about="v-s:delegate" property="rdfs:label"></span>
          <span about="@" rel="v-s:delegate" data-template="v-ui:LabelTemplate"></span>
        </small>
      </div>
    </div>
  </div>
</div>
`;
