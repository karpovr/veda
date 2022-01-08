export const html = `
  <div class="container sheet">
    <div about="@" data-embedded="true" data-template="v-ui:CommonOntologyTemplate"></div>
    <div class="checkbox">
      <label>
        <veda-control property="v-s:resolved" data-type="boolean"></veda-control>
        <em about="v-s:resolved" property="rdfs:label"></em>
      </label>
    </div>
    <strong about="@" property="v-s:errorCode"></strong>: <strong about="@" property="v-s:errorName"></strong>
    <br />
    <i about="@" property="v-s:errorMessage"></i>
    <em about="v-s:errorStack" property="rdfs:label"></em>
    <pre about="@" property="v-s:errorStack" style="border:none; background-color:transparent;"></pre>

    <hr />
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  </div>
`;
