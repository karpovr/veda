export const html = `
  <table class="table table-bordered">
    <thead class="result-header">
      <tr class="active">
        <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
        <th class="orderby" data-orderby="v-s:title"><span about="v-s:title" property="rdfs:label"></span></th>
        <th class="orderby" data-orderby="rdfs:label"><span about="rdfs:label" property="rdfs:label"></span></th>
        <th class="orderby" data-orderby="v-s:taxId"><span about="v-s:taxId" property="rdfs:label"></span></th>
        <th class="orderby" data-orderby="v-s:taxRegistrationCause"><span about="v-s:taxRegistrationCause" property="rdfs:label"></span></th>
        <th class="orderby" data-orderby="v-s:taxRegistrationNumber"><span about="v-s:taxRegistrationNumber" property="rdfs:label"></span></th>
      </tr>
    </thead>
    <tbody class="result-container">
      <tr>
        <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
        <td property="v-s:title"></td>
        <td property="rdfs:label"></td>
        <td property="v-s:taxId"></td>
        <td property="v-s:taxRegistrationCause"></td>
        <td property="v-s:taxRegistrationNumber"></td>
      </tr>
    </tbody>
  </table>
`;
