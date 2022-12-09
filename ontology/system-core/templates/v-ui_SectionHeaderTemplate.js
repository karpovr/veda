import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('a.glyphicon', template).click(function (e) {
    e.preventDefault();
    const self = $(this);
    self.toggleClass('glyphicon-chevron-left glyphicon-chevron-down');
    const parentHeader = self.closest('.section-header');
    parentHeader.siblings('.section-content').toggle();
  });
  const sectionContent = template.closest('.section-header').siblings('.section-content');
  if (sectionContent.data('default-closed') == true) {
    $('span.glyphicon', template).click();
  }
};

export const html = `
  <div class="pull-right">
    <a href="#" class="glyphicon glyphicon-chevron-down"></a>
  </div>
`;
