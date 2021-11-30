export const html = `
<div>
  <hr class="no-margin">
  <table class="table table-striped table-condensed">
    <thead>
      <tr>
        <th width="20px">#</th>
        <th width="10px"><span class="glyphicon glyphicon-search"></span></th>
        <th width="12%" data-orderby="v-wf:from.rdfs:label"><span about="v-wf:from" property="rdfs:label"></span></th>
        <th width="12%" data-orderby="v-wf:to.rdfs:label"><span about="v-wf:to" property="rdfs:label"></span></th>
        <th width="30px"></th>
        <th data-orderby="rdfs:label"><span about="v-s:description" property="rdfs:label"></span></th>
        <th data-orderby="v-wf:onDocument.rdfs:label"><span about="v-ft:DocumentBundle" property="rdfs:label"></span></th>
        <th><span about="v-wf:takenDecision" property="rdfs:label"></span></th>
        <th width="20px"></th>
        <th width="10%" class="orderby" data-orderby="v-s:created" about="v-s:created" property="rdfs:label"></th>
        <th width="10%" data-orderby="v-wf:takenDecision.v-s:created">
          <span about="v-ft:DecisionDateBundle" property="rdfs:label"></span>
        </th>
        <th width="10%"><span about="v-ft:DecisionCreatorBundle" property="rdfs:label"></span></th>
      </tr>
    </thead>
    <tbody class="result-container" data-template="v-ft:CompletedResultTemplate_task"></tbody>
  </table>
</div>
`;