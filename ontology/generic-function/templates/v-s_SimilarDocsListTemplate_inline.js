import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const displayedDoc = container.closest('[resource]').attr('resource');
  if (individual.hasValue('v-s:from', displayedDoc)) {
    $('.link-from', template).remove();
  } else if (individual.hasValue('v-s:to', displayedDoc)) {
    $('.link-to', template).remove();
  }

  template.on('validate', function () {
    const result = {};
    if (!individual.hasValue('v-s:to')) {
      result['v-s:type'] = {
        state: individual.hasValue('v-s:type'),
        cause: ['v-ui:minCardinality'],
      };
    }
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  function documentHandler () {
    if (individual.isNew()) {
      if (individual.hasValue('v-s:to')) {
        individual['v-s:type'] = [];
        $('veda-control[rel="v-s:type"]', template).addClass('hidden');
      } else {
        $('veda-control[rel="v-s:type"]', template).removeClass('hidden');
      }
    }
  }
  individual.on('v-s:to', documentHandler);
  individual.on('v-s:type', documentHandler);
  template.one('remove', function () {
    individual.off('v-s:to', documentHandler);
    individual.off('v-s:type', documentHandler);
  });
  documentHandler.apply(individual);
};

export const html = `
  <tr>
    <td><a href="#/@" class="glyphicon glyphicon-search view -edit -search"></a></td>
    <td>
      <veda-control
        data-type="link"
        rel="v-s:type"
        data-single="true"
        class="fulltext dropdown -view edit -search"
        data-query-prefix="'rdfs:subClassOf'==='v-s:UserSearchableDocument'"></veda-control>
      <veda-control
        data-type="link"
        rel="v-s:to"
        class="-view edit search fulltext disabled"
        data-template="{@.rdf:type.rdfs:label}: {@.rdfs:label}"
        data-query-prefix="'rdf:type'=='{@.v-s:type.id}'"></veda-control>
      <span class="link-from" about="@" rel="v-s:from" data-template="v-ui:ClassNameLabelLinkTemplate"></span>
      <span class="link-to view -edit -search" about="@" rel="v-s:to" data-template="v-ui:ClassNameLabelLinkTemplate"></span>
    </td>

    <td>
      <div class="view -edit -search" about="@" property="rdfs:comment"></div>
      <veda-control data-type="string" property="rdfs:comment" class="-view edit search"></veda-control>
    </td>

    <td><div class="pull-right" about="@" data-template="v-ui:IconButtonsTemplate" data-embedded="true"></div></td>
  </tr>
`;
