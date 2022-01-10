import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.image) {
    template.children().attr('src', individual.image.src);
  } else {
    template.children().attr('src', '/files/' + individual.id);
  }
};

export const html = '<div><img width="100%" /></div>';
