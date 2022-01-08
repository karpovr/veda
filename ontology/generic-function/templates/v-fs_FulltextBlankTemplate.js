import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var find = container.siblings('.search-actions').find('#search-button.search-button');
  var customFind = $('#custom-search-button.search-button', template);
  customFind.click(function () {
    find.click();
  });

  $('input', template).keydown(function (e) {
    if (e.which === 13 && this.value) {
      var value = this.value;
      individual.set('*', [value]);
      find.click();
    }
  });
  function propertyModifiedHandler() {
    if (individual.hasValue('*')) {
      customFind.removeAttr('disabled', 'disabled');
      find.removeAttr('disabled', 'disabled');
    } else {
      customFind.attr('disabled', 'disabled');
      find.attr('disabled', 'disabled');
    }
  }
  propertyModifiedHandler();
  individual.on('propertyModified', propertyModifiedHandler);
  template.one('remove', function () {
    individual.off('propertyModified', propertyModifiedHandler);
  });
};

export const html = `
  <div>
    <style>
      .input-group input {
        border-top-left-radius: 4px !important;
        border-bottom-left-radius: 4px !important;
      }
    </style>
    <em about="v-fs:SearchForContentBundle" property="rdfs:label"></em>
    <div class="input-group">
      <veda-control property="*" data-type="string" placeholder="Введите запрос"></veda-control>
      <span class="input-group-btn">
        <button class="btn btn-primary search-button" id="custom-search-button" type="button" about="v-fs:Find" property="rdfs:label"></button>
      </span>
    </div>
  </div>
`;
