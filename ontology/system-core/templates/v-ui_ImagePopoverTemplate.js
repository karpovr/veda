import $ from 'jquery';
import CommonUtil from '/js/common/util.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);
  let content;
  if (individual.image) {
    content = `<img style="width:100%;height:100%;" draggable="false" src=${individual.image.src}>`
  } else {
    content = `<img style="width:100%;height:100%;" draggable="false" src=${'/files/' + individual.id}>`
    template.attr('src', '/files/' + individual.id);
  }

  template.popover({
    content: content,
    container: template.parent(),
    trigger: 'click',
    placement: 'bottom',
    animation: false,
    html: true
  });
  template.on('inserted.bs.popover', function() {
    $('.popover-content', container).css('white-space', 'pre-line');
  })
};

export const html = `
  <span tabindex="0" role="button" class="glyphicon glyphicon-info-sign text-primary">
    <style scoped>
      .popover {
        max-width: 800px;
      }
      .arrow {
        left: 15% !important;
      }
    </style>
  </span>
`;
