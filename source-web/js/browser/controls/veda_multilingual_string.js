// Multilingual string control

import $ from 'jquery';

import veda from '../../common/veda.js';

import veda_multilingual from './veda_multilingual.js';

$.fn.veda_multilingualString = function (options) {
  const opts = {...$.fn.veda_multilingualString.defaults, ...options};
  const self = $(this);
  const init = function () {
    self.empty();
    veda_multilingual.call(self, opts);
  };
  init();
  veda.on('language:changed', init);
  self.one('remove', function () {
    veda.off('language:changed', init);
  });
  return this;
};

$.fn.veda_multilingualString.defaults = {
  template: `
<div class="input-group">
  <div class="input-group-addon"><small class="language-tag"></small></div>
  <input type="text" class="form-control" lang="" autocomplete="on" />
</div>
  `,
};
