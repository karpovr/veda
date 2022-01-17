import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const lbl = $('.lbl', template);
  const labelUri = container.data('label');
  const modalTemplate = container.data('modal-template');
  if (labelUri) {
    lbl.attr({about: labelUri, property: 'rdfs:label'});
  }
  template.click(function () {
    BrowserUtil.showModal(individual, modalTemplate);
  });
};

export const html = `
  <button class="btn btn-link btn-sm">
    <span class="glyphicon glyphicon-zoom-in"></span>
    <span class="lbl"></span>
  </button>
`;
