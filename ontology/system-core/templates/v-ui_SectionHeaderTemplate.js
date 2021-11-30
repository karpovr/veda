import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  $("span.glyphicon", template).click(function(){
    var self = $(this);
    self.toggleClass("glyphicon-chevron-left glyphicon-chevron-down");
    var parentHeader = self.closest(".section-header");
    parentHeader.siblings(".section-content").toggle();
  });
  var sectionContent = template.closest(".section-header").siblings(".section-content");
  if (sectionContent.data("default-closed") == true) {
    $("span.glyphicon", template).click();
  };
};

export const html = `
<div class="pull-right">
  <span class="glyphicon glyphicon-chevron-down"></span>
</div>
`;