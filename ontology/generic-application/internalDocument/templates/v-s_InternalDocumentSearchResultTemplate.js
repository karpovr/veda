export const html = `
<table class="table table-bordered">
  <thead class="result-header">
    <tr>
      <th colspan="12" about="v-s:InternalDocument" property="rdfs:label"></th>
    </tr>
    <tr class="active">
      <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
      <th width="10%" class="orderby" data-orderby="v-s:creator"><span about="v-s:creator" property="rdfs:label"></span></th>
      <th width="10%" class="orderby" data-orderby="v-s:created"><span about="v-s:created" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:registrationNumber"><span about="v-s:registrationNumber" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:hasDocumentKind"><span about="v-s:hasDocumentKind" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:ResponsibleDepartmentForInternalDocumentBundle"><span about="v-s:responsibleDepartment" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:InitiatorDepartmentForInternalDocumentBundle"><span about="v-s:initiator" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:copyTo"><span about="v-s:copyTo" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:theme"><span about="v-s:theme" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:content"><span about="v-s:content" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="rdfs:comment"><span about="rdfs:comment" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:attachment"><span about="v-s:attachment" property="rdfs:label"></span></th>
    </tr>
  </thead>
  <tbody class="result-container">
    <tr>
      <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
      <td rel="v-s:creator" data-template="v-ui:LabelTemplate"></td>
      <td property="v-s:created"></td>
      <td property="v-s:registrationNumber"></td>
      <td rel="v-s:hasDocumentKind" data-template="v-ui:LabelTemplate"></td>
      <td rel="v-s:responsibleDepartment" data-template="v-ui:LabelTemplate"></td>
      <td rel="v-s:initiator" data-template="v-ui:LabelTemplate"></td>
      <td rel="v-s:copyTo" data-template="v-ui:LabelTemplate"></td>
      <td property="v-s:theme"></td>
      <td property="v-s:content"></td>
      <td property="rdfs:comment"></td>
      <td rel="v-s:attachment" data-template="v-ui:FileMinTemplate"></td>
    </tr>
  </tbody>
</table>
`;