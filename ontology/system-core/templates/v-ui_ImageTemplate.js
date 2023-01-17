import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.image) {
    template.attr('src', individual.image.src);
  } else {
    template.attr('src', '/files/' + individual.id);
  }
};

export const html = `
<img width="100%" />
`;
