// Datetime controls

import $ from 'jquery';

import 'adoptedStyleSheets';

import veda from '../../common/veda.js';

import Util from '../../common/util.js';

System.import('moment').then((module) => {
  const moment = module.default;
  System.import('datetimepicker/js/bootstrap-datetimepicker.min.js').then(() => {
    System.import('datetimepicker/css/bootstrap-datetimepicker.min.css').then((module) => {
      const styleSheet = module.default;
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
    });

    /**
     * Common dateTime behaviour
     * @param {Object} options
     * @return {jQuery}
     * @this jQuery
     */
    function veda_dateTime (options) {
      const opts = {...veda_dateTime.defaults, ...options};
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
        control.one('remove', function () {
          individual.off(property_uri, singleValueHandler);
        });
      } else {
        change = function (value) {
          individual.set(property_uri, individual.get(property_uri).concat(value));
          input.val('');
        };
      }

      if (spec && spec.hasValue('v-ui:tooltip')) {
        control.tooltip({
          title: spec['v-ui:tooltip'].join(', '),
          placement: 'auto left',
          container: 'body',
          trigger: 'manual',
          animation: false,
        });
        control.one('remove', function () {
          control.tooltip('destroy');
        });
        input.on('focusin', function () {
          control.tooltip('show');
        }).on('focusout change', function () {
          control.tooltip('hide');
        });
      }

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

    veda_dateTime.defaults = {
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

    // Date control
    $.fn.veda_date = function ( options ) {
      const opts = {...$.fn.veda_date.defaults, ...options};
      const control = veda_dateTime.call(this, opts);

      const tabindex = this.attr('tabindex');
      if (tabindex) {
        this.removeAttr('tabindex');
        control.find('input').attr('tabindex', tabindex);
      }

      this.append(control);
      return this;
    };

    $.fn.veda_date.defaults = {
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
          const timestamp = moment(input, 'DD.MM.YYYY').toDate();
          const symbolicDate = new Date(timestamp);
          const d = symbolicDate.getDate();
          const m = symbolicDate.getMonth();
          const y = symbolicDate.getFullYear();
          symbolicDate.setUTCFullYear(y, m, d);
          symbolicDate.setUTCHours(0, 0, 0, 0);
          return symbolicDate;
        }
        return null;
      },
      format: 'DD.MM.YYYY',
    };

    // Time control
    $.fn.veda_time = function ( options ) {
      const opts = {...$.fn.veda_time.defaults, ...options};
      const control = veda_dateTime.call(this, opts);

      const tabindex = this.attr('tabindex');
      if (tabindex) {
        this.removeAttr('tabindex');
        control.find('input').attr('tabindex', tabindex);
      }

      this.append(control);
      return this;
    };

    $.fn.veda_time.defaults = {
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
          const timestamp = moment(input, 'HH:mm').toDate();
          const result = new Date(timestamp);
          result.setFullYear(1970);
          result.setMonth(0);
          result.setDate(1);
          return result;
        }
        return null;
      },
      format: 'HH:mm',
    };

    // Date-Time control
    $.fn.veda_dateTime = function ( options ) {
      const opts = {...$.fn.veda_dateTime.defaults, ...options};
      const control = veda_dateTime.call(this, opts);

      const tabindex = this.attr('tabindex');
      if (tabindex) {
        this.removeAttr('tabindex');
        control.find('input').attr('tabindex', tabindex);
      }

      this.append(control);
      return this;
    };

    $.fn.veda_dateTime.defaults = {
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
          const absolutDate = new Date(timestamp);
          if ((absolutDate.getUTCHours() + absolutDate.getUTCMinutes() + absolutDate.getUTCSeconds()) === 0) {
            absolutDate.setSeconds(1);
          }
          return absolutDate;
        }
        return null;
      },
      format: 'DD.MM.YYYY HH:mm',
    };
  });
});


