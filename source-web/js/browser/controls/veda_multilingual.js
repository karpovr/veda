// Generic multilingual control

import veda from '../../common/veda.js';

import Util from '../../common/util.js';

export default veda_multilingual;

/**
 * Generic multilingual input behaviour
 * @param {Object} options
 * @return {jQuery}
 * @this jQuery
 */
function veda_multilingual (options) {
  const opts = {...defaults, ...options};
  const self = this;
  const individual = opts.individual;
  const property_uri = opts.property_uri;
  const spec = opts.spec;
  const placeholder = this.attr('placeholder') || (spec && spec.hasValue('v-ui:placeholder') ? spec['v-ui:placeholder'].map(Util.formatValue).join(' ') : '');
  let timeout;

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    this.find('input').attr('tabindex', tabindex);
  }

  Object.keys(veda.user.preferences.language).map((language_name) => {
    const localedInput = $(opts.template);

    localedInput.find('.language-tag').text(language_name);

    const formControl = localedInput.find('.form-control');
    formControl
      .attr({
        'lang': language_name,
        'placeholder': placeholder,
        'name': (individual.hasValue('rdf:type') ? individual['rdf:type'].pop().id + '_' + property_uri : property_uri).toLowerCase().replace(/[-:]/g, '_'),
      })
      .on('change focusout', function () {
        const values = self.find('.form-control').map((i, el) => {
          return opts.parser( el.value, el );
        }).get();
        individual.set(property_uri, values);
      })
      .keyup((e) => {
        if (e.which === 13) {
          formControl.change();
        }
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(keyupHandler, 50, e);
      });

    individual.get(property_uri).forEach((value) => {
      if ( value.language === language_name || !value.language ) {
        formControl.val(value);
      }
    });

    self.append( localedInput );
  });

  const input = self.find('.form-control');

  individual.on(property_uri, handler);
  self.one('remove', function () {
    individual.off(property_uri, handler);
  });

  /**
   * Input keyup handler
   * @param {Event} e
   * @return {void}
   */
  function keyupHandler (e) {
    const input = $(e.target);
    if (
      e.which !== 188 &&
      e.which !== 190 &&
      e.which !== 110 &&
      input.val() !== input.data('prev')
    ) {
      input.data('prev', input.val());
      input.change();
    }
    if (e.which !== 9) {
      input.focus();
    }
  }

  /**
   * Individual property change handler
   * @param {Array} values
   * @return {void}
   */
  function handler (values) {
    input.each((i, el) => {
      const self = el;
      const lang = el.lang;
      individual.get(property_uri).forEach((value) => {
        if ( value.language === lang || !value.language && self.value != value) {
          try {
            if (self === document.activeElement) {
              const start_shift = self.selectionStart - self.value.length;
              const end_shift = self.selectionEnd - self.value.length;
              self.value = value;
              self.selectionStart = value.length + start_shift;
              self.selectionEnd = value.length + end_shift;
            } else {
              self.value = value;
            }
          } catch (ex) {
            self.value = value;
            console.log('selectionStart/End error:', property_uri, value, typeof value);
          }
        }
      });
    });
  }

  self.on('view edit search', function (e) {
    e.stopPropagation();
  });

  self.val = function (value) {
    if (!value) {
      return parser( input.val() );
    }
    input.each((i, el) => {
      if (value.language === el.lang || !value.language) {
        el.value = value.toString();
      }
    });
  };

  if (spec && spec.hasValue('v-ui:tooltip')) {
    self.tooltip({
      title: spec['v-ui:tooltip'].join(', '),
      placement: 'bottom',
      container: 'body',
      trigger: 'manual',
      animation: false,
    }).one('remove', function () {
      self.tooltip('destroy');
    });
    input.on('focusin', function () {
      self.tooltip('show');
    }).on('focusout change', function () {
      self.tooltip('hide');
    });
  }

  return self;
};

const defaults = {
  parser: function (input, el) {
    if (input) {
      let value = String(input);
      const lang = $(el).attr('lang');
      if (lang) {
        value = value + '^' + lang;
      }
      return value;
    }
    return null;
  },
};
