export const html = `
<table class="table table-bordered">
    <thead class="result-header">
      <tr>
        <th colspan="8" about="v-s:Person" property="rdfs:label"></th>
      </tr>
      <tr class="active">
        <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
        <th width="10%"><span about="v-s:creator" property="rdfs:label"></span></th>
        <th width="10%" class="orderby" data-orderby="v-s:created"><span about="v-s:created" property="rdfs:label"></span></th>
        <th><span about="rdfs:label" property="rdfs:label"></span></th>
        <th><span about="v-s:parentOrganization" property="rdfs:label"></span></th>
    </thead>
    <tbody class="result-container">
      <tr>
        <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
        <td rel="v-s:creator" data-template="v-ui:LabelTemplate"></td>
        <td property="v-s:created"></td>
        <td property="rdfs:label"></td>
        <td rel="v-s:parentOrganization" data-template="v-ui:LabelTemplate"></td>
      </tr>
    </tbody>
  </table>
`;