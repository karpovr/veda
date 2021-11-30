export const html = `
<style>
  .hasImage {
    background-color: #f0f0f0;
  }
  .hasImage>img {
    height: 100%;
  }
</style>
<div class="result-container row">
  <div class="col-md-4">
    <div class="thumbnail">
      <div class="hasImage" about="@" rel="v-s:hasImage" style="height:200px;" data-template="v-ui:ImageTemplate"></div>
      <div>
        <span id="test" about="@" data-template="v-ui:IconModalTemplate"></span>
        <span style="font-weight: bold;" property="@"></span>
      </div>
      <div>
        <span style="font-weight: bold;" about="v-s:moduleVersion" property="rdfs:label"></span>
        <span>:</span>
        <span property="v-s:moduleVersion"></span>
      </div>
      <div class="actions">
        <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="delete"></span>
      </div>
    </div>
  </div>
</div>
`;