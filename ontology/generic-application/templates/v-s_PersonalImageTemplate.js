import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  individual.on('v-s:hasImage', individual.save);
  template.one('remove', function () {
    individual.off('v-s:hasImage', individual.save);
  });
  if (!individual.hasValue('v-s:hasImage')) {
    individual['v-s:hasImage'] = [new IndividualModel('v-s:DefaultPhoto')];
  }
};

export const html = `
  <div class="sheet" style="display: flex; flex-flow: column; width: 100%">
    <div rel="v-s:hasImage" data-template="v-ui:ImageTemplate"></div>
    <br />
    <div class="text-center" style="margin-top: auto;">
      <veda-control
        data-type="file"
        accept=".jpg, .jpeg"
        data-ratio="1.3"
        data-max-width="1000"
        property="v-s:hasImage"
        class="-view edit search"></veda-control>
    </div>
  </div>
`;
