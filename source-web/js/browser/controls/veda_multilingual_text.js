// Multilingual text control

import $ from 'jquery';

import autosize from 'autosize';

import veda from '../../common/veda.js';

import veda_multilingual from './veda_multilingual.js';

$.fn.veda_multilingualText = function (options) {
  const opts = {...$.fn.veda_multilingualText.defaults, ...options};
  const self = $(this);
  const init = function () {
    self.empty();
    veda_multilingual.call(self, opts);
    const ta = $('textarea', self);
    ta.attr('rows', self.attr('rows'));
    autosize(ta);
    self.on('edit', function () {
      autosize.update(ta);
    });
    self.one('remove', function () {
      autosize.destroy(ta);
    });
  };
  init();
  veda.on('language:changed', init);
  self.one('remove', function () {
    veda.off('language:changed', init);
  });
  return this;
};

$.fn.veda_multilingualText.defaults = {
  template: `
<div class="input-group">
  <div class="input-group-addon"><small class="language-tag"></small></div>
  <textarea class="form-control" lang="" rows="1"></textarea>
</div>
  `,
};
