import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  container.siblings(".search-button.pull-right").remove();
};

export const html = `
<div></div>
`;