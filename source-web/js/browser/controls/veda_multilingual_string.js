// Multilingual string control

import $ from 'jquery';

import veda from '../../common/veda.js';

import veda_multilingual from './veda_multilingual.js';

$.fn.veda_multilingualString = function (options) {
  const opts = {...defaults, ...options};
  const init = () => {
    this.empty();
    veda_multilingual.call(this, opts);
  };
  init();
  veda.on('language:changed', init);
  this.one('remove', function () {
    veda.off('language:changed', init);
  });
  return this;
};

const defaults = {
  template: `
<div class="input-group">
  <div class="input-group-addon"><small class="language-tag"></small></div>
  <input type="text" class="form-control" lang="" autocomplete="on" />
</div>
  `,
};
