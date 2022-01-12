import $ from 'jquery';
import riot from 'riot';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.on('click', function (e) {
    e.preventDefault();
    let newMode = container.data('mode');
    const parentTmpl = template.parent().closest('[resource]');
    if (!newMode && parentTmpl.attr('resource') === individual.id) {
      newMode = parentTmpl.data('mode');
    }

    if ($('body').hasClass('modal-open')) {
      $('.modal').modal('hide').remove();
    }

    let modal = $('#notification-modal-template').html();
    modal = $(modal).modal({show: false});
    $('body').append(modal);
    modal.modal('show');

    if (newMode == 'edit') {
      modal.find('#follow').remove();
    } else {
      modal.find('#follow').click(function () {
        const resourceTemplate = modal.find('[resource]').first();
        const uri = resourceTemplate.attr('resource');
        const mode = resourceTemplate.data('mode');
        modal.modal('hide');
        riot.route(['#', uri, '#main', undefined, mode].join('/'));
      });
    }

    template.one('remove', function () {
      modal.modal('hide').remove();
    });
    const cntr = $('.modal-body', modal);
    const ok = $('#ok', modal);
    cntr.on('valid', function () {
      ok.removeAttr('disabled');
    });
    cntr.on('invalid', function () {
      ok.attr('disabled', 'disabled');
    });

    individual.present(cntr, undefined, newMode).then(function (tmpl) {
      if (newMode === 'edit') {
        tmpl = $(tmpl);
        ok.parent().removeClass('hide');
        tmpl.on('internal-validated', function (e, validation) {
          if (validation.state) {
            ok.removeAttr('disabled');
          } else {
            ok.attr('disabled', 'disabled');
          }
          e.stopPropagation();
        });
        $('.actions', tmpl).remove();
      }
    });
    individual.one('afterSave', function () {
      modal.modal('hide').remove();
    });
  });
};

export const html = `
  <a href="#" class="glyphicon glyphicon-zoom-in" tabindex="-1"></a>
`;
