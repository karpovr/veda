export const html = `
<div>
  <table class="table table-hover">
    <thead>
      <th><span class="glyphicon glyphicon-chevron-down"></span></th>
      <th><span about="rdfs:label" property="rdfs:label"></span></th>
      <th><span about="v-s:ContactsBundle" property="rdfs:label"></th>
      <th></th>
      <th></th>
    </thead>
    <tbody about="@" rel="v-s:hasFavoriteContact" data-template="v-s:ContactCardTemplate"></tbody>
  </table>
</div>
`;
