// Multilingual text control

import $ from 'jquery';

import autosize from 'autosize';

import veda from '../../common/veda.js';

import veda_multilingual from './veda_multilingual.js';

$.fn.veda_multilingualText = function (options) {
  const opts = {...defaults, ...options};
  const init = () => {
    this.empty();
    veda_multilingual.call(this, opts);
    const ta = $('textarea', self);
    ta.attr('rows', this.attr('rows'));
    autosize(ta);
    this.on('edit', () => autosize.update(ta));
    this.one('remove', () => autosize.destroy(ta));
  };
  init();
  veda.on('language:changed', init);
  this.one('remove', () => veda.off('language:changed', init));
  return this;
};

const defaults = {
  template: `
<div class="input-group">
  <div class="input-group-addon"><small class="language-tag"></small></div>
  <textarea class="form-control" lang="" rows="1"></textarea>
</div>
  `,
};
