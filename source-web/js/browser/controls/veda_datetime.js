// Datetime generic

import $ from 'jquery';
import moment from 'moment';
import 'adoptedStyleSheets';
import veda from '../../common/veda.js';
import Util from '../../common/util.js';

export default veda_dateTime;

/**
 * Common dateTime behaviour
 * @param {Object} options 
 * @return {jQuery}
 * @this jQuery
 */
function veda_dateTime (options) {
  const opts = {...defaults, ...options};
  const control = $(opts.template);
  const format = opts.format;
  const spec = opts.spec;
  const placeholder = this.attr('placeholder') || (spec && spec.hasValue('v-ui:placeholder') ? spec['v-ui:placeholder'].map(Util.formatValue).join(' ') : '');
  const property_uri = opts.property_uri;
  const individual = opts.individual;
  const isSingle = spec && spec.hasValue('v-ui:maxCardinality') ? spec['v-ui:maxCardinality'][0] === 1 : true;
  const input = $('input', control);
  const periodStartProperty = this.attr('data-period-start-property') || undefined;
  let change;

  input.attr({
    'placeholder': placeholder,
    'name': (individual.hasValue('rdf:type') ? individual['rdf:type'].pop().id + '_' + property_uri : property_uri).toLowerCase().replace(/[-:]/g, '_'),
  });

  const singleValueHandler = function (values) {
    if (values.length) {
      const currentDate = moment(values[0]);
      input.val(currentDate.format(format));
    } else {
      input.val('');
    }
  };

  if (isSingle) {
    change = function (value) {
      individual.set(property_uri, [value]);
    };
    if (individual.hasValue(property_uri)) {
      input.val(moment(individual.get(property_uri)[0]).format(format));
    }
    individual.on(property_uri, singleValueHandler);
    this.one('remove', function () {
      individual.off(property_uri, singleValueHandler);
    });
  } else {
    change = async function (value) {
      await individual.set(property_uri, individual.get(property_uri).concat(value));
      input.val('');
    };
  }

  if (spec && spec.hasValue('v-ui:tooltip')) {
    this.tooltip({
      title: spec['v-ui:tooltip'].map(Util.formatValue).join(' '),
      placement: 'auto left',
      container: 'body',
      trigger: 'manual',
      animation: false,
    });
    this.one('remove', () => this.tooltip('destroy'));
    input.on('focusin', () => this.tooltip('show'));
    input.on('focusout change', () => this.tooltip('hide'));
  }

  import('datetimepicker/js/bootstrap-datetimepicker.min.js').then(() => {
    import('datetimepicker/css/bootstrap-datetimepicker.min.css').then((module) => {
      const styleSheet = module.default;
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];
    });
    
    const pickerOptions = {
      locale: Object.keys(veda.user.preferences.language).length === 1 ? Object.keys(veda.user.preferences.language)[0] : 'EN',
      allowInputToggle: false,
      format: format,
      sideBySide: true,
      useCurrent: false,
      widgetPositioning: {
        horizontal: 'auto',
        vertical: 'bottom',
      }
    };

    // Для работы нужна динамичность, нужно вообще или нет непонятно
    // Добавляем ограничения для полей окончания периода
    // if (periodStartProperty) {
    //   const startDate = individual[periodStartProperty];
    //   if (startDate.length > 0) {
    //     pickerOptions.minDate = moment(startDate[0], format);
    //   }
    // }

    control.datetimepicker(pickerOptions);
  });

  input.on('focusin', () => {
    control.data('DateTimePicker').show();
  });
  $('.date', control).click(function () {
    control.data('DateTimePicker').show();
  });
  input.on('change focusout', function (e) {
    const value = opts.parser(e.target.value);
    change(value);
  });

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'search') {
      change = async function (value) {
        //.set return Promise
        await individual.set(property_uri, individual.get(property_uri).concat(value));
        input.val('');
      };
    }
  });

  this.val = function (value) {
    if (!value) return input.val();
    return input.val(value);
  };

  this.one('remove', function () {
    control.data('DateTimePicker')?.destroy();
  });

  // Dropdown feature
  // const dropdown = $('.dropdown', control);
  // dropdown.on('click keydown', function (e) {
  //   if (e.type !== 'click' && e.which !== 13 && e.which !== 32) {
  //     return;
  //   }
  //   e.preventDefault();
  //   e.stopPropagation();
  // });

  function parsedChange(val) {
    const value = opts.parser(val);
    change(value);
  }

  function initDropdown() {
    if (opts.mode == 'search') {
      $('ul', control).append(dropdownItemsSearch);
    } else if (periodStartProperty) {
      $('ul', control).append(dropdownItemsFinish);
    } else {
      $('ul', control).append(dropdownItemsStart);
    }
  }
  
  initDropdown();

  $('.add-time-list>li>a', control).click(e => {
    e.preventDefault();
    const addedTime = $(e.target).attr('data-added-time');
    const time = new Date();
    
    // Получаем значение связанного поля начала периода
    if (periodStartProperty) {
      const startDate = individual[periodStartProperty];
      if (startDate.length > 0) {
        time.setTime(moment(startDate[0], format).toDate().getTime());
      }
    }
    
    individual.clearValue(property_uri);
    setDatesToInput(addedTime, time);
  });

  function setDatesToInput(addedTime, time) {
    let dayOfWeek;
    switch (addedTime) {
    //default dates
      case '10min':
        time.setMinutes(time.getMinutes()+10)
        parsedChange(time);
        break;
      case '30min':
        time.setMinutes(time.getMinutes()+30)
        parsedChange(time);
        break;
      case 'hour':
        time.setHours(time.getHours()+1)
        parsedChange(time);
        break;
      case 'day':
        time.setDate(time.getDate()+1)
        parsedChange(time);
        break;
      case 'week':
        time.setDate(time.getDate()+7)
        parsedChange(time);
        break;
      case 'month':
        time.setMonth(time.getMonth()+1)
        parsedChange(time);
        break;
  //dates for start period
      case 'yesterday':
        time.setDate(time.getDate()-1)
        parsedChange(time);
        break;
      case 'today':
        parsedChange(new Date());
        break;
      case 'nextDay':
        time.setDate(time.getDate()+1)
        parsedChange(time);
        break;
      case 'startWeek':
        dayOfWeek = time.getDay();
        if (dayOfWeek == 0) dayOfWeek = 7;
        time.setDate(time.getDate() - (dayOfWeek - 1));
        parsedChange(time);
        break;
      case 'startNextWeek':
        dayOfWeek = time.getDay();
        if (dayOfWeek == 0) dayOfWeek = 7;
        time.setDate(time.getDate()+(8-dayOfWeek))
        parsedChange(time);
        break;
      case 'startMonth':
        const startMonth = new Date(time.getFullYear(), time.getMonth(), 1);
        parsedChange(startMonth);
        break;
      case 'startNextMonth':
        const nextMonth = new Date(time.getFullYear(), time.getMonth()+1, 1);
        parsedChange(nextMonth);
        break;
  //dates for finish period
      case 'add_day':
        time.setDate(time.getDate()+1)
        parsedChange(time);
        break;
      case 'add_2day':
        time.setDate(time.getDate()+2)
        parsedChange(time);
        break;  
      case 'add_week':
        time.setDate(time.getDate()+7)
        parsedChange(time);
        break;  
      case 'add_month':
        time.setMonth(time.getMonth()+1)
        parsedChange(time);
        break;
      case 'add_quart':
        time.setMonth(time.getMonth()+3)
        parsedChange(time);
        break;  
      case 'add_year':
        time.setFullYear(time.getFullYear()+1)
        parsedChange(time);
        break;
      case 'add_2_year':
        time.setFullYear(time.getFullYear()+2)
        parsedChange(time);
        break;
      case 'add_3_year':
        time.setFullYear(time.getFullYear()+3)
        parsedChange(time);
        break;
      case 'add_5_year':
        time.setFullYear(time.getFullYear()+5)
        parsedChange(time);
        break;
  //periods for search  
      case 'searchPrevYear':
        time.setFullYear(time.getFullYear()-1, 0, 1); // Устанавливаем 1 января прошлого года
        parsedChange(time);
        time.setMonth(11, 31); // Устанавливаем 31 декабря того же года
        parsedChange(time);
        break;
      case 'searchPrevQuart':
        // Устанавливаем начало прошлого квартала
        const prevQuarterStart = new Date(time.getFullYear(), Math.floor((time.getMonth() - 3) / 3) * 3, 1);
        parsedChange(prevQuarterStart);
        // Устанавливаем конец прошлого квартала
        const prevQuarterEnd = new Date(prevQuarterStart.getFullYear(), prevQuarterStart.getMonth() + 3, 0);
        parsedChange(prevQuarterEnd);
        break;
      case 'searchPrevMonth':
        // Устанавливаем начало прошлого месяца
        const prevMonthStart = new Date(time.getFullYear(), time.getMonth() - 1, 1);
        parsedChange(prevMonthStart);
        // Устанавливаем конец прошлого месяца
        const prevMonthEnd = new Date(time.getFullYear(), time.getMonth(), 0);
        parsedChange(prevMonthEnd);
        break;
      case 'searchPrevday':
        time.setDate(time.getDate()-1)
        parsedChange(time);
        break;
      case 'searchToday':
        parsedChange(new Date());
        break;
      case 'searchNextday':
        time.setDate(time.getDate()+1);
        parsedChange(time);
        break;
      case 'searchCurrentMonth':
        const monthStart = new Date(time.getFullYear(), time.getMonth(), 1);
        parsedChange(monthStart);
        const monthEnd = new Date(time.getFullYear(), time.getMonth() + 1, 0);
        parsedChange(monthEnd);
        break;
      case 'searchCurrentQuart':
        const quartStart = new Date(time.getFullYear(), Math.floor(time.getMonth() / 3) * 3, 1);
        parsedChange(quartStart);
        const quartEnd = new Date(quartStart.getFullYear(), quartStart.getMonth() + 3, 0);
        parsedChange(quartEnd);
        break;
      case 'searchCurrentYear':
        const yearStart = new Date(time.getFullYear(), 0, 1);
        parsedChange(yearStart);
        const yearEnd = new Date(time.getFullYear(), 11, 31);
        parsedChange(yearEnd);
        break;
      case 'searchNextWeek':
        // Получаем текущую дату
        const currentDate = new Date(time);
        // Находим следующий понедельник
        const daysUntilMonday = (8 - currentDate.getDay()) % 7;
        const nextMonday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + daysUntilMonday);
        parsedChange(nextMonday);
        // Устанавливаем воскресенье (конец недели)
        const nextSunday = new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 6);
        parsedChange(nextSunday);
        break;
      case 'searchNextMonth':
        // Устанавливаем начало следующего месяца
        const nextMonthStart = new Date(time.getFullYear(), time.getMonth() + 1, 1);
        parsedChange(nextMonthStart);
        // Устанавливаем конец следующего месяца
        const nextMonthEnd = new Date(time.getFullYear(), time.getMonth() + 2, 0);
        parsedChange(nextMonthEnd);
        break;
      case 'searchNextQuart':
        // Устанавливаем начало следующего квартала
        const nextQuarterStart = new Date(time.getFullYear(), Math.floor((time.getMonth() + 3) / 3) * 3, 1);
        parsedChange(nextQuarterStart);
        // Устанавливаем конец следующего квартала
        const nextQuarterEnd = new Date(nextQuarterStart.getFullYear(), nextQuarterStart.getMonth() + 3, 0);
        parsedChange(nextQuarterEnd);
        break;
      case 'searchNextYear':
        // Устанавливаем начало следующего года
        const nextYearStart = new Date(time.getFullYear() + 1, 0, 1);
        parsedChange(nextYearStart);
        // Устанавливаем конец следующего года
        const nextYearEnd = new Date(time.getFullYear() + 1, 11, 31);
        parsedChange(nextYearEnd);
        break;
      }
  }

  $('.clear', control).on('click keydown', function (e) {
    if (e.type !== 'click' && e.which !== 13 && e.which !== 32) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    individual.clearValue(property_uri);
    input.val('')
    //.focus();
  });

  return control;
}

const dropdownItemsStart = `
  <li><a href="#" data-added-time="yesterday">Вчера</a></li>
  <li><a href="#" data-added-time="today">Сегодня</a></li>
  <li><a href="#" data-added-time="nextDay">Завтра</a></li>
  <li><a href="#" data-added-time="startWeek">Начало недели</a></li>
  <li><a href="#" data-added-time="startMonth">Начало месяца</a></li>
  <li><a href="#" data-added-time="startNextWeek">Начало сл. недели</a></li>
  <li><a href="#" data-added-time="startNextMonth">Начало сл. месяца</a></li>
`;

const dropdownItemsFinish = `
  <label style="margin-left: 10px;">Добавить к дате начала</label>
  <li><a href="#" data-added-time="add_day">+ 1 день</a></li>
  <li><a href="#" data-added-time="add_2day">+ 2 дня</a></li>
  <li><a href="#" data-added-time="add_week">+ 1 неделя</a></li>
  <li><a href="#" data-added-time="add_month">+ 1 месяц</a></li>
  <li><a href="#" data-added-time="add_year">+ 1 год</a></li>
  <li><a href="#" data-added-time="add_2_year">+ 2 года</a></li>
  <li><a href="#" data-added-time="add_3_year">+ 3 года</a></li>
  <li><a href="#" data-added-time="add_5_year">+ 5 лет</a></li>
`;

const dropdownItemsDefault = `
  <li><a href="#" data-added-time="day">День</a></li>
  <li><a href="#" data-added-time="week">Неделя</a></li>
  <li><a href="#" data-added-time="month">Месяц</a></li>
`;

const dropdownItemsSearch = `
  <label style="margin-left: 10px;">Период для поиска</label>
  <li><a href="#" data-added-time="searchPrevYear">Прошлый год</a></li>
  <li><a href="#" data-added-time="searchPrevQuart">Прошлый квартал</a></li>
  <li><a href="#" data-added-time="searchPrevMonth">Прошлый месяц</a></li>
  <li><a href="#" data-added-time="searchCurrentYear">Текущий год</a></li>
  <li><a href="#" data-added-time="searchCurrentQuart">Текущий квартал</a></li>
  <li><a href="#" data-added-time="searchCurrentMonth">Текущий месяц</a></li>
  <li><a href="#" data-added-time="searchPrevday">Вчера</a></li>
  <li><a href="#" data-added-time="searchToday">Сегодня</a></li>
  <li><a href="#" data-added-time="searchNextday">Завтра</a></li>
  <li><a href="#" data-added-time="searchNextWeek">Следующая неделя</a></li>
  <li><a href="#" data-added-time="searchNextMonth">Следующий месяц</a></li>
  <li><a href="#" data-added-time="searchNextYear">Следующий год</a></li>
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
      return new Date(timestamp);
    }
    return null;
  },
  format: 'DD.MM.YYYY HH:mm'
};
