import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var rightsContainer = $(".rights", template);
  var rightsTemplate = rightsContainer.html();
  rightsContainer.empty();
  individual.rights.then(function (rights) {
    rights.present(rightsContainer, rightsTemplate);
  });

  var descriptionContainer = $("#description", template);
  var descriptionTemplate = descriptionContainer.html();
  descriptionContainer.empty();

  var rightsOriginContainer = $(".rightsOrigin", template);
  var rightsOriginTemplate = rightsOriginContainer.html();
  rightsOriginContainer.empty();
  individual.rightsOrigin.then(function (rightsOrigin) {
    rightsOrigin.forEach(function (origin) {
      if ( !origin.hasValue("rdfs:comment") ) {
        origin.present(rightsOriginContainer, rightsOriginTemplate);
      } else {
        origin.present(descriptionContainer, descriptionTemplate);
      }
    });
  });
};

export const html = `
<div class="container">
  <h3 about="@" data-template="v-ui:ClassNameLabelTemplate"></h3>
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr class="active">
          <th about="v-s:permissionSubject" property="rdfs:label"></th>
          <th about="v-s:permissionObject" property="rdfs:label"></th>
          <th about="v-s:canCreate" property="rdfs:label"></th>
          <th about="v-s:canRead" property="rdfs:label"></th>
          <th about="v-s:canUpdate" property="rdfs:label"></th>
          <th about="v-s:canDelete" property="rdfs:label"></th>
        </tr>
      </thead>
      <tbody class="rightsOrigin">
        <tr>
          <td about="@" rel="v-s:permissionSubject" data-template="v-ui:LabelLinkTemplate"></td>
          <td about="@" rel="v-s:permissionObject" data-template="v-ui:LabelLinkTemplate"></td>
          <td about="@" property="v-s:canCreate"></td>
          <td about="@" property="v-s:canRead"></td>
          <td about="@" property="v-s:canUpdate"></td>
          <td about="@" property="v-s:canDelete"></td>
        </tr>
      </tbody>
      <tbody class="rights">
        <tr class="active">
          <th></th>
          <th></th>
          <th about="@" property="v-s:canCreate"></th>
          <th about="@" property="v-s:canRead"></th>
          <th about="@" property="v-s:canUpdate"></th>
          <th about="@" property="v-s:canDelete"></th>
        </tr>
      </tbody>
    </table>
  </div>
  <a about="v-s:More" property="rdfs:label" class="btn btn-link" role="button" data-toggle="collapse" href="#description" aria-expanded="false" aria-controls="description"></a>
  <div class="collapse" id="description">
    <pre about="@" property="rdfs:comment" style="border:none;background-color:#fff;"></pre>
  </div>
</div>
`;