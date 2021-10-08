// Text control

import $ from 'jquery';

import autosize from 'autosize';

import veda_literal from './veda_literal.js';

$.fn.veda_text = function ( options ) {
  const opts = {...defaults, ...options};
  const control = veda_literal.call(this, opts);

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  }

  control.attr('rows', this.attr('rows'));
  autosize(control);
  this.on('edit', function () {
    autosize.update(control);
  });
  this.one('remove', function () {
    autosize.destroy(control);
  });
  this.append(control);
  return this;
};

const defaults = {
  template: `<textarea class="form-control" rows="1" />`,
  parser: function (input) {
    return (input ? String(input) : null);
  },
  isSingle: true,
};
