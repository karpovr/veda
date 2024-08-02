// Generic literal control

import $ from 'jquery';

import Util from '../../common/util.js';

export default veda_literal;

/**
 * Basic literal input.
 * @param {Object} options
 * @this jQuery
 * @return {jQuery}
 */
function veda_literal (options) {
  const opts = {...defaults, ...options};
  const input = $(opts.template);
  const spec = opts.spec;
  const placeholder = this.attr('placeholder') || (spec && spec.hasValue('v-ui:placeholder') ? spec['v-ui:placeholder'].map(Util.formatValue).join(' ') : '');
  const property_uri = opts.property_uri;
  const individual = opts.individual;
  let timeout;

  const isSpecSingle = spec && spec.hasValue('v-ui:maxCardinality') ? spec['v-ui:maxCardinality'][0] === 1 : true;
  input.isSingle = typeof opts.isSingle !== 'undefined' ? opts.isSingle : isSpecSingle;

  input
    .attr({
      'placeholder': placeholder,
      'name': (individual.hasValue('rdf:type') ? individual['rdf:type'].pop().id + '_' + property_uri : property_uri).toLowerCase().replace(/[-:]/g, '_'),
    })
    .on('change focusout', changeHandler)
    .keyup((e) => {
      if (!input.isSingle) {
        return;
      }
      if (e.which === 13) {
        input.change();
      }
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(keyupHandler, 50, e);
    });

  individual.on(property_uri, propertyModifiedHandler);
  this.one('remove', function () {
    individual.off(property_uri, propertyModifiedHandler);
  });
  propertyModifiedHandler();

  /**
   * Individual property handler.
   * @return {void}
   */
  function propertyModifiedHandler () {
    if (input.isSingle) {
      const field = input[0];
      let value = Util.formatValue( individual.get(property_uri)[0] );
      value = typeof value !== 'undefined' ? value : '';
      if (field.value != value) {
        try {
          const start_shift = field.selectionStart - field.value.length;
          const end_shift = field.selectionEnd - field.value.length;
          field.value = value;
          field.selectionStart = value.length + start_shift;
          field.selectionEnd = value.length + end_shift;
        } catch (ex) {
          field.value = value;
          console.log('selectionStart/End error:', property_uri, value, typeof value);
        } finally {
          input.change();
        }
      }
    }
  }

  /**
   * Input change handler
   * @param {Event} e
   * @this jQuery
   * @return {void}
   */
  function changeHandler (e) {
    const value = opts.parser(this.value);
    if (input.isSingle) {
      individual.set(property_uri, [value]);
    } else {
      individual.set(property_uri, individual.get(property_uri).concat(value));
      this.value = '';
    }
  }

  /**
   * Input keyup handler
   * @param {Event} e
   * @this jQuery
   * @return {void}
   */
  function keyupHandler (e) {
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
  this.on('view edit search', function (e) {
    e.stopPropagation();
  });
  this.val = function (value) {
    if (!value) return input.val();
    return input.val( Util.formatValue(value) );
  };
  if (spec && spec.hasValue('v-ui:tooltip')) {
    input.tooltip({
      title: spec['v-ui:tooltip'].map(Util.formatValue).join(' '),
      placement: 'bottom',
      container: 'body',
      trigger: 'manual',
      animation: false,
    }).on('focusin', function () {
      input.tooltip('show');
    }).on('focusout change', function () {
      input.tooltip('hide');
    });
    this.one('remove', function () {
      input.tooltip('destroy');
    });
  }
  return input;
}

const defaults = {
  template: '<input type="text" class="form-control" autocomplete="on" />',
  parser: function (input) {
    return (input || null);
  },
};
