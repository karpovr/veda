// Boolean radio control

import $ from 'jquery';
import Util from '../../common/util.js';
import IndividualModel from '../../common/individual_model.js';

const defaults = {
  template: `
<div class="radio">
  <label>
    <input type="radio" />
  </label>
</div>
  `,
};

$.fn.veda_booleanRadio = function (params) {
  const opts = {...defaults, ...params};
  const self = this;
  const individual = opts.individual;
  const property_uri = opts.property_uri || opts.rel_uri;
  const spec = opts.spec;

  const trueOption = createOption('v-ui:trueLabel', 'v-s:YesBundle', true);
  const falseOption = createOption('v-ui:falseLabel', 'v-s:NoBundle', false);
  const options = [trueOption, falseOption];

  renderOptions();

  individual.on(property_uri, updateCheckedState);
  this.one('remove', () => individual.off(property_uri, updateCheckedState));

  function createOption (labelKey, bundle, value) {
    return {
      label: spec?.hasValue(labelKey) ?
        Promise.resolve(spec.get(labelKey).map(Util.formatValue).join(' ')) :
        (new IndividualModel(bundle)).load().then((loaded) => loaded.get('rdfs:label').map(Util.formatValue).join(' ')),
      value,
    };
  }

  function renderOptions () {
    self.empty();
    options.forEach((option) => {
      const hld = $(opts.template).appendTo(self);
      option.label.then((label) => {
        const rad = $('input', hld).data('value', option.value).prop('checked', individual.hasValue(property_uri, option.value));

        rad.change(() => {
          if (rad.is(':checked')) {
            individual.set(property_uri, [rad.data('value')]);
          } else {
            individual.set(property_uri, individual.get(property_uri).filter((i) => i.valueOf() !== rad.data('value').valueOf()));
          }
        });

        $('label', hld).append(label);
      });
    });
  }

  function updateCheckedState () {
    $('input', self).each((_, el) => {
      const value = $(el).data('value');
      $(el).prop('checked', individual.hasValue(property_uri, value));
    });
  }

  if (spec?.hasValue('v-ui:tooltip')) {
    this.tooltip({
      title: spec['v-ui:tooltip'].map(Util.formatValue).join(' '),
      placement: 'left',
      container: 'body',
      trigger: 'hover',
      animation: false,
    }).one('remove', (e) => $(e.delegateTarget).tooltip('destroy'));
  }

  this.on('update', (e) => {
    e.stopPropagation();
    renderOptions();
  });

  this.on('view edit search', (e) => {
    e.stopPropagation();
    const isView = e.type === 'view';
    $('div.radio', e.delegateTarget).toggleClass('disabled', isView);
    $('input', e.delegateTarget).attr('disabled', isView);
    if (isView) {
      $(e.delegateTarget).removeClass('has-error');
    }
  });

  return this;
};
