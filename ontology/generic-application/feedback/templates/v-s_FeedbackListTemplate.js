import Backend from '/js/browser/backend_browser.js';
import veda from '/js/common/veda.js';


export const pre = async function (individual, template, container, mode, extra) {
  const feedbacks = await Backend.query(veda.ticket, `'rdf:type' == 'v-s:Feedback' && 'v-s:hasLinkedObject' == '${individual.id}'`);
  individual['v-s:hasReaction'] = feedbacks.result;
}

export const post = async function (individual, template, container, mode, extra) {
  
}

export const html = `
<div class="sheet container">
  <h2 about="v-s:Feedback" property="rdfs:label" style="color:#555"></h2>
  <!-- Feedback rate icons -->
  <div class="table-responsive view edit -search" style="margin-top: 20px">
    <table class="table">
      <thead class="result-header">
        <tr>
          <th width="1"><span class="glyphicon glyphicon-zoom-in"></span></th>
          <th about="v-wf:from" property="rdfs:label"></th>
          <th about="v-s:rating" property="rdfs:label"></th>
          <th about="rdfs:comment" property="rdfs:label"></th>
        </tr>
      </thead>
      <tbody rel="v-s:hasReaction" data-embedded="true">
        <tr>
          <td about="@" data-template="v-ui:IconModalTemplate"></td>
          <td about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></td>
          <td about="@" rel="v-s:hasReaction" data-template="v-ui:ReactionTemplate"></td>
          <td about="@" property="rdfs:comment"></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
`