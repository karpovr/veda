export const html = `
<table class="table table-bordered">
  <thead class="result-header">
    <tr>
      <th colspan="8" about="v-s:CurrencyExchangeRate" property="rdfs:label"></th>
    </tr>
    <tr class="active">
      <th width="1%">#</span></th>
      <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
      <th class="orderby" data-orderby="v-s:date"><span about="v-s:date" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:hasCurrencyExchangeRatePurpose"><span about="v-s:hasCurrencyExchangeRatePurpose" property="rdfs:label"></span></th>
      <th width="1%"></span></th>
      <th class="orderby" data-orderby="v-s:hasCurrencySource"><span about="v-s:hasCurrency" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:rate"><span about="v-s:rate" property="rdfs:label"></span></th>
      <th class="orderby" data-orderby="v-s:hasCurrencyTarget"><span about="v-s:hasCurrency" property="rdfs:label"></span></th>
      <!--th width="1%"><button class="btn btn-primary btn-xs glyphicon glyphicon-edit"></button><button class="hidden btn btn-success btn-xs glyphicon glyphicon-save"></button></th-->
    </tr>
  </thead>
  <tbody class="result-container">
    <tr>
      <td class="serial-number"></td>
      <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
      <td>
        <span property="v-s:date" class="view -edit -search"></span>
        <veda-control data-type="date" property="v-s:date" class="-view edit search"></veda-control>
      </td>
      <td>
        <span rel="v-s:hasCurrencyExchangeRatePurpose" data-template="v-ui:LabelTemplate" class="view -edit -search"></span>
        <veda-control data-type="link" rel="v-s:hasCurrencyExchangeRatePurpose" class="-view edit search fulltext dropdown"></veda-control>
      </td>
      <td>
        <strong>1</strong>
      </td>
      <td>
        <span rel="v-s:hasCurrencySource" data-template="v-ui:LabelTemplate" class="view -edit -search"></span>
        <veda-control data-type="link" rel="v-s:hasCurrencySource" class="-view edit search fulltext dropdown"></veda-control>
      </td>
      <td>
        <span property="v-s:rate" class="view -edit -search"></span>
        <veda-control data-type="decimal" property="v-s:rate" class="-view edit search"></veda-control>
      </td>
      <td>
        <span rel="v-s:hasCurrencyTarget" data-template="v-ui:LabelTemplate" class="view -edit -search"></span>
        <veda-control data-type="link" rel="v-s:hasCurrencyTarget" class="-view edit search fulltext dropdown"></veda-control>
      </td>
      <!--td>
        <button class="btn btn-default btn-xs glyphicon glyphicon-edit"></button>
        <button class="hidden btn btn-default btn-xs glyphicon glyphicon-save"></button>
      </td-->
    </tr>
  </tbody>
</table>
`;
