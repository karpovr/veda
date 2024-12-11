import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const placeDescription = individual['v-s:placeDescription'];
  template.attr('href', placeDescription);
};

export const html = `
  <a href="#" target="_blank">
    <span>МЧД</span>
  </a>
`;
