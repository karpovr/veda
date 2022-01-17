export const html = `
  <table class="table table-bordered">
    <thead class="result-header">
      <tr>
        <th colspan="12" about="v-s:PermissionGenerator" property="rdfs:label"></th>
      </tr>
      <tr class="active">
        <th width="1%"><input type="checkbox" class="toggle-select-all" /></th>
        <th width="1%">#</th>
        <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
        <th><span about="v-s:permissionSubject" property="rdfs:label"></span></th>
        <th><span about="v-s:subjectGroupGenerator" property="rdfs:label"></span></th>
        <th><span about="v-s:subjectGroupGeneratorValue" property="rdfs:label"></span></th>
        <th><span about="v-s:Rights" property="rdfs:label"></span></th>
        <th><span about="v-s:permissionObject" property="rdfs:label"></span></th>
        <th><span about="v-s:objectGroupGenerator" property="rdfs:label"></span></th>
        <th><span about="v-s:objectGroupGeneratorValue" property="rdfs:label"></span></th>
        <th><span about="v-s:creator" property="rdfs:label"></span></th>
        <th class="orderby" data-orderby="v-s:created"><span about="v-s:created" property="rdfs:label"></span></th>
      </tr>
    </thead>
    <tbody class="result-container">
      <tr>
        <td><input type="checkbox" class="toggle-select" /></td>
        <td class="serial-number"></td>
        <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
        <td about="@" rel="v-s:permissionSubject" data-template="v-ui:LabelLinkTemplate"></td>
        <td about="@" rel="v-s:subjectGroupGenerator" data-template="v-ui:LabelLinkTemplate"></td>
        <td about="@" property="v-s:subjectGroupGeneratorValue"></td>
        <td about="@" data-template="v-s:RightsTemplate_inline"></td>
        <td about="@" rel="v-s:permissionObject" data-template="v-ui:LabelLinkTemplate"></td>
        <td about="@" rel="v-s:objectGroupGenerator" data-template="v-ui:LabelLinkTemplate"></td>
        <td about="@" property="v-s:objectGroupGeneratorValue"></td>
        <td about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></td>
        <td about="@" property="v-s:created"></td>
      </tr>
    </tbody>
  </table>
`;
