import $ from 'jquery';
import {clear} from '/js/browser/dom_helpers.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const saver = async () => {
    await individual.saveAll();
    displayImage();
  };
  individual.on('v-s:hasImage', saver);
  template.one('remove', () => individual.off('v-s:hasImage', saver));

  if (!individual.hasValue('v-s:hasImage')) {
    individual['v-s:hasImage'] = [new IndividualModel('v-s:DefaultPhoto')];
  }
  displayImage();

  function displayImage () {
    const imageContainer = $('.image-container', template)[0];
    clear(imageContainer);
    if (individual.hasValue('v-s:hasImage')) {
      const imageIndividual = individual['v-s:hasImage'][0];
      imageIndividual.present(imageContainer, 'v-ui:ImageTemplate');
    }
  }

  $('.clear-image', template).on('click', () => individual.clearValue('v-s:hasImage'));
};

export const html = `
  <div class="sheet" style="display:flex;flex-flow:column;width:100%;position:relative;">
    <div class="image-container"></div>
    <veda-control
      style="margin-top:1em;"
      data-type="file"
      accept=".jpg, .jpeg"
      data-ratio="1.3"
      data-max-width="1000"
      property="v-s:hasImage"
      class="-view edit search"></veda-control>
    <button class="-view edit search btn btn-xs btn-default clear-image fa fa-times" style="position:absolute;top:2em;right:2em;width:2em;height:2em"></button>
  </div>
`;
