// Date-Time control

import $ from 'jquery';

import moment from 'moment';

import veda_dateTime from './veda_datetime_generic.js';

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
