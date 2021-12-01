import BrowserUtil from '/js/browser/util.js';
import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var root = this.hasValue("v-ui:treeRoot") ? this["v-ui:treeRoot"] : undefined,
      expandLevel = this.hasValue("v-ui:treeExpandLevel") ? this["v-ui:treeExpandLevel"][0] : undefined,
      inProperty = this.hasValue("v-ui:treeInProperty") ? this["v-ui:treeInProperty"] : undefined,
      outProperty = this.hasValue("v-ui:treeOutProperty") ? this["v-ui:treeOutProperty"] : undefined,
      allowedClass = this.hasValue("v-ui:treeAllowedClass") ? this["v-ui:treeAllowedClass"] : undefined,
      allowedFilter = this.hasValue("v-ui:treeAllowedFilter") ? this["v-ui:treeAllowedFilter"] : undefined,
      selectableClass = this.hasValue("v-ui:treeSelectableClass") ? this["v-ui:treeSelectableClass"] : undefined,
      selectableFilter = this.hasValue("v-ui:treeSelectableFilter") ? this["v-ui:treeSelectableFilter"] : undefined,
      displayedProperty = this.hasValue("v-ui:treeDisplayedProperty") ? this["v-ui:treeDisplayedProperty"] : [ new IndividualModel("rdfs:label") ],

      target = extra && extra.target,
      rel_uri = extra && extra.target_rel_uri,
      isSingle = extra && extra.isSingle,
      withDeleted = extra && extra.withDeleted,
      sort = extra && extra.sort,

      tbody = $(".tbody", template),
      thead = $(".thead", template),
      headTmpl = "",
      rowTmpl = "";

  if (target && rel_uri) {
    if (isSingle) {
      headTmpl += "<th width='1px'></th>";
      rowTmpl += "<td><input type='radio' class='select-row' name='select-row' /></td>";
    } else {
      headTmpl += "<th width='48px'></th>";
      rowTmpl += "<td><div class='checkbox no-margin'><label><input type='checkbox' class='select-row' /> <span style='cursor:pointer' class='select-deep fa fa-sitemap text-muted'></span></label></div></td>";
    }
  } else {
    headTmpl += "<th width='24px'><span class='glyphicon glyphicon-zoom-in'></span></th>";
    rowTmpl += "<td about='@' data-template='v-ui:IconModalTemplate'></td>";
  }

  var allowedFilterFn = (function () {
    if (allowedFilter) {
      return new Function( allowedFilter[0].toString() );
    } else if (allowedClass) {
      return function () {
        var that = this;
        return allowedClass.reduce(function (acc, allowed) {
          return acc || that.hasValue("rdf:type", allowed);
        }, false);
      }
    } else {
      return function () { return true; };
    }
  })();

  var selectableFilterFn = (function () {
    if (selectableFilter) {
      return new Function( selectableFilter[0].toString() );
    } else if (selectableClass) {
      return function () {
        var that = this;
        return selectableClass.reduce(function (acc, selectable) {
          return acc || that.hasValue("rdf:type", selectable);
        }, false);
      }
    } else {
      return function () { return true; };
    }
  })();

  var literals = ["rdfs:Literal", "xsd:string", "xsd:boolean", "xsd:integer", "xsd:nonNegativeInteger", "xsd:decimal", "xsd:dateTime"];

  displayedProperty.forEach( function (property, index) {
    headTmpl += "<th>" + property["rdfs:label"].map(CommonUtil.formatValue).join(" ") + "</th>";
    var isLiteral = (literals.indexOf(property["rdfs:range"][0].id) >= 0);
    var isFile = property.hasValue('rdfs:range', 'v-s:File');
    if ( index === 0 ) {
      if (isLiteral) {
        rowTmpl += "<td><div class='spacer'><a href='#' class='expand glyphicon glyphicon-chevron-right'></a> <span about='@' property='" + property.id + "'></span></div></td>";
      } else if (isFile) {
        rowTmpl += "<td><div class='spacer'><a href='#' class='expand glyphicon glyphicon-chevron-right'></a> <span about='@' rel='" + property.id + "' data-template='v-ui:FileMinTemplate'></span></div></td>";
      } else {
        rowTmpl += "<td><div class='spacer'><a href='#' class='expand glyphicon glyphicon-chevron-right'></a> <span about='@' rel='" + property.id + "' data-template='v-ui:LabelTemplate'></span></div></td>";
      }
      return;
    } else {
      if ( isLiteral ) {
        rowTmpl += "<td about='@' property='" + property.id + "'></td>";
      } else if (isFile) {
        rowTmpl += "<td about='@' rel='" + property.id + "' data-template='v-ui:FileMinTemplate'></td>";
      } else {
        rowTmpl += "<td about='@' rel='" + property.id + "' data-template='v-ui:LabelTemplate'></td>";
      }
    }
  });
  headTmpl = "<tr>" + headTmpl + "</tr>";
  thead.html(headTmpl);

  template.on("click", "a.expand", expandRow);

  function expandRow(e, expandLevel) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    var that = $(this),
      thatRow = that.closest("tr"),
      thatLvl = parseInt( thatRow.attr("data-level") ),
      uri = thatRow.attr("resource"),
      value = new IndividualModel(uri);

    that.toggleClass("expanded glyphicon-chevron-right glyphicon-chevron-down");

    if ( that.hasClass("expanded") ) {
      getChildren([], value, false).then(function (children) {
        return renderRows(children, thatRow, expandLevel).then(function () {
          var nextLvl = parseInt(thatRow.next().attr("data-level"));
          if ( isNaN(nextLvl) || nextLvl <= thatLvl ) {
            that.prev().css("width", 16 * (thatLvl + 1) - 2);
            that.remove();
            thatRow.find(".select-deep").remove();
          }
        });
      });
    } else {
      var rowsToRemove = $();
      thatRow.nextAll().each(function () {
        var row = $(this);
        if ( row.data("level") > thatLvl ) {
          rowsToRemove = rowsToRemove.add(row);
        } else {
          return false;
        }
      });
      rowsToRemove.remove();
    }
  }

  function renderRows(values_uris, parentRow, expandLevel) {
    var cont = $("<div>");
    var parentLvl = parentRow ? parseInt( parentRow.attr("data-level") ) : -1,
        tmpl = $("<tr class='value-row'>").attr("data-level", parentLvl + 1).append(rowTmpl);
    $(".spacer", tmpl).css({"margin-left": 16 * (parentLvl + 1) + "px", "display": "inline-block"});
    return Promise.all(values_uris.map(function (valueUri, index) {
      var value = new IndividualModel(valueUri);
      return value.load().then(function (value) {
        if ( !allowedFilterFn.call(value) ) {
          return;
        }
        return value.present(cont, tmpl[0].outerHTML).then(function (tmpl) {
          tmpl = $(tmpl);
          // Pre-check children
          return getChildren([], value, false).then(function (children) {
            if (!children.length) {
              tmpl.find(".expand").remove();
              tmpl.find(".select-deep").remove();
            } else if (expandLevel) {
              expandRow.call(tmpl.find(".expand"), undefined, expandLevel - 1);
            }
          }).then(function () {
            if (target && rel_uri) {
              var selectRow = $(".select-row", tmpl);
              var selectDeep = $(".select-deep", tmpl);
              selectRow.prop("checked", target.hasValue(rel_uri, value));

              if (value.deepSelected) {
                selectDeep.removeClass("text-muted").addClass("text-danger");
              } else {
                selectDeep.addClass("text-muted").removeClass("text-danger");
              }

              if ( !selectableFilterFn.call(value) ) {
                selectRow.remove();
              }
            }
            return tmpl;
          });
        });
      });
    })).then(function (rendered) {
      if ( parentRow ) {
        parentRow.after( rendered );
      } else {
        tbody.append( rendered );
      }
      cont.remove();
      return rendered;
    });
  }
  var previousSelected;
  if (target && rel_uri) {

    template.on("click", "td", function (e) {
      e.stopPropagation();
      var row = $(this).parent();
      $(".select-row", row).click();
    });

    template.on("click", ".select-row", function (e) {
      e.stopPropagation();
      var $this = $(this);
      var row = $this.closest("tr"),
          uri = row.attr("resource"),
          value = new IndividualModel(uri);

      $("#create-NewItem", template).remove();
      if ($(".modal").length == 0) {
        var addButton = drawAddButton(row);
        row.children().last().append(addButton);
      }

      if (isSingle) {
        target.set(rel_uri, [value]);
      } else {
        target.toggleValue(rel_uri, value);
      }
    });

    template.on("click", ".select-deep", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var $this = $(this);
      var row = $this.closest("tr"),
          uri = row.attr("resource"),
          value = new IndividualModel(uri);

      getChildren([], value).then(function (branchUris) {
        value.deepSelected = !value.deepSelected;
        var branch = branchUris.map(function (branchUri) {
          var item = new IndividualModel(branchUri);
          item.deepSelected = value.deepSelected;
          return allowedFilterFn.call(item) && selectableFilterFn.call(item) ? item : undefined;
        });
        if (value.deepSelected) {
          target.addValue(rel_uri, branch);
          $this.removeClass("text-muted").addClass("text-danger");
        } else {
          target.removeValue(rel_uri, branch);
          $this.addClass("text-muted").removeClass("text-danger");
        }
      });
    });

    target.on(rel_uri, propertyModifiedHandler);
    template.one("remove", function () {
      target.off(rel_uri, propertyModifiedHandler);
    });
  }

  function redrawBranch(branchRow) {
    var thatLvl = parseInt( branchRow.attr("data-level") );
    branchRow.nextUntil("[data-level=" + thatLvl + "]").remove();

    var value = new IndividualModel(branchRow.attr("resource"));
    if (value && value.children) delete value.children;
    getChildren([], value, false).then(function (children) {
      return renderRows(children, branchRow).then(function () {
        var nextLvl = parseInt(branchRow.next().attr("data-level"));
        if ( isNaN(nextLvl) || nextLvl <= thatLvl ) {
          console.log("unexpected!!!!!!");
        }
      });
    });
  }
  function propertyModifiedHandler(values) {
    $(".value-row", template).each(function () {
      var $this = $(this),
          uri = $this.attr("resource"),
          value = new IndividualModel(uri);
      if ( values.indexOf(value) >=0 ) {
        $this.find(".select-row").prop("checked", true);
      } else {
        $this.find(".select-row").prop("checked", false);
      }
      if (value.deepSelected) {
        $this.find(".select-deep").removeClass("text-muted").addClass("text-danger");
      } else {
        $this.find(".select-deep").addClass("text-muted").removeClass("text-danger");
      }
    });
  }

  // Render tree
  root.forEach( function (root, index, roots) {
    renderRows([root.id], undefined, typeof expandLevel !== 'undefined' ? expandLevel : roots.length === 1 ? 1 : 0);
  });

  function getChildren(acc, root, goDeeper) {
    return new Promise(function (resolve, reject) {
      if (root.children) {
        resolve (root.children);
      } else {
        var outs = getOut(root);
        getIn(root).then(function (ins) {
          root.children = outs.concat(ins);
          resolve (root.children);
        });
      }
    }).then(function (children) {
      return Promise.all(
        children.map(function (childUri) {
          acc.push(childUri);
          if (goDeeper !== false) {
            var child = new IndividualModel(childUri);
            return getChildren(acc, child, goDeeper);
          }
        })
      );
    }).then(function () {
      return acc;
    });
  }

  function getOut(root) {
    var res = [];
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

  function getIn(root) {
    if (!inProperty) {
      return Promise.resolve([]);
    }
    var q = inProperty.map(function (property) {
        return "'" + property.id + "'=='" + root.id + "'";
      }).join(" || ");
    if ( allowedClass ) {
      var allowed = allowedClass.map(function (allowedClass) {
        return "'rdf:type'=='" + allowedClass.id + "'";
      }).join(" || ");
      q = "( " + q + " ) && ( " + allowed + " )";
    }
    var order = sort || "'rdfs:label_ru' asc, 'rdfs:label_en' asc, 'rdfs:label' asc";
    var unique;
    return Backend.query({
      ticket: veda.ticket,
      query: q,
      sort: order,
      async: true
    }).then(function(queryResult) {
      unique = CommonUtil.unique( queryResult.result );
      if (withDeleted) {
        q = q + " && ( 'v-s:deleted'== true )";
        return Backend.query({
          ticket: veda.ticket,
          query: q,
          sort: order,
          async: true
        }).then(function(qResult) {
          return unique.concat(qResult.result);
        });
      } else {
        return unique;
      }
    });
  }

  function drawAddButton(currentRow){
    var addButton = $("<div id='create-NewItem'><button class='btn btn-xs btn-primary margin-sm'>Добавить элемент</button></div>");
    addButton.click(function(){
      var currentUri = currentRow.attr("resource");
      var type = $(this).closest("tr").attr("typeof");
      var newItem = new IndividualModel();
      newItem["rdf:type"] = [new IndividualModel(type)];
      newItem["v-s:hasParentLink"] = [new IndividualModel(currentUri)];
      var modal = BrowserUtil.showModal(newItem, undefined, "edit");
      newItem.one("afterReset", function () {
        modal.modal("hide").remove();
      });
      newItem.one("afterSave", function () {
        setTimeout(function() {
          redrawBranch(currentRow);
        }, 100);
        modal.modal("hide").remove();
      });
    });
    return addButton;
  }

  if (!this.hasValue("rdf:type", "v-ui:Tree")) {
    $(".heading", template).remove();
  }
};

export const html = `
<div class="container sheet table-responsive">
  <style scoped>
    tr > th:first-child, tr > td:first-child {
      border-right: 1px solid #ddd;
    }
  </style>
  <div class="heading">
    <h2 about="@" property="rdfs:label"></h2>
    <hr class="margin-sm">
  </div>
  <table class="table table-condensed table-striped">
    <thead class="thead"></thead>
    <tbody class="tbody"></tbody>
  </table>
</div>
`;