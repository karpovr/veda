export const html = `
<div class="container sheet">
  <h2 about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></h2>
  <em about="v-s:owner" property="rdfs:label"></em>
  <div rel="v-s:owner" data-template="v-ui:LabelLinkTemplate"></div>
  <table class="table table-condensed table-bordered table-striped">
    <thead>
      <tr>
        <th about="v-ft:inboxCount" property="rdfs:label"></th>
        <th about="v-ft:completedCount" property="rdfs:label"></th>
        <th about="v-ft:outboxCount" property="rdfs:label"></th>
        <th about="v-ft:inboxWeekCount" property="rdfs:label"></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td property="v-ft:inboxCount"></td>
        <td property="v-ft:completedCount"></td>
        <td property="v-ft:outboxCount"></td>
        <td property="v-ft:inboxWeekCount"></td>
      </tr>
    </tbody>
  </table>
</div>
`;