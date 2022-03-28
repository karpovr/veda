// Holiday calendar

import IndividualModel from '../common/individual_model.js';

function isHoliday (date) {
  try {
    console.log('DATE', date);
    const HolidaysCalendar = new IndividualModel('v-s:HolidaysCalendarInstance');
    HolidaysCalendar.load();
    console.log('HOLIDAYS', HolidaysCalendar['v-s:holiday'].map(value => [value, value.valueOf()]));
    const bareDate = new Date(date);
    bareDate.setUTCHours(0, 0, 0, 0);
    console.log('BARE DATE', bareDate, bareDate.valueOf());
    return HolidaysCalendar.hasValue('v-s:holiday', bareDate);
  } catch (error) {
    console.error('Holiday check failed');
    return false;
  }
}

function addWorkingDays (date, days) {
  if (!date) date = new Date();
  while (days) {
    date.setDate(date.getDate() + 1);
    if (!isHoliday(date)) days--;
  }
  return date;
}

export {addWorkingDays, isHoliday};
