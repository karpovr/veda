// Boolean control

import $ from 'jquery';
import Util from '../../common/util.js';

const defaults = {
  template: '<input type="checkbox" />',
};

$.fn.veda_boolean = function (options) {
  const opts = {...defaults, ...options};
  const control = $(opts.template);
  const {individual, property_uri, spec} = opts;

  // Handle tabindex transfer
  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  }

  const updateControl = () => {
    if (individual.hasValue(property_uri)) {
      const value = individual.get(property_uri)[0];
      control.prop('checked', value).prop('readonly', false).prop('indeterminate', false);
    } else {
      control.prop('readonly', true).prop('indeterminate', true);
    }
  };

  updateControl();

  individual.on(property_uri, updateControl);
  this.one('remove', () => individual.off(property_uri, updateControl));

  control.click(() => {
    const isChecked = control.prop('checked');
    const isReadonly = control.prop('readonly');

    if (isReadonly) {
      individual.set(property_uri, [false]);
    } else {
      individual.set(property_uri, isChecked ? [true] : []);
    }
  });

  // Disable control if in a disabled checkbox context
  if (control.closest('.checkbox.disabled').length) {
    control.prop('disabled', 'disabled');
  }

  this.on('view edit search', (e) => {
    e.stopPropagation();
    const isView = e.type === 'view';

    control.prop('disabled', isView || control.closest('.checkbox.disabled').length);

    if (!isView && spec?.hasValue('v-ui:tooltip')) {
      control.parents('label').tooltip({
        title: spec['v-ui:tooltip'].map(Util.formatValue).join(' '),
        placement: 'bottom',
        container: control,
        trigger: 'hover',
        animation: false,
      });
    }
  });

  this.append(control);
  return this;
};
