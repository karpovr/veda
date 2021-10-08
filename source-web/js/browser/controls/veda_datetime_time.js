// Time control

import $ from 'jquery';

import moment from 'moment';

import veda_dateTime from './veda_datetime_generic.js';

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
