// Decimal control

import $ from 'jquery';

import veda_literal from './veda_literal.js';

$.fn.veda_decimal = function ( options ) {
  const opts = {...$.fn.veda_decimal.defaults, ...options};
  const control = veda_literal.call(this, opts);

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  }

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'search') {
      control.isSingle = false;
    }
  });
  this.append(control);
  return this;
};

$.fn.veda_decimal.defaults = {
  template: `<input type="text" class="form-control" placeholder="#.#" />`,
  parser: function (input) {
    const float = parseFloat( input.split(' ').join('').split(',').join('.') );
    return !isNaN(float) ? float : null;
  },
};
