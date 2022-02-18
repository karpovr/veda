// Boolean radio control

import $ from 'jquery';

import Util from '../../common/util.js';

import IndividualModel from '../../common/individual_model.js';

$.fn.veda_booleanRadio = function (params) {
  const opts = {...defaults, ...params};
  const self = this;
  const individual = opts.individual;
  const property_uri = opts.property_uri || opts.rel_uri;
  const spec = opts.spec;
  const trueOption = {
    label: spec && spec.hasValue('v-ui:trueLabel') ?
      Promise.resolve(spec.get('v-ui:trueLabel').map(Util.formatValue).join(' ')) :
      (new IndividualModel('v-s:YesBundle')).load().then((loaded) => {
        return loaded.get('rdfs:label').map(Util.formatValue).join(' ');
      }),
    value: true,
  };
  const falseOption = {
    label: spec && spec.hasValue('v-ui:falseLabel') ?
      Promise.resolve(spec.get('v-ui:falseLabel').map(Util.formatValue).join(' ')) :
      (new IndividualModel('v-s:NoBundle')).load().then((loaded) => {
        return loaded.get('rdfs:label').map(Util.formatValue).join(' ');
      }),
    value: false,
  };
  const options = [trueOption, falseOption];

  renderOptions();

  individual.on(property_uri, handler);
  this.one('remove', function () {
    individual.off(property_uri, handler);
  });

  /**
   * Render options list
   * @param {Array} options
   * @return {void}
   */
  function renderOptions () {
    self.empty();
    options.forEach((option) => {
      const hld = $(opts.template).appendTo(self);
      option.label.then((label) => {
        const lbl = $('label', hld).append( label );
        const rad = $('input', lbl).data('value', option.value);
        const hasValue = individual.hasValue(property_uri, option.value);
        rad.prop('checked', hasValue);
        rad.change(() => {
          if ( rad.is(':checked') ) {
            individual.set(property_uri, [rad.data('value')]);
          } else {
            individual.set(property_uri, individual.get(property_uri).filter((i) => {
              return i.valueOf() !== rad.data('value').valueOf();
            }));
          }
        });
      });
    });
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
    renderOptions();
  });

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'view') {
      $('div.radio', e.delegateTarget).addClass('disabled');
      $('input', e.delegateTarget).attr('disabled', 'true');
      $(e.delegateTarget).removeClass('has-error');
    } else {
      $('div.radio', e.delegateTarget).removeClass('disabled');
      $('input', e.delegateTarget).removeAttr('disabled');
    }
  });
  return this;
};

const defaults = {
  template: `
<div class="radio">
  <label>
    <input type="radio" />
  </label>
</div>
  `,
};
