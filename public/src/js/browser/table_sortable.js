// Sortable table plugin

import jQuery from "jquery";

System.import("moment").then(function (module) {
  var moment = module.default;

  $.fn.tableSortable = function (clicked) {
    return this.each(function() {
      var table = $(this);
      if ( table.hasClass("table-sortable-done") ) {
        return;
      }
      var tbody = table.children("tbody");
      var thead = table.children("thead");
      var ths = thead.find("tr:last-child > th");
      table.addClass("table-sortable-done");

      ths.each( function () {
        var th = $(this);
        var index = th.index();

        th.click(function (e) {
          var rows = tbody.children();
          e.preventDefault();
          e.stopPropagation();
          var $this = $(this);
          $this.siblings().removeClass("asc desc");
          var dir;
          if ( $this.hasClass("asc") ) {
            $this.removeClass("asc").addClass("desc");
            rows.sort(orderDesc);
          } else if ( $this.hasClass("desc") ) {
            $this.addClass("asc").removeClass("desc");
            rows.sort(orderAsc);
          } else {
            $this.addClass("asc");
            rows.sort(orderAsc);
          }
          rows.detach().appendTo(tbody);
        });

        var orderAsc = order(function (a,b) {return a < b;});
        var orderDesc = order(function (a,b) {return a > b;});

        function order (compare) {
          return function (a, b) {
            var valueA = $(a).children(":nth-child(" + (index + 1) + ")").text().toLowerCase().trim();
            var valueB = $(b).children(":nth-child(" + (index + 1) + ")").text().toLowerCase().trim();
            if ( !isNaN(valueA) ) {
              valueA = parseFloat(valueA);
              valueB = parseFloat(valueB);
            } else if ( moment(valueA, ["DD.MM.YYYY HH:mm:ss", "DD.MM.YYYY", "YYYY-MM-DDTHH:mm:ss.SSSZ", "YYYY-MM-DD"]).isValid() ) {
              valueA = moment(valueA, ["DD.MM.YYYY HH:mm:ss", "DD.MM.YYYY", "YYYY-MM-DDTHH:mm:ss.SSSZ", "YYYY-MM-DD"]).valueOf();
              valueB = moment(valueB, ["DD.MM.YYYY HH:mm:ss", "DD.MM.YYYY", "YYYY-MM-DDTHH:mm:ss.SSSZ", "YYYY-MM-DD"]).valueOf();
            }
            if ( compare(valueA, valueB) ) {
              return -1;
            } else if ( valueA == valueB ) {
              return 0;
            } else {
              return 1;
            }
          }
        }

      });

      clicked.click();

    });
  };
});
