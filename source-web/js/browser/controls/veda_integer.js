// Integer control

import $ from 'jquery';

import veda_literal from './veda_literal.js';

$.fn.veda_integer = function ( options ) {
  const opts = {...defaults, ...options};
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

const defaults = {
  template: `<input type="number" step="1" class="form-control" placeholder="#" />`,
  parser: function (input) {
    const int = parseInt( input.split(' ').join('').split(',').join('.'), 10 );
    return !isNaN(int) ? int : null;
  },
};
