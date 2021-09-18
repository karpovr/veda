// Checkbox control

import $ from 'jquery';

import IndividualModel from '../../common/individual_model.js';

import {interpolate, ftQuery, renderValue} from './veda_control_util.js';

$.fn.veda_checkbox = function (params) {
  const opts = $.extend( {}, $.fn.veda_checkbox.defaults, params );
  const self = this;
  const individual = opts.individual;
  const property_uri = opts.property_uri || opts.rel_uri;
  const spec = opts.spec;
  const rangeRestriction = spec && spec.hasValue('v-ui:rangeRestriction') ? spec['v-ui:rangeRestriction'][0] : undefined;
  const range = rangeRestriction ? [rangeRestriction] : (new IndividualModel(property_uri))['rdfs:range'];
  const queryPrefix = this.attr('data-query-prefix') || ( spec && spec.hasValue('v-ui:queryPrefix') ? spec['v-ui:queryPrefix'][0] : range.map((item) => {
    return '\'rdf:type\'===\'' + item.id + '\'';
  }).join(' || ') );
  const sort = this.attr('data-sort') || ( spec && spec.hasValue('v-ui:sort') && spec['v-ui:sort'][0].toString() );
  const source = this.attr('data-source') || undefined;
  const template = this.attr('data-template') || '{@.rdfs:label}';
  let options = [];
  let withDeleted = false || this.attr('data-deleted');

  populate();

  individual.on(property_uri, handler);
  this.one('remove', function () {
    individual.off(property_uri, handler);
  });

  if (template) {
    this.removeAttr('data-template');
  }

  /**
   * Populate options list
   * @return {Promise}
   */
  function populate () {
    if (spec && spec.hasValue('v-ui:optionValue')) {
      options = spec['v-ui:optionValue'];
      return renderOptions(options);
    } else if (source) {
      return Promise.resolve(eval(source))
        .then(renderOptions)
        .catch((error) => {
          console.log('Source error', source);
        });
    } else if (queryPrefix) {
      return interpolate(queryPrefix, individual)
        .then((queryPrefix) => {
          return ftQuery(queryPrefix, undefined, sort, withDeleted);
        })
        .then(renderOptions)
        .catch((error) => {
          console.log('Query prefix error', queryPrefix);
        });
    }
  }

  /**
   * Render options list
   * @param {Array} options
   * @return {Promise}
   */
  function renderOptions (options) {
    self.empty();
    const optionsPromises = options.map((value, index) => {
      if (index >= 100) {
        return;
      }
      const hld = $(opts.template).appendTo(self);
      return renderValue(value, template).then((rendered) => {
        const lbl = $('label', hld).append( rendered );
        const chk = $('input', lbl).data('value', value);
        if (value instanceof IndividualModel && value.hasValue('v-s:deleted', true)) {
          hld.addClass('deleted');
        }
        const hasValue = individual.hasValue(property_uri, value);
        chk.prop('checked', hasValue);
        chk.change(() => {
          if ( chk.is(':checked') ) {
            individual.addValue(property_uri, value);
          } else {
            individual.removeValue(property_uri, value);
          }
        });
        if (opts.mode === 'view') {
          hld.addClass('disabled');
          chk.attr('disabled', 'disabled');
        }
      });
    });
    return Promise.all(optionsPromises);
  }

  /**
   * Individual property modified handler to indicate chosen option
   * @return {void}
   */
  function handler () {
    $('input', self).each((i, el) => {
      const value = $(el).data('value');
      const hasValue = individual.hasValue(property_uri, value);
      $(el).prop('checked', hasValue);
    });
  }

  if (spec && spec.hasValue('v-ui:tooltip')) {
    this.tooltip({
      title: spec['v-ui:tooltip'].join(', '),
      placement: 'left',
      container: 'body',
      trigger: 'hover',
      animation: false,
    }).one('remove', function (e) {
      $(e.delegateTarget).tooltip('destroy');
    });
  }

  this.on('update', function (e) {
    e.stopPropagation();
    populate();
  });

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'view') {
      $(e.delegateTarget).children().addClass('disabled');
      $('input', e.delegateTarget).attr('disabled', 'true');
    } else {
      $(e.delegateTarget).children().removeClass('disabled');
      $('input', e.delegateTarget).removeAttr('disabled');
    }
    if (e.type === 'search') {
      const dataDeleted = $(e.delegateTarget).data('deleted');
      withDeleted = typeof dataDeleted === 'boolean' ? dataDeleted : true;
    }
  });
  return this;
};
$.fn.veda_checkbox.defaults = {
  template: $('#checkbox-control-template').html(),
};
