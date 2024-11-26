// Date-Time control

import $ from 'jquery';

import moment from 'moment';

import veda_dateTime from './veda_datetime.js';

$.fn.veda_dateTime = function ( options ) {
  const opts = {...defaults, ...options};
  const control = veda_dateTime.call(this, opts);

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.find('input').attr('tabindex', tabindex);
  }

  this.append(control);
  return this;
};

const oldTemplate = `
<div class="input-group date">
  <span class="input-group-addon">
    <span class="glyphicon glyphicon-time"></span>
  </span>
  <input type="text" class="form-control" autocomplete="off"/>
  <div class="input-group-btn">
    <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
      <i class="caret"></i>
    </button>
    <ul class="add-time-list dropdown-menu dropdown-menu-right">
      <li><a href="#" data-added-time="10min">10 минут</a></li>
      <li><a href="#" data-added-time="30min">30 минут</a></li>
      <li><a href="#" data-added-time="hour">Час</a></li>
      <li><a href="#" data-added-time="day">День</a></li>
      <li><a href="#" data-added-time="week">Неделя</a></li>
      <li><a href="#" data-added-time="month">Месяц</a></li>
    </ul>
  </div>
</div>
`;
const defaults = {
  template: `
  <div class="date-control">
    <div class="input-group">
      <span class="input-group-addon btn btn-default date">
        <span class="glyphicon glyphicon-time"></span>
      </span>
      <input type="text" class="form-control" autocomplete="off"/>
      <div class="input-group-addon btn btn-default clear" tabindex="0">&#10005;</div>
      <ul class="add-time-list dropdown-menu dropdown-menu-right"></ul>
      <div class="input-group-addon btn btn-default dropdown-toggle" tabindex="0" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        <i class="caret"></i>
      </div>
    </div>
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
