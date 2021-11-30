import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  var rights = "";
  rights += (this.hasValue("v-s:canCreate", true) ? "C" : "");
  rights += (this.hasValue("v-s:canRead",   true) ? "R" : "");
  rights += (this.hasValue("v-s:canUpdate", true) ? "U" : "");
  rights += (this.hasValue("v-s:canDelete", true) ? "D" : "");
  $(template).text(rights);
};

export const html = `
<span></span>
`;