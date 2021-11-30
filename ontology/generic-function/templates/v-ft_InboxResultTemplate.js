export const html = `
<div>
  <hr class="no-margin">
  <table class="table table-striped table-condensed">
    <thead>
      <tr>
        <th width="1%"><input type="checkbox" class="toggle-select-all"></th>
        <th width="20px">#</th>
        <th width="10px"><span class="glyphicon glyphicon-search"></span></th>
        <th width="15%" data-orderby="v-wf:from.rdfs:label"><span about="v-wf:from" property="rdfs:label"></span></th>
        <th width="15%" data-orderby="v-wf:to.rdfs:label"><span about="v-wf:to" property="rdfs:label"></span></th>
        <th width="30px" class="orderby" data-orderby="v-wf:read"></th>
        <th data-orderby="rdfs:label"><span about="v-s:description" property="rdfs:label"></span></th>
        <th data-orderby="v-wf:onDocument.rdfs:label"><span about="v-ft:DocumentBundle" property="rdfs:label"></span></th>
        <th width="20px"></th>
        <th width="10%" class="orderby" data-orderby="v-s:created"><span about="v-s:created" property="rdfs:label"></span></th>
        <th width="10%" class="orderby" data-orderby="v-wf:dateGiven"><span about="v-wf:dateGiven" property="rdfs:label"></span></th>
      </tr>
    </thead>
    <tbody class="result-container" data-template="v-ft:InboxResultTemplate_task"></tbody>
  </table>
</div>
`;