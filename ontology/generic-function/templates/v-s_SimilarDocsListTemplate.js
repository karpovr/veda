import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const isMutual = container.attr('data-mutual') === 'true';

  $('#add-link', template).click(function () {
    $('.links-table', template).removeClass('hidden');
    const cntr = $("[rel='v-s:hasSimilarDoc']", template);
    const SimilarDoc = new IndividualModel();
    SimilarDoc['rdf:type'] = 'v-s:SimilarDoc'
    SimilarDoc['v-s:from'] = individual;

    if (isMutual) {
      SimilarDoc['v-s:mutualMembership'] = [true];
    }
    SimilarDoc.present(cntr, 'v-s:SimilarDocsListTemplate_inline', 'edit').then(function (newRow) {
      newRow = $(newRow);
      SimilarDoc.one('beforeReset', function () {
        newRow.remove();
      });
      SimilarDoc.one('afterSave', function () {
        newRow.remove();
      });
      if (individual.isNew()) {
        newRow.find('.action#save').hide();
      }
    });
  });

  if (veda.appointment.id !== 'cfg:AdministratorAppointment') {
    $('#add-link', template).remove()
  }

  individual.on('afterSave', saveHandler);
  template.one('remove', function () {
    individual.off('afterSave', saveHandler);
  });
  function saveHandler () {
    const children = $("[rel='v-s:hasSimilarDoc']", template).children();
    children.each(function () {
      const link_template = $(this);
      const link_uri = link_template.attr('resource');
      const link = new IndividualModel(link_uri);
      this['v-s:type'] = [];
      link.save();
      link_template[0].dispatchEvent(new Event('view'));
    });
  }
  individual.on('v-s:hasSimilarDoc', linksHandler);
  template.one('remove', function () {
    individual.off('v-s:hasSimilarDoc', linksHandler);
  });
  linksHandler();
  function linksHandler () {
    if (individual.hasValue('v-s:hasSimilarDoc')) {
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
          <th width="80%" about="v-s:Document" property="rdfs:label"></th>
          <th width="19%" about="rdfs:comment" property="rdfs:label"></th>
        </tr>
      </thead>
      <tbody about="@" rel="v-s:hasSimilarDoc" data-embedded="true" data-limit="5" data-more="true" data-template="v-s:SimilarDocsListTemplate_inline"></tbody>
    </table>
    <button class="margin-sm btn btn-success" id="add-link" about="v-s:AddLink" property="rdfs:label"></button>
  </div>
`;
