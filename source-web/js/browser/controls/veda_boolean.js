// Boolean control

import $ from 'jquery';

$.fn.veda_boolean = function ( options ) {
  const opts = $.extend( {}, $.fn.veda_boolean.defaults, options );
  const control = $( opts.template );
  const individual = opts.individual;
  const property_uri = opts.property_uri;
  const spec = opts.spec;

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  }

  const handler = function (doc_property_uri) {
    if (individual.hasValue(property_uri)) {
      if (individual.get(property_uri)[0] === true) {
        control.prop('checked', true).prop('readonly', false).prop('indeterminate', false);
      } else {
        control.prop('checked', false).prop('readonly', false).prop('indeterminate', false);
      }
    } else {
      control.prop('readonly', true).prop('indeterminate', true);
    }
  };
  handler();

  individual.on(property_uri, handler);
  this.one('remove', function () {
    individual.off(property_uri, handler);
  });

  control.click(() => {
    if ( control.prop('readonly') ) {
      individual.set(property_uri, [false]);
    } else if ( !control.prop('checked') ) {
      individual.set(property_uri, []);
    } else {
      individual.set(property_uri, [true]);
    }
  });

  if ( control.closest('.checkbox.disabled').length ) {
    control.attr('disabled', 'disabled');
  }

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'view') {
      control.attr('disabled', 'disabled');
    } else {
      if ( control.closest('.checkbox.disabled').length ) {
        control.attr('disabled', 'disabled');
      } else {
        control.removeAttr('disabled');
      }
      if (spec && spec.hasValue('v-ui:tooltip')) {
        control.parents('label').tooltip({
          title: spec['v-ui:tooltip'].join(', '),
          placement: 'bottom',
          container: control,
          trigger: 'hover',
          animation: false,
        });
      }
    }
  });
  this.append(control);
  return this;
};
$.fn.veda_boolean.defaults = {
  template: $('#boolean-control-template').html(),
};
