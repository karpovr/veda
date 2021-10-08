// String control

import $ from 'jquery';

import veda_literal from './veda_literal.js';

$.fn.veda_string = function ( options ) {
  const opts = {...defaults, ...options};
  const control = veda_literal.call(this, opts);

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  }
  const inputType = this.data('input-type');
  if (inputType) {
    control.attr('type', inputType);
  }

  this.append(control);
  return this;
};

const defaults = {
  template: `<input type="text" class="form-control" autocomplete="on" />`,
  parser: function (input) {
    return (input ? String(input) : null);
  },
  isSingle: true,
};
