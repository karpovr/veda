export const html = `
<div class="container sheet">
  <style scoped>
    tbody {
      counter-reset: rowNumber;
    }
    tbody tr {
      counter-increment: rowNumber;
    }
    tbody tr td:first-child::before {
      content: counter(rowNumber);
    }
  </style>
  <div class="clearfix">
    <h2 class="pull-left">
      <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
      <small about="@" property="rdfs:label"></small>
    </h2>
    <span class="pull-right text-muted" property="@"></span>
  </div>
  <table class="table">
    <thead class="result-header">
      <tr>
        <th width="1%">#</th>
        <th width="85%" class="orderby" data-orderby="v-s:title"><span about="v-s:title" property="rdfs:label"></span></th>
        <th width="13%" class="orderby" data-orderby="v-s:created"><span about="v-s:created" property="rdfs:label"></span></th>
      </tr>
    </thead>
    <tbody class="result-container" rel="rdf:value">
      <tr>
        <td class="serial-number"></td>
        <td>
          <div about="@" property="v-s:title"></div>
          <small about="@" property="v-s:description"></small>
          <a href="#/@"><small about="v-s:More" property="rdfs:label"></small></a>
        </td>
        <td about="@" property="v-s:created"></td>
      </tr>
    </tbody>
  </table>
  <br>
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel"></span>
  </div>
</div>
`;