import BrowserUtil from '/js/browser/util.js';
import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import Notify from '/js/browser/notify.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Append additional actions
  var additionalActions = $(".additional-actions", template);
  var searchActions = $(".search-actions", template);
  if (searchActions.length) {
    additionalActions.appendTo(searchActions);
  } else {
    additionalActions.remove();
  }

  // Export table to 'blob' or 'xls'
  var exportTable = (function () {
    var uri = 'data:application/vnd.ms-excel;base64,'
      , template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><meta http-equiv="content-type" content="text/plain; charset=UTF-8"/><style>td.text { mso-number-format:"\@"; } td.number { mso-number-format:General; } td.date { mso-number-format:"Short Date"; }</style></head><body><table border="1" cellspacing="0" bordercolor="#eee">{table}</table></body></html>'
      , format = function(s, c) { return s.replace(/{([a-z]+)}/g, function(m, p) { return c[p]; }) }
    return function(table, name, exportAs) {
      if (!table.nodeType) table = document.getElementById(table);
      var ctx = {
        worksheet: name || 'Worksheet',
        table: table.innerHTML
      };
      if ( exportAs === "xls" ) {
        // Tags
        var tags = new RegExp("<" + String.fromCharCode(92) + "/?(a|span|p|div|button) ?.*?>", "gi");
        // Numbers with decimal point
        var decimal = new RegExp("([^" + String.fromCharCode(92) + "d" + String.fromCharCode(92) + "." + String.fromCharCode(92) + ":]+" + String.fromCharCode(92) + "d+)" + String.fromCharCode(92) + ".(" + String.fromCharCode(92) + "d+[^" + String.fromCharCode(92) + "d" + String.fromCharCode(92) + "." + String.fromCharCode(92) + ":]+)", "gi");
        ctx.table = ctx.table.replace(tags, " ").replace(decimal, "$1,$2");
      }
      var formatted = format(template, ctx);
      var blob = new Blob([formatted], {type: "application/vnd.ms-excel;charset=utf-8"});
      if ( exportAs === "blob" ) {
        return blob;
      } else if ( exportAs === "xls" ) {
        import("filesaver").then(function (module) {
          var saveAs = module.default;
          saveAs(blob, name + ".xls");
        });
      }
    }
  })();

  $(".xls", template).click(function (e) {
    e.preventDefault();
    var resultTable = $(".search-result table").clone();
    resultTable.find(".hidden").remove();
    resultTable = resultTable.get(0);
    exportTable(resultTable, individual["rdfs:label"].map(CommonUtil.formatValue).join(" "), "xls");
  });

  $(".files", template).click(function (e) {
    var btn = $(this);
    toggleSpin(btn);
    e.preventDefault();
    var resultTable = $(".search-result table").clone();
    resultTable.find(".hidden").remove();

    var filesEls = $("[typeof='v-s:File']", resultTable);

    var filesPromises;

    if (filesEls.length) {
      filesPromises = filesEls.map(function () {
        var link = $("a", this);
        var fileName = link.text().trim();
        var fileUrl = link.attr("href");
        return filePromise(fileUrl, fileName);
      });
    } else {
      filesPromises = [];
    }

    Promise.all(filesPromises).then(function (files) {
      import("jszip").then(function (module) {
        var JSZip = module.default;
        var zip = new JSZip();
        var folder = zip.folder("files");
        var unique = {};
        files.forEach(function (file) {
          var name = file.name;
          var i = 1;
          while (unique[name]) {
            name = file.name.replace(/(.*?).([^.]*)$/, "$1 ("+ i +").$2");
            if (name === file.name) { name = file.name + " ("+ i +")"; }
            i++;
          }
          file.name = name;
          unique[file.name] = true;
          $("[href=" + BrowserUtil.escape4$(file.url) + "]", resultTable).attr("href", "/files/" + file.name).text(file.name);
          folder.file(file.name, file);
        });
        var registry = exportTable(resultTable.get(0), individual["rdfs:label"].map(CommonUtil.formatValue).join(" "), "blob");
        zip.file("registry.html", registry);
        zip.generateAsync({type:"blob"}).then(function(content) {
          import("filesaver").then(function (module) {
            var saveAs = module.default;
            saveAs(content, "registry.zip");
          });
        });
      });
    }).catch(function (error) {
      console.log(error, error.stack);
      var notify = new Notify();
      notify("danger", { message: "Ошибка выгрузки реестра. Обратитесь в поддержку." });
    }).then(function () {
      toggleSpin(btn);
    });
  });

  function filePromise(url, name) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + "?" + Math.random(), true);
      xhr.responseType = 'blob';
      xhr.onload = function(e) {
        if (this.status == 200) {
          var file = new Blob([this.response], {type: 'application/octet-stream'});
          file.name = name;
          file.url = url;
          resolve(file);
        } else {
          reject(xhr.statusText);
        }
      };
      xhr.onerror = function () {
        reject(xhr.statusText);
      }
      xhr.send();
    });
  }

  // Spinner
  function toggleSpin(el) {
    var $el = $(el);
    var hasSpinner = $el.children(".fa-spinner");
    if ( hasSpinner.length ) {
      $el.removeClass("disabled");
      hasSpinner.remove();
    } else {
      $el.addClass("disabled");
      $("<i class='fa fa-spinner fa-pulse fa-lg fa-fw'></i>").appendTo(el);
    }
  }
};

export const html = `
<div class="container sheet">
  <style>
    td.number {
      mso-number-format:General;
    }
    td.date {
      mso-number-format:"Short Date";
    }
    td.text {
      mso-number-format:"\@";
    }
  </style>
  <div about="@" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
  <span class="additional-actions">
    <button class="btn btn-default xls"><span about="v-fs:Excel" property="rdfs:label"></span></button>
    <button class="btn btn-default files"><span about="v-fs:FilesRegistry" property="rdfs:label"></span></button>
    <span class="text-muted padding-lg" about="v-fs:CtrlEnterBundle" property="rdfs:label"></span>
  </span>
</div>
`;
