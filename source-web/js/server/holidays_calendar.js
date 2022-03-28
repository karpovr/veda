// Holiday calendar

import IndividualModel from '../common/individual_model.js';

function isHoliday (date) {
  try {
    const HolidaysCalendar = new IndividualModel('v-s:HolidaysCalendarInstance');
    HolidaysCalendar.reset();
    const bareDate = new Date(date);
    bareDate.setUTCHours(0, 0, 0, 0);
    return HolidaysCalendar.get('v-s:holiday').some((holiday) => bareDate.valueOf() === holiday.valueOf());
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
