import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  $("input", template).keydown(function (e) {
    if (e.which === 13) {
      var value = this.value;
      individual.set("*", [value]);
      container.siblings(".search-button").click();
    }
  });
};

export const html = `
<div>
  <veda-control property="*" data-type="string"></veda-control>
</div>
`;