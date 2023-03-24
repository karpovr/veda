import BrowserUtil from '/js/browser/util.js';
import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import notify from '/js/browser/notify.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Append additional actions
  const additionalActions = $('.additional-actions', template);
  const searchActions = $('.search-actions', template);
  if (searchActions.length) {
    additionalActions.appendTo(searchActions);
  } else {
    additionalActions.remove();
  }

  // Export table to 'blob' or 'xls'
  const exportTable = (function () {
    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="https://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>{worksheet}</x:Name>
                    <x:WorksheetOptions>
                      <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
          <![endif]-->
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
          <style>
            td.text { mso-number-format:"@"; }
            td.number { mso-number-format:General; }
            td.date { mso-number-format:"Short Date"; }
          </style>
        </head>
        <body>
          <table border="1" cellspacing="0" bordercolor="#eee">{table}</table>
        </body>
      </html>
    `;
    const format = function (s, c) {
      return s.replace(/{([a-z]+)}/g, function (m, p) {
        return c[p];
      });
    };
    return function (table, name, exportAs) {
      if (!table.nodeType) table = document.getElementById(table);
      const ctx = {
        worksheet: name || 'Worksheet',
        table: table.innerHTML,
      };
      if (exportAs === 'xls') {
        // Tags
        const tags = /<\/?(a|span|p|div|button) ?.*?>/gi;
        // Numbers with decimal point
        const decimal = /([^\d\.\:]+\d+)\.(\d+[^\d\.\:]+)/gi;
        ctx.table = ctx.table.replace(tags, ' ');//.replace(decimal, '$1,$2');
      }
      const formatted = format(template, ctx);
      const blob = new Blob([formatted], {type: 'application/vnd.ms-excel;charset=utf-8'});
      if (exportAs === 'blob') {
        return blob;
      } else if (exportAs === 'xls') {
        import('filesaver').then(function (module) {
          const saveAs = module.default;
          saveAs(blob, name + '.xls');
        });
      }
    };
  })();

  $('.xls', template).click(function (e) {
    e.preventDefault();
    let resultTable = $('.search-result table').clone();
    resultTable.find('.hidden').remove();
    resultTable = resultTable.get(0);
    exportTable(resultTable, individual['rdfs:label'].map(CommonUtil.formatValue).join(' '), 'xls');
  });

  $('.files', template).click(function (e) {
    const btn = $(this);
    toggleSpin(btn);
    e.preventDefault();
    const resultTable = $('.search-result table').clone();
    resultTable.find('.hidden').remove();

    const filesEls = $("[typeof='v-s:File']", resultTable);

    const B_in_GB = 1024 * 1024 * 1024;
    // file size in B
    let sumSize = 0;
    filesEls.each(function () {
      // must already loaded
      const fileIndivid = new veda.IndividualModel($(this).attr('resource'));
      sumSize += +fileIndivid['v-s:fileSize'][0];
    });
    if (sumSize > 1 * B_in_GB) {
      let sizeGB = sumSize / B_in_GB;
      sizeGB = Math.round(sizeGB * 100) / 100;
      alert('Выгрузка файлов отменена: размер сформированного архива - ' + sizeGB+ 'ГБ , превысил  1ГБ , уменьшите выборку.');
      toggleSpin(btn);
      return;
    }

    const filesPromises = [];
    filesEls.each(function () {
      const link = $('a', this);
      const fileName = link.text().trim();
      const fileUrl = link.attr('href');
      filesPromises.push(filePromise(fileUrl, fileName));
    });

    if (filesPromises.length == 0) {
      toggleSpin(btn);
      return;
    }

    return Promise.all(filesPromises)
      .then(function (files) {
        return import('jszip').then(function (module) {
          const JSZip = module.default;
          const zip = new JSZip();
          const folder = zip.folder('files');
          const unique = {};
          files.forEach(function (file) {
            let name = file.name;
            let i = 1;
            while (unique[name]) {
              name = file.name.replace(/(.*?).([^.]*)$/, '$1 (' + i + ').$2');
              if (name === file.name) {
                name = file.name + ' (' + i + ')';
              }
              i++;
            }
            file.name = name;
            unique[file.name] = true;
            $('[href=' + BrowserUtil.escape4$(file.url) + ']', resultTable)
              .attr('href', '/files/' + file.name)
              .text(file.name);
            folder.file(file.name, file);
          });
          const registry = exportTable(resultTable.get(0), individual['rdfs:label'].map(CommonUtil.formatValue).join(' '), 'blob');
          zip.file('registry.html', registry);
          return zip.generateAsync({type: 'blob'}).then(function (content) {
            return import('filesaver').then(function (module) {
              const saveAs = module.default;
              saveAs(content, 'registry.zip');
            });
          });
        });
      })
      .catch(function (error) {
        notify('danger', {message: 'Ошибка выгрузки реестра. Обратитесь в поддержку.'});
      })
      .then(function () {
        toggleSpin(btn);
      });
  });

  function filePromise (url, name) {
    return new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url + '?' + Date.now(), true);
      xhr.responseType = 'blob';
      xhr.onload = function (e) {
        if (this.status == 200) {
          const file = new Blob([this.response], {type: 'application/octet-stream'});
          file.name = name;
          file.url = url;
          resolve(file);
        } else {
          reject(xhr.statusText);
        }
      };
      xhr.onerror = function () {
        reject(xhr.statusText);
      };
      xhr.send();
    });
  }

  // Spinner
  function toggleSpin (el) {
    const $el = $(el);
    const hasSpinner = $el.children('.fa-spinner');
    if (hasSpinner.length) {
      $el.removeClass('disabled');
      hasSpinner.remove();
    } else {
      $el.addClass('disabled');
      $("<i class='fa fa-spinner fa-pulse fa-lg fa-fw'></i>").appendTo(el);
    }
  }
};

export const html = `
  <div class="container sheet">
    <style>
      td.number {
        mso-number-format: General;
      }
      td.date {
        mso-number-format: 'Short Date';
      }
      td.text {
        mso-number-format: '@';
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
