export const html = `
<div class="sheet" style="display: flex; flex-flow: column; width: 100%">
  <h3 class="no-margin" about="v-s:UISettingsBundle" property="rdfs:label"></h3>
  <br/>
  <div class="form-inline">
    <div class="form-group">
      <label about="v-ui:preferredLanguage" property="rdfs:label"></label>:
      <veda-control rel="v-ui:preferredLanguage" data-type="checkbox" class="view edit search fulltext dropdown"></veda-control>
    </div>
  </div>
  <br/>
  <div class="form-inline">
    <div class="form-group">
      <label about="v-ui:displayedElements" property="rdfs:label"></label>:
      <span class="view -edit -search" about="@" property="v-ui:displayedElements"></span>
      <veda-control property="v-ui:displayedElements" data-type="select" data-source="{{[5,10,20]}}" class="-view edit search"></veda-control>
    </div>
  </div>
  <br/>
  <div class="checkbox" style="margin-top:0px;">
    <label>
      <veda-control property="v-ui:fullWidth" data-type="boolean"></veda-control>
      <strong about="v-ui:fullWidth" property="rdfs:label"></strong>
    </label>
  </div>
  <h3 about="v-s:MessageSettingsBundle" property="rdfs:label"></h3>
  <em about="v-ui:rejectMessageType" property="rdfs:label"></em>
  <veda-control rel="v-ui:rejectMessageType" data-type="checkbox"></veda-control>
  <br/>
</div>
`;