export const html = `
  <div class="horizontal-card horizontal-card-sm">
    <div class="thumbnail" about="@" rel="v-s:hasImage" data-template="v-ui:ImageTemplate"></div>
    <div class="description">
      <div about="@" rel="v-s:employee" class="header">
        <strong><span about="@" property="v-s:firstName"></span> <span about="@" property="v-s:lastName"></span></strong>
      </div>
      <hr class="margin-sm" />
      <small rel="v-s:occupation" data-template="v-ui:LabelTemplate"></small>
    </div>
  </div>
`;
