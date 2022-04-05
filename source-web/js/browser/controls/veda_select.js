// Select control

import $ from 'jquery';

import Util from '../../common/util.js';

import IndividualModel from '../../common/individual_model.js';

import {interpolate, ftQuery, renderValue} from './veda_control_util.js';

$.fn.veda_select = function (params) {
  const opts = {...defaults, ...params};
  const control = $(opts.template);
  const individual = opts.individual;
  const property_uri = opts.property_uri || opts.rel_uri;
  const spec = opts.spec;
  const rangeRestriction = spec && spec.hasValue('v-ui:rangeRestriction') ? spec['v-ui:rangeRestriction'][0] : undefined;
  const range = rangeRestriction ? [rangeRestriction] : (new IndividualModel(property_uri))['rdfs:range'];
  const queryPrefix = this.attr('data-query-prefix') || ( spec && spec.hasValue('v-ui:queryPrefix') ? spec['v-ui:queryPrefix'][0] : range.map((item) => {
    return '\'rdf:type\'===\'' + item.id + '\'';
  }).join(' || ') );
  const sort = this.attr('data-sort') || ( spec && spec.hasValue('v-ui:sort') && spec['v-ui:sort'][0].toString() );
  let placeholder = this.attr('placeholder') || ( spec && spec.hasValue('v-ui:placeholder') ? spec['v-ui:placeholder'].map(Util.formatValue).join(' ') : new IndividualModel('v-s:SelectValueBundle') );
  const source = this.attr('data-source') || undefined;
  const template = this.attr('data-template') || '{@.rdfs:label}';
  const isSingle = this.attr('data-single') || ( spec && spec.hasValue('v-ui:maxCardinality') ? spec['v-ui:maxCardinality'][0] === 1 : true );
  let withDeleted = this.attr('data-deleted') || false;

  if (placeholder instanceof IndividualModel) {
    placeholder.load().then((placeholderLoaded) => {
      placeholder = placeholderLoaded.toString();
      populate();
    });
  } else {
    populate();
  }

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  }

  control.change((e) => {
    const value = $('option:selected', control).data('value');
    if (isSingle) {
      individual.set(property_uri, [value]);
    } else {
      if ( !individual.hasValue(property_uri, value) ) {
        individual.addValue(property_uri, value);
      }
      $(e.delegateTarget).children(':first').prop('selected', true);
    }
  });

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
      const options = spec['v-ui:optionValue'];
      return renderOptions(options);
    } else if (source) {
      return Promise.resolve(eval(source))
        .then(renderOptions)
        .catch((error) => {
          console.error('Source failed', source);
        });
    } else if (queryPrefix) {
      return interpolate(queryPrefix, individual)
        .then((prefix) => {
          return ftQuery(prefix, undefined, sort, withDeleted);
        })
        .then(renderOptions)
        .catch((error) => {
          console.error('Query prefix failed', queryPrefix);
        });
    }
  }

  /**
   * Render options list
   * @param {Array} options
   * @return {Promise}
   */
  function renderOptions (options) {
    control.empty();
    const first_opt = $('<option></option>');
    first_opt.text(placeholder).data('value', null).appendTo(control);
    const optionsPromises = options.map((value, index) => {
      if (index >= 100) {
        return;
      }
      const opt = $('<option></option>').appendTo(control);
      return renderValue(value, template).then((rendered) => {
        opt.text(rendered).data('value', value);
        if (value instanceof IndividualModel && value.hasValue('v-s:deleted', true)) {
          opt.addClass('deleted');
        }
        if ( isSingle && individual.hasValue(property_uri, value) ) {
          opt.prop('selected', true);
        }
        return rendered;
      });
    });
    return Promise.all(optionsPromises);
  }

  /**
   * Individual property modified handler to indicate chosen option
   * @return {void}
   */
  function handler () {
    if (isSingle) {
      populate().then(() => {
        $('option', control).each((i, el) => {
          const value = $(el).data('value');
          const hasValue = !!value && individual.hasValue(property_uri, value);
          $(el).prop('selected', hasValue);
        });
      });
    }
  }

  if (spec && spec.hasValue('v-ui:tooltip')) {
    control.tooltip({
      title: spec['v-ui:tooltip'].join(', '),
      placement: 'top',
      container: 'body',
      trigger: 'hover',
      animation: false,
    });
    this.one('remove', function () {
      control.tooltip('destroy');
    });
  }

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'search') {
      const dataDeleted = $(e.delegateTarget).data('deleted');
      withDeleted = typeof dataDeleted === 'boolean' ? dataDeleted : true;
    }
  });
  this.on('update', function (e) {
    e.stopPropagation();
    populate();
  });
  this.append(control);
  return this;
};

const defaults = {
  template: `
<select class="form-control">
  <option></option>
</select>
  `,
};
