import $ from 'jquery';
import Util from '/js/common/util.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  var lbl = $(".lbl", template);
  var labelUri = container.data("label");
  var modalTemplate = container.data("modal-template");
  if (labelUri) {
    lbl.attr({"about": labelUri, "property": "rdfs:label"});
  }
  template.click(function () {
    Util.showModal(individual, modalTemplate);
  });
};

export const html = `
<button class="btn btn-link btn-sm">
  <span class="glyphicon glyphicon-zoom-in"></span>
  <span class="lbl"></span>
</button>
`;