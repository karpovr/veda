import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const self = individual;
  function typeHandler (values) {
    const holder = $('#holder', template).empty();
    if (values.length) {
      const blank = new IndividualModel();
      blank['v-fc:targetType'] = values;
      blank['rdf:type'] = [new IndividualModel('v-fc:Blank')];
      blank.present(holder, 'v-fc:BlankTemplate');
    }
  }
  self.on('v-fc:targetType', typeHandler);
  template.one('remove', function () {
    self.off('v-fc:targetType', typeHandler);
  });
  if (self.hasValue('v-fc:targetType')) {
    typeHandler(self['v-fc:targetType']);
  }
};

export const html = `
  <div class="container">
    <div class="sheet">
      <h3 property="rdfs:label"></h3>
      <em about="v-fc:ChooseType" property="rdfs:label"></em>
      <veda-control rel="v-fc:targetType" data-type="link" class="fulltext dropdown"></veda-control>
    </div>
    <div id="holder"></div>
  </div>
`;
