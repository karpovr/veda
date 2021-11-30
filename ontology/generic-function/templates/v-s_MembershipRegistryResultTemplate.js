export const html = `
<table class="table table-bordered">
  <thead class="result-header">
    <tr>
      <th colspan="9" about="v-s:MembershipRegistry" property="rdfs:label"></th>
    </tr>
    <tr class="active">
      <th width="1%"><input type="checkbox" class="toggle-select-all"></th>
      <th width="1%">#</th>
      <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
      <th><span about="rdfs:label" property="rdfs:label"></span></th>
      <th><span about="rdfs:comment" property="rdfs:label"></span></th>
      <th><span about="v-s:memberOf" property="rdfs:label"></span></th>
      <th><span about="v-s:resource" property="rdfs:label"></span></th>
      <th><span about="v-s:Rights" property="rdfs:label"></span></th>
      <th><span about="v-s:creator" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:created"><span about="v-s:created" property="rdfs:label"></span></th>
    </tr>
  </thead>
  <tbody class="result-container">
    <tr>
      <td><input type="checkbox" class="toggle-select"></td>
      <td class="serial-number"></td>
      <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
      <td about="@" property="rdfs:label"></td>
      <td about="@" property="rdfs:comment"></td>
      <td about="@" rel="v-s:memberOf" data-template="v-ui:LabelLinkTemplate"></td>
      <td about="@" rel="v-s:resource" data-template="v-ui:LabelLinkTemplate"></td>
      <td about="@" data-template="v-s:RightsTemplate_inline"></td>
      <td about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></td>
      <td about="@" property="v-s:created"></td>
    </tr>
  </tbody>
</table>
`;