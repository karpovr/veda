// Decimal control

import $ from 'jquery';

import Util from '../../common/util.js';

import veda_literal from './veda_literal.js';

$.fn.veda_decimal = function ( options ) {
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
  template: `<input type="text" class="form-control" placeholder="#.#" />`,
  parser: function (input) {
    const float = parseFloat( input.replace(/\s/g ,'').replace(/\.|,/g, '.') );
    if (isNaN(float)) return null;
    return Util.isInteger(float) ? float + '.0' : float;
  },
};
