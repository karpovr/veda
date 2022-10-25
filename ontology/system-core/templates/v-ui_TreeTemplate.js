import BrowserUtil from '/js/browser/util.js';
import CommonUtil from '/js/common/util.js';
import {sanitize} from '/js/browser/dom_helpers.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const root = this.hasValue('v-ui:treeRoot') ? this['v-ui:treeRoot'] : undefined;
  const expandLevel = this.hasValue('v-ui:treeExpandLevel') ? this['v-ui:treeExpandLevel'][0] : undefined;
  const inProperty = this.hasValue('v-ui:treeInProperty') ? this['v-ui:treeInProperty'] : undefined;
  const outProperty = this.hasValue('v-ui:treeOutProperty') ? this['v-ui:treeOutProperty'] : undefined;
  const allowedClass = this.hasValue('v-ui:treeAllowedClass') ? this['v-ui:treeAllowedClass'] : undefined;
  const allowedFilter = this.hasValue('v-ui:treeAllowedFilter') ? this['v-ui:treeAllowedFilter'] : undefined;
  const selectableClass = this.hasValue('v-ui:treeSelectableClass') ? this['v-ui:treeSelectableClass'] : undefined;
  const selectableFilter = this.hasValue('v-ui:treeSelectableFilter') ? this['v-ui:treeSelectableFilter'] : undefined;
  const displayedProperty = this.hasValue('v-ui:treeDisplayedProperty') ? this['v-ui:treeDisplayedProperty'] : [new IndividualModel('rdfs:label')];
  const target = extra && extra.target;
  const rel_uri = extra && extra.target_rel_uri;
  const isSingle = extra && extra.isSingle;
  const withDeleted = extra && extra.withDeleted;
  const sort = extra ? extra.sort : this.hasValue('v-ui:sort') ? this['v-ui:sort'][0] : undefined;
  const tbody = $('.tbody', template);
  const thead = $('.thead', template);
  let headTmpl = '';
  let rowTmpl = '';

  if (target && rel_uri) {
    if (isSingle) {
      headTmpl += "<th width='1px'></th>";
      rowTmpl += "<td><input type='radio' class='select-row' name='select-row' /></td>";
    } else {
      headTmpl += "<th width='48px'></th>";
      rowTmpl +=
        "<td><div class='checkbox no-margin'><label><input type='checkbox' class='select-row' /> <span style='cursor:pointer' class='select-deep fa fa-sitemap text-muted'></span></label></div></td>";
    }
  } else {
    headTmpl += "<th width='24px'><span class='glyphicon glyphicon-zoom-in'></span></th>";
    rowTmpl += "<td about='@' data-template='v-ui:IconModalTemplate'></td>";
  }

  const allowedFilterFn = (function () {
    if (allowedFilter) {
      return new Function(allowedFilter[0].toString());
    } else if (allowedClass) {
      return function () {
        const that = this;
        return allowedClass.reduce(function (acc, allowed) {
          return acc || that.hasValue('rdf:type', allowed);
        }, false);
      };
    } else {
      return function () {
        return true;
      };
    }
  })();

  const selectableFilterFn = (function () {
    if (selectableFilter) {
      return new Function(selectableFilter[0].toString());
    } else if (selectableClass) {
      return function () {
        const that = this;
        return selectableClass.reduce(function (acc, selectable) {
          return acc || that.hasValue('rdf:type', selectable);
        }, false);
      };
    } else {
      return function () {
        return true;
      };
    }
  })();

  const literals = ['rdfs:Literal', 'xsd:string', 'xsd:boolean', 'xsd:integer', 'xsd:nonNegativeInteger', 'xsd:decimal', 'xsd:dateTime'];

  displayedProperty.forEach(function (property, index) {
    headTmpl += '<th>' + sanitize(property['rdfs:label'].map(CommonUtil.formatValue).join(' ')) + '</th>';
    const isLiteral = literals.indexOf(property['rdfs:range'][0].id) >= 0;
    const isFile = property.hasValue('rdfs:range', 'v-s:File');
    if (index === 0) {
      if (isLiteral) {
        rowTmpl +=
          "<td><div class='spacer'><a href='#' class='expand glyphicon glyphicon-chevron-right'></a> <span about='@' property='" +
          property.id +
          "'></span></div></td>";
      } else if (isFile) {
        rowTmpl +=
          "<td><div class='spacer'><a href='#' class='expand glyphicon glyphicon-chevron-right'></a> <span about='@' rel='" +
          property.id +
          "' data-template='v-ui:FileMinTemplate'></span></div></td>";
      } else {
        rowTmpl +=
          "<td><div class='spacer'><a href='#' class='expand glyphicon glyphicon-chevron-right'></a> <span about='@' rel='" +
          property.id +
          "' data-template='v-ui:LabelTemplate'></span></div></td>";
      }
      return;
    } else {
      if (isLiteral) {
        rowTmpl += "<td about='@' property='" + property.id + "'></td>";
      } else if (isFile) {
        rowTmpl += "<td about='@' rel='" + property.id + "' data-template='v-ui:FileToTreeTemplate'></td>";
      } else {
        rowTmpl += "<td about='@' rel='" + property.id + "' data-template='v-ui:LabelTemplate'></td>";
      }
    }
  });
  headTmpl = '<tr>' + headTmpl + '</tr>';
  thead.html(headTmpl);

  template.on('click', 'a.expand', expandRow);

  function expandRow (e, expandLevel) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const that = $(this);
    const thatRow = that.closest('tr');
    const thatLvl = parseInt(thatRow.attr('data-level'));
    const uri = thatRow.attr('resource');
    const value = new IndividualModel(uri);

    that.toggleClass('expanded glyphicon-chevron-right glyphicon-chevron-down');

    if (that.hasClass('expanded')) {
      getChildren([], value, false).then(function (children) {
        return renderRows(children, thatRow, expandLevel).then(function () {
          const nextLvl = parseInt(thatRow.next().attr('data-level'));
          if (isNaN(nextLvl) || nextLvl <= thatLvl) {
            that.prev().css('width', 16 * (thatLvl + 1) - 2);
            that.remove();
            thatRow.find('.select-deep').remove();
          }
        });
      });
    } else {
      let rowsToRemove = $();
      thatRow.nextAll().each(function () {
        const row = $(this);
        if (row.data('level') > thatLvl) {
          rowsToRemove = rowsToRemove.add(row);
        } else {
          return false;
        }
      });
      rowsToRemove.remove();
    }
  }

  function renderRows (values_uris, parentRow, expandLevel) {
    const cont = $('<div>');
    const parentLvl = parentRow ? parseInt(parentRow.attr('data-level')) : -1;
    const tmpl = $("<tr class='value-row'>")
      .attr('data-level', parentLvl + 1)
      .append(rowTmpl);
    $('.spacer', tmpl).css({'margin-left': 16 * (parentLvl + 1) + 'px', 'display': 'inline-block'});
    return Promise.all(
      values_uris.map(function (valueUri, index) {
        const value = new IndividualModel(valueUri);
        return value.load().then(function (value) {
          if (!allowedFilterFn.call(value)) {
            return;
          }
          return value.present(cont, tmpl[0].outerHTML).then(function (tmpl) {
            tmpl = $(tmpl);
            // Pre-check children
            return getChildren([], value, false)
              .then(function (children) {
                if (!children.length) {
                  tmpl.find('.expand').remove();
                  tmpl.find('.select-deep').remove();
                } else if (expandLevel) {
                  expandRow.call(tmpl.find('.expand'), undefined, expandLevel - 1);
                }
              })
              .then(function () {
                if (target && rel_uri) {
                  const selectRow = $('.select-row', tmpl);
                  const selectDeep = $('.select-deep', tmpl);
                  selectRow.prop('checked', target.hasValue(rel_uri, value));

                  if (value.deepSelected) {
                    selectDeep.removeClass('text-muted').addClass('text-danger');
                  } else {
                    selectDeep.addClass('text-muted').removeClass('text-danger');
                  }

                  if (!selectableFilterFn.call(value)) {
                    selectRow.remove();
                  }
                }
                return tmpl;
              });
          });
        });
      }),
    ).then(function (rendered) {
      if (parentRow) {
        parentRow.after(rendered);
      } else {
        tbody.append(rendered);
      }
      cont.remove();
      return rendered;
    });
  }

  if (target && rel_uri) {
    template.on('click', 'td', function (e) {
      e.stopPropagation();
      const row = $(this).parent();
      $('.select-row', row).click();
    });

    template.on('click', '.select-row', function (e) {
      e.stopPropagation();
      const $this = $(this);
      const row = $this.closest('tr');
      const uri = row.attr('resource');
      const value = new IndividualModel(uri);

      $('#create-NewItem', template).remove();
      if ($('.modal').length == 0) {
        const addButton = drawAddButton(row);
        row.children().last().append(addButton);
      }

      if (isSingle) {
        target.set(rel_uri, [value]);
      } else {
        target.toggleValue(rel_uri, value);
      }
    });

    template.on('click', '.select-deep', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const $this = $(this);
      const row = $this.closest('tr');
      const uri = row.attr('resource');
      const value = new IndividualModel(uri);

      getChildren([], value).then(function (branchUris) {
        value.deepSelected = !value.deepSelected;
        return Promise.all(
          branchUris.map(function (branchUri) {
            return new IndividualModel(branchUri).load();
          }),
        );
      }).then(function (branchObjs) {
        const branch = branchObjs.map(function (item) {
          item.deepSelected = value.deepSelected;
          return allowedFilterFn.call(item) && selectableFilterFn.call(item) ? item : undefined;
        });
        if (value.deepSelected) {
          target.addValue(rel_uri, branch);
          $this.removeClass('text-muted').addClass('text-danger');
        } else {
          target.removeValue(rel_uri, branch);
          $this.addClass('text-muted').removeClass('text-danger');
        }
      });
    });

    target.on(rel_uri, propertyModifiedHandler);
    template.one('remove', function () {
      target.off(rel_uri, propertyModifiedHandler);
    });
  }

  function redrawBranch (branchRow) {
    const thatLvl = parseInt(branchRow.attr('data-level'));
    branchRow.nextUntil('[data-level=' + thatLvl + ']').remove();

    const value = new IndividualModel(branchRow.attr('resource'));
    if (value && value.children) delete value.children;
    getChildren([], value, false).then(function (children) {
      return renderRows(children, branchRow).then(function () {
        const nextLvl = parseInt(branchRow.next().attr('data-level'));
        if (isNaN(nextLvl) || nextLvl <= thatLvl) {
          console.error('unexpected!!!!!!');
        }
      });
    });
  }
  function propertyModifiedHandler (values) {
    $('.value-row', template).each(function () {
      const $this = $(this);
      const uri = $this.attr('resource');
      const value = new IndividualModel(uri);
      if (values.indexOf(value) >= 0) {
        $this.find('.select-row').prop('checked', true);
      } else {
        $this.find('.select-row').prop('checked', false);
      }
      if (value.deepSelected) {
        $this.find('.select-deep').removeClass('text-muted').addClass('text-danger');
      } else {
        $this.find('.select-deep').addClass('text-muted').removeClass('text-danger');
      }
    });
  }

  // Render tree
  root.forEach(function (root, index, roots) {
    renderRows([root.id], undefined, typeof expandLevel !== 'undefined' ? expandLevel : roots.length === 1 ? 1 : 0);
  });

  function getChildren (acc, root, goDeeper) {
    return new Promise(function (resolve, reject) {
      if (root.children) {
        resolve(root.children);
      } else {
        const outs = getOut(root);
        getIn(root).then(function (ins) {
          root.children = outs.concat(ins);
          resolve(root.children);
        });
      }
    })
      .then(function (children) {
        return Promise.all(
          children.map(function (childUri) {
            const isAlreadyLoaded = acc.indexOf(childUri) >= 0;
            acc.push(childUri);
            if (goDeeper !== false && !isAlreadyLoaded) {
              const child = new IndividualModel(childUri);
              return getChildren(acc, child, goDeeper);
            }
          }),
        );
      })
      .then(function () {
        return acc;
      });
  }

  function getOut (root) {
    const res = [];
    if (outProperty) {
      outProperty.map(function (property) {
        if (root.hasValue(property.id)) {
          root.properties[property.id].map(function (value) {
            res.push(value.data);
          });
        }
      });
    }
    return res;
  }

  function getIn (root) {
    if (!inProperty) {
      return Promise.resolve([]);
    }
    let q = inProperty
      .map(function (property) {
        return "'" + property.id + "'=='" + root.id + "'";
      })
      .join(' || ');
    if (allowedClass) {
      const allowed = allowedClass
        .map(function (allowedClass) {
          return "'rdf:type'=='" + allowedClass.id + "'";
        })
        .join(' || ');
      q = '( ' + q + ' ) && ( ' + allowed + ' )';
    }
    const order = sort || "'rdfs:label_ru' asc, 'rdfs:label_en' asc, 'rdfs:label' asc";
    let unique;
    return Backend.query({
      ticket: veda.ticket,
      query: q,
      sort: order,
      async: true,
    }).then(function (queryResult) {
      unique = CommonUtil.unique(queryResult.result);
      if (withDeleted) {
        q = q + " && ( 'v-s:deleted'== true )";
        return Backend.query({
          ticket: veda.ticket,
          query: q,
          sort: order,
          async: true,
        }).then(function (qResult) {
          return unique.concat(qResult.result);
        });
      } else {
        return unique;
      }
    });
  }

  function drawAddButton (currentRow) {
    const addButton = $("<div id='create-NewItem'><button class='btn btn-xs btn-primary margin-sm'>Добавить элемент</button></div>");
    addButton.click(function () {
      const currentUri = currentRow.attr('resource');
      const type = $(this).closest('tr').attr('typeof');
      const newItem = new IndividualModel();
      newItem['rdf:type'] = [new IndividualModel(type)];
      newItem['v-s:hasParentLink'] = [new IndividualModel(currentUri)];
      const modal = BrowserUtil.showModal(newItem, undefined, 'edit');
      newItem.one('afterReset', function () {
        modal.modal('hide').remove();
      });
      newItem.one('afterSave', function () {
        setTimeout(function () {
          redrawBranch(currentRow);
        }, 100);
        modal.modal('hide').remove();
      });
    });
    return addButton;
  }

  if (!this.hasValue('rdf:type', 'v-ui:Tree')) {
    $('.heading', template).remove();
  }
};

export const html = `
  <div class="container sheet table-responsive">
    <style scoped>
      tr > th:first-child,
      tr > td:first-child {
        border-right: 1px solid #ddd;
      }
    </style>
    <div class="heading">
      <h2 about="@" property="rdfs:label"></h2>
      <hr class="margin-sm" />
    </div>
    <table class="table table-condensed table-striped">
      <thead class="thead"></thead>
      <tbody class="tbody"></tbody>
    </table>
  </div>
`;
