import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const isMutual = container.attr('data-mutual') === 'true';

  $('#add-link', template).click(function () {
    $('.links-table', template).removeClass('hidden');
    const cntr = $("[rel='v-s:hasLink']", template);
    const Link = new IndividualModel();
    Link['rdf:type'] = 'v-s:Link'
    Link['v-s:from'] = individual;

    if (isMutual) {
      Link['v-s:mutualMembership'] = [true];
    }
    Link.present(cntr, 'v-s:LinksListTemplate_inline', 'edit').then(function (newRow) {
      newRow = $(newRow);
      Link.one('beforeReset', function () {
        newRow.remove();
      });
      Link.one('afterSave', function () {
        newRow.remove();
      });
      if (individual.isNew()) {
        newRow.find('.action#save').hide();
      }
    });
  });

  individual.on('afterSave', saveHandler);
  template.one('remove', function () {
    individual.off('afterSave', saveHandler);
  });
  function saveHandler () {
    const children = $("[rel='v-s:hasLink']", template).children();
    children.each(function () {
      const link_template = $(this);
      const link_uri = link_template.attr('resource');
      const link = new IndividualModel(link_uri);
      this['v-s:type'] = [];
      link.save();
      link_template[0].dispatchEvent(new Event('view'));
    });
  }
  individual.on('v-s:hasLink', linksHandler);
  template.one('remove', function () {
    individual.off('v-s:hasLink', linksHandler);
  });
  linksHandler();
  function linksHandler () {
    if (individual.hasValue('v-s:hasLink')) {
      $('.links-table', template).removeClass('hidden');
    } else {
      $('.links-table', template).addClass('hidden');
    }
  }
};

export const html = `
  <div>
    <table class="hidden links-table table table-condensed table-striped table-sortable">
      <thead>
        <tr>
          <th width="1%"><span class="glyphicon glyphicon-search"></span></th>
          <th width="45%" about="v-s:Document" property="rdfs:label"></th>
          <th width="10%" about="v-s:created" property="rdfs:label"></th>
          <th width="20%" about="rdfs:comment" property="rdfs:label"></th>
          <th width="15%" about="v-s:creator" property="rdfs:label"></th>
          <th width="9%"></th>
        </tr>
      </thead>
      <tbody about="@" rel="v-s:hasLink" data-embedded="true" data-limit="5" data-more="true" data-template="v-s:LinksListTemplate_inline"></tbody>
    </table>
    <button class="margin-sm btn btn-success pull-right" id="add-link" about="v-s:AddLink" property="rdfs:label"></button>
  </div>
`;
