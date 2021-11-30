export const html = `
<table class="table table-condensed">
  <thead class="result-header">
    <tr class="active">
      <th width="1%">#</th>
      <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
      <th width="40%">@</th>
      <!--th class="orderby" data-orderby="rdf:type"><span about="rdf:type" property="rdfs:label"></span></th-->
      <th class="orderby" data-orderby="rdfs:label"><span about="rdfs:label" property="rdfs:label"></span></th>
      <!--th width="5%" class="orderby" data-orderby="v-s:created"><span about="v-s:created" property="rdfs:label"></span></th>
      <th width="5%" class="orderby" data-orderby="v-s:creator"><span about="v-s:creator" property="rdfs:label"></span></th-->
    </tr>
  </thead>
  <tbody class="result-container">
    <tr>
      <td class="serial-number"></td>
      <td about="@" data-template="v-ui:IconModalTemplate"></td>
      <td property="@" style="word-wrap: break-word; max-width:100px;"></td>
      <!--td about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></td-->
      <td about="@" property="rdfs:label"></td>
      <!--td about="@" property="v-s:created"></td>
      <td about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></td-->
    </tr>
  </tbody>
</table>
`;