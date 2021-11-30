import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  function documentHandler() {
    if ( this.hasValue('rdfs:label') && !this.hasValue('rdf:type') ) {
      $('veda-control[rel="rdf:type"]', template).addClass('has-error');
      $('.search-button, .more-results, .all-results').attr('disabled', 'disabled');
    } else {
      $('veda-control[rel="rdf:type"]', template).removeClass('has-error');
      $('.search-button, .more-results, .all-results').removeAttr('disabled');
    }
  }
  individual.on('propertyModified', documentHandler);
  template.one('remove', function () {
    individual.off('propertyModified', documentHandler);
  });
  documentHandler.call(this);
};

export const html = `
<div class="row">
  <div class="col-md-6">
    <em about="v-ft:DocumentTypeBundle" property="rdfs:label"></em>
    <veda-control rel="rdf:type" data-type="link" class="dropdown fulltext" data-single="true" data-placeholder=" " data-query-prefix="'rdfs:subClassOf'==='v-s:UserSearchableDocument'"></veda-control>
  </div>
  <div class="col-md-6">
    <em about="v-ft:DocumentBundle" property="rdfs:label"></em>
    <veda-control property="rdfs:label" data-type="string"></veda-control>
  </div>
</div>
`;