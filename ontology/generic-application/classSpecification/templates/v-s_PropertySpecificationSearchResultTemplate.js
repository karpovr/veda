export const html = `
  <table class="table table-bordered">
    <thead class="result-header">
      <tr>
        <th colspan="9" about="v-s:ClassSpecification" property="rdfs:label"></th>
      </tr>
      <tr class="active">
        <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
        <th><span about="v-ui:forClass" property="rdfs:label"></span></th>
        <th><span about="v-ui:forProperty" property="rdfs:label"></span></th>
        <th><span about="v-ui:minCardinality" property="rdfs:label"></span></th>
        <th><span about="v-ui:maxCardinality" property="rdfs:label"></span></th>
        <th><span about="v-ui:queryPrefix" property="rdfs:label"></span></th>
        <th><span about="v-ui:placeholder" property="rdfs:label"></span></th>
      </tr>
    </thead>
    <tbody class="result-container">
      <tr>
        <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
        <td rel="v-ui:forClass" data-template="v-ui:LabelTemplate"></td>
        <td rel="v-ui:forProperty" data-template="v-ui:LabelTemplate"></td>
        <td property="v-ui:minCardinality"></td>
        <td property="v-ui:maxCardinality"></td>
        <td property="v-ui:queryPrefix"></td>
        <td property="v-ui:placeholder"></td>
      </tr>
    </tbody>
  </table>
`;
