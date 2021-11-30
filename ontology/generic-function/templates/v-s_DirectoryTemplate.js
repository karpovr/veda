export const html = `
<div class="container sheet">
  <h2>
    <span about="v-s:Directory" property="rdfs:label"></span>
    <small about="@" property="rdfs:label"></small>
  </h2>
   <span about="@" data-template="v-ui:RabbitHole"></span>
  <hr>
  <div id="parentUnit">
    <h3 about="v-s:parentUnit" property="rdfs:label" class="view edit -search" ></h3>
    <table class="table table-condensed table-bordered">
      <thead>
        <tr class="view edit -search active">
          <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
          <th width="30%" about="rdf:type" property="rdfs:label"></th>
          <th about="rdfs:label" property="rdfs:label"></th>
        </tr>
      </thead>
      <tbody rel="v-s:parentUnit">
        <tr>
          <td about="@" data-template="v-ui:IconModalTemplate"></td>
          <td>
            <div property="rdf:type" class="view -edit -search"></div>
          </td>
          <td>
            <div property="rdfs:label" class="view -edit -search"></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <br>
  <div id="childUnit">
    <h3 about="v-s:childUnit" property="rdfs:label" class="view edit -search" ></h3>
    <table class="table table-condensed table-bordered">
      <thead>
        <tr class="view edit -search active">
          <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
          <th width="30%" about="rdf:type" property="rdfs:label"></th>
          <th about="rdfs:label" property="rdfs:label"></th>
        </tr>
      </thead>
      <tbody rel="v-s:childUnit">
        <tr>
          <td about="@" data-template="v-ui:IconModalTemplate"></td>
          <td>
            <div property="rdf:type" class="view -edit -search"></div>
          </td>
          <td>
            <div property="rdfs:label" class="view -edit -search"></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <br>
  <div id="systemProperties">
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
  </div><!--#systemProperties-->

  <br>
  <!-- BUTTONS -->
  <div class="actions view edit -search">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete journal task"></span>
  </div>
</div>
`;