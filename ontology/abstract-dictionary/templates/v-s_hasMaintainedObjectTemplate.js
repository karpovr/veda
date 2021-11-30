export const html = `
<div>
  <em about="v-s:hasMaintainedObject" property="rdfs:label"></em>
  <table class="table table-condensed table-bordered">
    <thead>
      <tr class="active">
        <th about="rdfs:label" property="rdfs:label"></th>
        <th></th>
        <th about="v-s:hasParentLinkBundle" property="rdfs:label"></th>
        <th></th>
      </tr>
    </thead>
    <tbody rel="v-s:hasMaintainedObject">
      <tr>
        <td property="rdfs:label" class="view edit search"></td>
        <td property="v-s:shortLabel" class="view edit search"></td>
        <td rel="v-s:hasParentLink" data-template="v-ui:LabelTemplate" class="view edit search"></td>
        <td>
          <div about="@" rel="v-s:hasParentLink" class="view edit search">
            <div property="v-s:shortLabel" class="view edit search"></div>
          </div>
        </td>
      </tr>
    </tbody>
    <tfoot class="-view edit search"><tr><td colspan="5">
      <veda-control data-type="link" rel="v-s:hasMaintainedObject" class="-view edit search fulltext tree"></veda-control>
    </tfoot>
  </table>
</div>
`;