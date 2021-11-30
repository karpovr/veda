import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if ( individual.hasValue("rdf:type", "v-s:Appointment") ) {
    template.children().not(".app").remove();
  } else if ( individual.hasValue("rdf:type", "v-s:Department") || individual.hasValue("rdf:type", "v-s:OrgGroup") ) {
    template.children().not(".dep").remove();
  } else if ( individual.hasValue("rdf:type", "v-s:Organization") ) {
    template.children().not(".org").remove();
  }
};

export const html = `
<div>
  <hr class="app dep org margin-md">
  <span style="width:20px" class="app fa fa-lg fa-user-o"></span>
  <span style="width:20px" class="dep fa fa-lg fa-folder-o"></span>
  <span style="width:20px" class="org fa fa-lg fa-sitemap"></span>
  <strong class="app" about="@" rel="v-s:employee">
    <span property="rdfs:label"></span>
  </strong>
  <span class="app" about="@" rel="v-s:occupation">
    <span property="rdfs:label"></span>
  </span>
  <span class="app" about="@" rel="v-s:employee">
    <span property="v-s:phone"></span>
  </span>
  <span class="app" about="@" rel="v-s:employee">
    <span rel="v-s:hasAccount" data-template="v-s:ContactsInUnitSearchResultTemplate_unit_mailbox"></span>
  </span>
  <strong class="dep org" about="@" property="rdfs:label"></strong>
</div>
`;