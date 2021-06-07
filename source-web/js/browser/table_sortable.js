// Sortable table plugin

import $ from 'jquery';

System.import('moment').then(function (module) {
  const moment = module.default;

  $.fn.tableSortable = function (clicked) {
    return this.each(function (i, el) {
      const table = $(el);
      if ( table.hasClass('table-sortable-done') ) {
        return;
      }
      const tbody = table.children('tbody');
      const thead = table.children('thead');
      const ths = thead.find('tr:last-child > th');
      table.addClass('table-sortable-done');

      ths.each( function (i, el) {
        const th = $(el);
        const index = th.index();

        th.click(function (e) {
          const rows = tbody.children();
          e.preventDefault();
          e.stopPropagation();
          const $this = $(e.target);
          $this.siblings().removeClass('asc desc');
          if ( $this.hasClass('asc') ) {
            $this.removeClass('asc').addClass('desc');
            rows.sort(orderDesc);
          } else if ( $this.hasClass('desc') ) {
            $this.addClass('asc').removeClass('desc');
            rows.sort(orderAsc);
          } else {
            $this.addClass('asc');
            rows.sort(orderAsc);
          }
          rows.detach().appendTo(tbody);
        });

        const order = function (compare) {
          return function (a, b) {
            const valueA = $(a).children(':nth-child(' + (index + 1) + ')').text().toLowerCase().trim();
            const valueB = $(b).children(':nth-child(' + (index + 1) + ')').text().toLowerCase().trim();
            if ( !isNaN(valueA) ) {
              valueA = parseFloat(valueA);
              valueB = parseFloat(valueB);
            } else if ( moment(valueA, ['DD.MM.YYYY HH:mm:ss', 'DD.MM.YYYY', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DD']).isValid() ) {
              valueA = moment(valueA, ['DD.MM.YYYY HH:mm:ss', 'DD.MM.YYYY', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DD']).valueOf();
              valueB = moment(valueB, ['DD.MM.YYYY HH:mm:ss', 'DD.MM.YYYY', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DD']).valueOf();
            }
            if ( compare(valueA, valueB) ) {
              return -1;
            } else if ( valueA == valueB ) {
              return 0;
            } else {
              return 1;
            }
          };
        };

        const orderAsc = order((a, b) => a < b);
        const orderDesc = order((a, b) => a > b);
      });

      clicked.click();
    });
  };
});
