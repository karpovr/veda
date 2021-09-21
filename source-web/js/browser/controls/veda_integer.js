// Integer control

import $ from 'jquery';

import veda_literal from './veda_literal.js';

$.fn.veda_integer = function ( options ) {
  const opts = $.extend( {}, $.fn.veda_integer.defaults, options );
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

$.fn.veda_integer.defaults = {
  template: `<input type="text" class="form-control" placeholder="#" />`,
  parser: function (input) {
    const int = parseInt( input.split(' ').join('').split(',').join('.'), 10 );
    return !isNaN(int) ? int : null;
  },
};
