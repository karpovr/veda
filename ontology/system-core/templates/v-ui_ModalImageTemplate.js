import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('v-s:thumbnail')) {
    template.removeAttr('rel');
  }
  template.click(function (e) {
    e.preventDefault();
    const modal = $($('#minimal-modal-template').html()).modal({keyboard: true, show: false}).appendTo('body');
    const modalBody = modal.find('.modal-body');
    individual.present(modalBody, 'v-ui:ImageTemplate');
    modal.modal('show');
    template.one('remove', function () {
      modal.modal('hide').remove();
    });
  });
};

export const html = '<a class="show-modal" href="#" about="@" rel="v-s:thumbnail" data-template="v-ui:ImageTemplate"></a>';
