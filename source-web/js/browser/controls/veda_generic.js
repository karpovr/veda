// Generic control

import $ from 'jquery';

import IndividualModel from '../../common/individual_model.js';

import veda_literal from './veda_literal.js';

$.fn.veda_generic = function ( options ) {
  const opts = $.extend( {}, $.fn.veda_generic.defaults, options );
  const control = veda_literal.call(this, opts);

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  }

  this.append(control);
  return this;
};

$.fn.veda_generic.defaults = {
  template: `<input type="text" class="form-control" autocomplete="on" />`,
  parser: function (input) {
    if (!input || !input.trim()) {
      return null;
    } else if ( Date.parse(input) && (/^\d{4}-\d{2}-\d{2}.*$/).test(input) ) {
      return new Date(input);
    } else if ( !isNaN( input.split(' ').join('').split(',').join('.') ) ) {
      return parseFloat( input.split(' ').join('').split(',').join('.') );
    } else if ( input === 'true' ) {
      return true;
    } else if ( input === 'false' ) {
      return false;
    } else {
      const individ = new IndividualModel(input);
      if ( individ.isSync() && !individ.isNew() ) {
        return individ;
      }
    }
    return input;
  },
};
