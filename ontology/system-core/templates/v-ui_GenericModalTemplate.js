import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const lbl = $('.lbl', template);
  const props = container.attr('values').split(' ');
  const reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_\.])*$/;
  const labelValues = [];
  for (const prop of props) {
    if (reg_uri.test(prop)) {
      if (individual[prop][0] instanceof IndividualModel) {
        for (const value of individual[prop]) {
          await value.load();
          labelValues.push(value.toString());
        }
      } else {
        labelValues.push(...individual[prop]);
      }
    } else {
      labelValues.push(prop);
    }
  }
  lbl.text(labelValues.join(' '));
  const modalTemplate = container.data('modal-template');
  template.click(function () {
    BrowserUtil.showModal(individual, modalTemplate);
  });
};

export const html = `
  <button style="padding: 0px" class="btn btn-link">
    <span class="glyphicon glyphicon-zoom-in"></span>
    <span class="lbl"></span>
  </button>
`;
