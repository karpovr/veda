// Datetime generic

import $ from 'jquery';

import moment from 'moment';

import 'adoptedStyleSheets';

import veda from '../../common/veda.js';

import Util from '../../common/util.js';

export default veda_dateTime;

/**
 * Common dateTime behaviour
 * @param {Object} options
 * @return {jQuery}
 * @this jQuery
 */
function veda_dateTime (options) {
  const opts = {...defaults, ...options};
  const control = $(opts.template);
  const format = opts.format;
  const spec = opts.spec;
  const placeholder = this.attr('placeholder') || (spec && spec.hasValue('v-ui:placeholder') ? spec['v-ui:placeholder'].map(Util.formatValue).join(' ') : '');
  const property_uri = opts.property_uri;
  const individual = opts.individual;
  const isSingle = spec && spec.hasValue('v-ui:maxCardinality') ? spec['v-ui:maxCardinality'][0] === 1 : true;
  const input = $('input', control);
  let change;

  input.attr({
    'placeholder': placeholder,
    'name': (individual.hasValue('rdf:type') ? individual['rdf:type'].pop().id + '_' + property_uri : property_uri).toLowerCase().replace(/[-:]/g, '_'),
  });

  const singleValueHandler = function (values) {
    if (values.length) {
      input.val( moment(values[0]).format(format) );
    } else {
      input.val('');
    }
  };

  if (isSingle) {
    change = function (value) {
      individual.set(property_uri, [value]);
    };
    if (individual.hasValue(property_uri)) {
      input.val( moment(individual.get(property_uri)[0]).format(format) );
    }
    individual.on(property_uri, singleValueHandler);
    this.one('remove', function () {
      individual.off(property_uri, singleValueHandler);
    });
  } else {
    change = function (value) {
      individual.set(property_uri, individual.get(property_uri).concat(value));
      input.val('');
    };
  }

  if (spec && spec.hasValue('v-ui:tooltip')) {
    this.tooltip({
      title: spec['v-ui:tooltip'].join(', '),
      placement: 'auto left',
      container: 'body',
      trigger: 'manual',
      animation: false,
    });
    this.one('remove', () => this.tooltip('destroy'));
    input.on('focusin', () => this.tooltip('show'));
    input.on('focusout change', () => this.tooltip('hide'));
  }

  import('datetimepicker/js/bootstrap-datetimepicker.min.js').then(() => {
    import('datetimepicker/css/bootstrap-datetimepicker.min.css').then((module) => {
      const styleSheet = module.default;
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
    });
    control.datetimepicker({
      locale: Object.keys(veda.user.preferences.language).length === 1 ? Object.keys(veda.user.preferences.language)[0] : 'EN',
      allowInputToggle: true,
      format: format,
      sideBySide: true,
      useCurrent: true,
      widgetPositioning: {
        horizontal: 'auto',
        vertical: 'bottom',
      },
    });
  });

  input.on('change focusout', function (e) {
    const value = opts.parser( e.target.value );
    change(value);
  });

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'search') {
      change = function (value) {
        individual.set(property_uri, individual.get(property_uri).concat(value));
        input.val('');
      };
    }
  });

  this.val = function (value) {
    if (!value) return input.val();
    return input.val(value);
  };

  this.one('remove', function () {
    control.data('DateTimePicker').destroy();
  });

  return control;
};

const defaults = {
  template: `
    <div class="input-group date">
      <span class="input-group-addon">
        <span class="glyphicon glyphicon-time"></span>
      </span>
      <input type="text" class="form-control" autocomplete="off"/>
    </div>
  `,
  parser: function (input) {
    if (input) {
      const timestamp = moment(input, 'DD.MM.YYYY HH:mm').toDate();
      return new Date(timestamp);
    }
    return null;
  },
  format: 'DD.MM.YYYY HH:mm',
};
