import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';
import touchswipe from 'touchswipe';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var self = individual,
      searchBlankTemplate = self.hasValue("v-fs:searchBlankTemplate") ? self["v-fs:searchBlankTemplate"][0] : undefined,
      searchResultTemplate = self.hasValue("v-fs:searchResultTemplate") ? self["v-fs:searchResultTemplate"][0] : undefined,
      searchResultContainer = $(".search-result", template);

  if ( !searchBlankTemplate ) {
    $(".results-load-buttons", template).detach().appendTo(template);
    $(".params", template).remove();
    $(".caption", template).removeClass("hidden");
  }
  if ( this.hasValue("v-fs:loadAll", true) ) {
    $(".no-more-results", template).remove();
  }

  // Enable swipe for result table
  $("body").keydown(enableSwipe).keyup(disableSwipe);
  template.one("remove", function () {
    $("body").off("keydown", enableSwipe).off("keyup", disableSwipe);
  });
  function disableSwipe (e) {
    if (e.which === 17) {
      $(".search-result", template).addClass("noSwipe").removeClass("swipe");
    }
  }
  function enableSwipe (e) {
    if (e.ctrlKey) {
      $(".search-result", template).addClass("swipe").removeClass("noSwipe");
    }
  }

  var prevDistance = 0, delta = 0;

  $(".search-result", template).swipe({
    swipeStatus: function (event, phase, direction, distance, duration) {
      if (phase === "move" && event.ctrlKey === true) {
        this.css("cursor", "move");
        if (direction === "left") {
          delta = distance - prevDistance;
          prevDistance = distance;
          this.scrollLeft( this.scrollLeft() + delta );
        } else if (direction === "right") {
          delta = distance - prevDistance;
          prevDistance = distance;
          this.scrollLeft( this.scrollLeft() - delta );
        } else if (direction === "up") {
          window.scrollBy(0, distance);
        } else if (direction === "down") {
          window.scrollBy(0, -distance);
        }
      } else {
        prevDistance = 0;
        delta = 0;
        this.css("cursor", "");
      }
    }
  });
  template.one("remove", function () {
    prevDistance = null;
    delta = null;
    $(".search-result", template).swipe("destroy");
  });

  if ( !searchResultTemplate ) {
    $(".stats-top, .stats-bottom, .result-header", template).remove();
    searchResultTemplate = new IndividualModel("v-fs:MinimalSearchResultTemplate");
  }
  return searchResultTemplate.load().then(function (searchResultTemplate) {
    var templateString = searchResultTemplate["v-ui:template"][0].toString();
    return import('/templates/' + templateString)
      .then(function (templateModule) {
        return templateModule.html;
      });
  }).then(function (templateString) {
    var searchResultTemplate = $( templateString );
    var resultContainer = $(".result-container", searchResultTemplate);
    if (resultContainer.attr("data-template")) {
      var resultTemplateIndividual = new IndividualModel(resultContainer.attr("data-template"));
      resultContainer.empty();
      return resultTemplateIndividual.load()
        .then(function(resultTemplateIndividual) {
          var resultTemplate = resultTemplateIndividual["v-ui:template"][0].toString();
          individual.resultTemplate = resultTemplate;
          searchResultContainer.append( searchResultTemplate );
        });
    } else {
      var resultTemplate = resultContainer.html();
      resultContainer.empty();
      individual.resultTemplate = resultTemplate;
      searchResultContainer.append( searchResultTemplate );
    }
  });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Make position fixed for buttons bar that doesn't fit the window
  function checkOffset(main, actions, actionsStaticHeight, placeholder) {
    var mainTop = main.offset().top;
    var mainHeight = main.height();
    var windowHeight = window.innerHeight;
    var windowTop = window.scrollY || window.pageYOffset;
    var actionsStaticTop = placeholder.offset().top;
    var actions_inside_viewport = windowTop <= actionsStaticTop && actionsStaticTop < (windowTop + windowHeight);
    var main_inside_viewport = windowTop <= (mainTop + mainHeight - actionsStaticHeight) && (mainTop + actionsStaticHeight) < (windowTop + windowHeight);
    if ( !actions_inside_viewport && main_inside_viewport )  {
      if ( !actions.hasClass("actions-fixed") ) {
        placeholder.css("height", actionsStaticHeight);
        actions.find("br").addClass("hidden");
        actions.addClass("actions-fixed");
      }
    } else {
      if ( actions.hasClass("actions-fixed") ) {
        placeholder.css("height", 0);
        actions.find("br").removeClass("hidden");
        actions.removeClass("actions-fixed");
      }
    }
  }
  setTimeout(function () {
    var main = template;
    var actions = $(".search-actions", template);
    if (!actions.length) { return; }
    var actionsStaticHeight = actions.height();
    var placeholder = $("<div></div>").insertBefore(actions);
    checkOffset(main, actions, actionsStaticHeight, placeholder);
    $(window).on("scroll", scrollHandler);
    template.one("remove", function () {
      $(window).off("scroll", scrollHandler);
    });
    function scrollHandler () {
      checkOffset(main, actions, actionsStaticHeight, placeholder);
    }
  }, 500);

  var self = individual,
      searchBlankContainer = $(".search-form", template),
      searchResultContainer = $(".search-result", template),
      searchButton = $("#search-button.search-button", template),
      moreResults = $(".more-results", template),
      allResults = $(".all-results", template),
      noMoreResults = $(".no-more-results", template),
      searchError = $(".search-error", template),
      searchBlank = self.hasValue("v-fs:searchBlank") ? self["v-fs:searchBlank"][0] : undefined ,
      searchBlankTemplate = self.hasValue("v-fs:searchBlankTemplate") ? self["v-fs:searchBlankTemplate"][0] : undefined ,
      resultContainer = $(".result-container", template),
      notFound = $(".not-found", template),
      statsTop = $(".stats-top", template);

  // Set columns
  //individual.hiddenColumns = individual.hiddenColumns || {};
  //var checksContainer = $(".set-columns-wrapper .dropdown-menu", template).on('click', function (e) {
  //  e.stopPropagation();
  //});
  //var checkTmpl = $(".set-columns-wrapper .dropdown-menu .checkbox", template).remove();
  //if (checkTmpl.length) {
  //  checkTmpl = checkTmpl.get(0).outerHTML;
  //  $(".search-result table > thead > tr:last > th", template).each(function (index) {
  //    var th = $(this);
  //    var check = $(checkTmpl);
  //    var checkbox = $("input", check);
  //    var columnName = $(this).find("span").clone();
  //    if ( columnName.length ) {
  //      $(".column-name", check).html( columnName );
  //    } else {
  //      $(".column-name", check).text( th.text() );
  //    }
  //    if (index in individual.hiddenColumns) {
  //      checkbox.prop("checked", false);
  //    } else {
  //      checkbox.prop("checked", true);
  //    }
  //    checkbox.change(checkHandler);
  //    checkHandler.call( checkbox.get(0) );
  //    checksContainer.append(check);
  //
  //    // Show/hide result table columns & update resultTemplate accordingly
  //    function checkHandler() {
  //      individual.resultTemplate = $(individual.resultTemplate);
  //      if ( $(this).is(":checked") ) {
  //        th.removeClass("hidden");
  //        $("tr td:nth-child(" + (index + 1) + ")", resultContainer).removeClass("hidden");
  //        individual.resultTemplate.not("script").children().eq(index).removeClass("hidden");
  //        delete individual.hiddenColumns[index];
  //      } else {
  //        th.addClass("hidden");
  //        $("tr td:nth-child(" + (index + 1) + ")", resultContainer).addClass("hidden");
  //        individual.resultTemplate.not("script").children().eq(index).addClass("hidden");
  //        individual.hiddenColumns[index] = true;
  //      }
  //      individual.resultTemplate = individual.resultTemplate.map(function () { return this.outerHTML; }).get().join("");
  //    }
  //  });
  //}

  // Remember scroll position
  template.one("remove", function () {
    self.scroll = $(window).scrollTop();
  });

  // Scroll to position
  function scrollTo(position) {
    if (position > 0) {
      $("html, body").animate({
        scrollTop: position
      });
    }
  }

  // Search handler
  function searchHandler() {
    var searchButtons = $(".search-button", template);
    searchError.addClass("hidden");
    toggleSpin(searchButtons);
    self.search()
      .then(renderResult)
      .then(clearSelected)
      .then(function () {
        var position = self.scroll || $(".results", template).offset().top;
        scrollTo(position);
        delete self.scroll;
        toggleSpin(searchButtons);
      })
      .catch(function (error) {
        console.log(error);
        toggleSpin(searchButtons);
        searchError.removeClass("hidden");
      });
  }
  self.on("search", searchHandler);
  template.one("remove", function () {
    self.off("search", searchHandler);
  });

  // Search button handler
  searchButton.click(searchHandler);

  // Ctrl + Enter triggers search
  function ctrlEnterHandler (e) {
    if (e.ctrlKey && e.keyCode === 13) {
      searchHandler();
    }
  }
  $(window).on("keyup", ctrlEnterHandler);
  template.one("remove", function () {
    $(window).off("keyup", ctrlEnterHandler);
  });

  // More results handler
  function moreResultsHandler() {
    return self.search( self["v-fs:cursor"][0] )
      .then(renderResult)
      .catch(function (error) {
        console.log(error);
      });
  }

  // More results button
  moreResults.click(moreResultsHandler);

  // All results button
  allResults.click(function () {
    var warn = new IndividualModel("v-s:AreYouSure")["rdfs:label"].map(CommonUtil.formatValue).join(" ");
    if ( self["v-fs:estimated"][0] - self["v-fs:cursor"][0] < 100 || confirm(warn) ) {
      loadAll();
    }
  });
  function loadAll() {
    if (self["v-fs:cursor"][0] < self["v-fs:estimated"][0] && template.is(":visible")) {
      moreResultsHandler().then(loadAll);
    }
  }

  // Double click on result table row routes to search result
  $(".search-result", template).on("dblclick", ".result-container > [resource]", function () {
    var uri = $(this).attr("resource");
    riot.route("#/" + uri);
  });
  // Mark clicked row
  $(".search-result", template).on("click", ".result-container > [resource]", function () {
    var that = $(this);
    that.addClass("marked").siblings(".marked").removeClass("marked");
    self.marked = that.attr("resource");
  });

  // Manage sort
  var sortBy = "", dir = "";
  var tmp = self["v-fs:sortOrder"][0].split(" ");
  sortBy = tmp[0]; dir = tmp[1];
  $(".orderby", template).each( function () {
    var header = $(this);
    var a = $("<a href='#' class='text-muted glyphicon glyphicon-sort-by-attributes'></a>");
    header.prepend(a, " ");
    var property_uri = header.attr("data-orderby");
    if (sortBy.indexOf(property_uri) >= 0) {
      a.removeClass("text-muted");
      if (dir === "desc") { a.removeClass("glyphicon-sort-by-attributes").addClass("glyphicon-sort-by-attributes-alt"); }
    }
    a.click(function (e) {
      e.preventDefault();
      e.stopPropagation();
      var $this = $(this);
      $(".orderby a", template).addClass("text-muted");
      var dir = $this.hasClass("glyphicon-sort-by-attributes-alt") ? "asc" : "desc";
      $this.removeClass("text-muted").toggleClass("glyphicon-sort-by-attributes glyphicon-sort-by-attributes-alt");
      self["v-fs:sortOrder"] = [ "'" + property_uri + "' " + dir ];
      searchHandler.call(this);
    });
  });

  // Select results
  var toggleSelectAll = searchResultContainer.find(".toggle-select-all");
  searchResultContainer.on("click", ".toggle-select", toggleSelect);

  toggleSelectAll.click(function () {
    var selectedL = self["v-fs:selected"].length;
    var resultsL = resultContainer.children().length;
    if ( resultsL !== 0 && selectedL !== 0 ) {
      clearSelected();
    } else if ( resultsL !== 0 && selectedL === 0) {
      selectAll();
    }
    setToggleSelectAll();
  });
  function setToggleSelectAll() {
    var selectedL = self["v-fs:selected"].length;
    var resultsL = resultContainer.children().length;
    if ( resultsL !== 0 && resultsL === selectedL ) {
      toggleSelectAll.prop("checked", true);
      toggleSelectAll.prop("indeterminate", false);
    } else if ( resultsL !== 0 && selectedL !== 0 && resultsL !== selectedL ) {
      toggleSelectAll.prop("indeterminate", true);
    } else if ( selectedL === 0 ) {
      toggleSelectAll.prop("indeterminate", false);
      toggleSelectAll.prop("checked", false);
    }
  }
  function clearSelected() {
    self.clearValue("v-fs:selected");
    searchResultContainer.find(".toggle-select:checked").prop("checked", false);
  }
  function selectAll() {
    self.clearValue("v-fs:selected");
    searchResultContainer.find(".toggle-select")
      .prop("checked", true)
      .each(function () {
        var result_uri = $(this).closest("[resource]").attr("resource");
        self.addValue("v-fs:selected", new IndividualModel(result_uri));
      });
  }
  function toggleSelect() {
    var $this = $(this);
    var result_uri = $this.closest("[resource]").attr("resource");
    var result = new IndividualModel(result_uri);
    if ( $this.is(":checked") ) {
      self.addValue("v-fs:selected", result);
    } else {
      self.removeValue("v-fs:selected", result);
    }
  }
  self.on("v-fs:selected", setToggleSelectAll);
  template.one("remove", function () {
    self.off("v-fs:selected", setToggleSelectAll);
  });

  // Render result
  function renderResult(resultDelta) {

    $(".results", template).removeClass("hidden");

    // Toggle "more results" button & "no more results" alert
    if ( self["v-fs:cursor"][0] === self["v-fs:estimated"][0] ) {
      moreResults.addClass("hidden");
      allResults.addClass("hidden");
      noMoreResults.removeClass("hidden");
    } else {
      moreResults.removeClass("hidden");
      allResults.removeClass("hidden");
      noMoreResults.addClass("hidden");
    }
    // Toggle "not found" alert & "no more results" alert
    if ( resultDelta.length ) {
      notFound.addClass("hidden");
    } else {
      notFound.removeClass("hidden");
      noMoreResults.addClass("hidden");
    }

    // Render each result
    var total = self["v-fs:authorized"][0];
    var delta = resultDelta.length;

    // New search triggered
    if ( total === delta ) {
      resultContainer.empty();
    }

    return resultDelta.reduce(function(p, result, i) {
      return p.then(function(templates) {
        return result.present(resultContainer, individual.resultTemplate, undefined, undefined, false).then(function (tmpl) {
          tmpl = $(tmpl);
          $(".serial-number", tmpl).text(total - delta + i + 1);
          if (result.id === self.marked) {
            tmpl.addClass("marked");
          }
          tmpl.find(".toggle-select").prop("checked", self.hasValue("v-fs:selected", result));

          $("td", tmpl).each( function () {
            var text = this.innerText || this.textContent;
            if (text && text.length > 100) {
              var $this = $(this);
              var contents = $this.contents();
              var wrapper = $("<div class='td-wrapper'></div>").append(contents);
              $this.empty().append(wrapper);
              wrapper.popover({
                content: wrapper.html(),
                html: true,
                placement: "top"
              }).tooltip({
                title: new IndividualModel("v-fs:ClickToViewContent")["rdfs:label"].map(CommonUtil.formatValue).join(" "),
                placement: "bottom",
                delay: { show: 750, hide: 0 }
              });
            }
          });
          templates.push(tmpl);
          return templates;
        });
      });
    }, Promise.resolve([]))
      .then((templates) => resultContainer.append(templates))
      .then(setToggleSelectAll);
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

  // Read extra parameters from URL
  var hash = window.location.hash;
  var tokens = decodeURI(hash).slice(2).split("/"),
      uri = tokens[0],
      extra = tokens[4];
  if (uri === self.id) {
    if (extra) {
      extra = extra.split("&").reduce(function (acc, pair) {
        var split = pair.split("="),
            property_uri = split[0] || "",
            values = split[1].split("|") || "";
        acc[property_uri] = acc[property_uri] || [];
        values.forEach(function (value) {
          acc[property_uri].push( parse(property_uri, value) );
        });
        return acc;
      }, {});
    }
  }
  function parse (property_uri, value) {
    var property = new IndividualModel(property_uri);
    var range = property.hasValue("rdfs:range") ? property["rdfs:range"][0].id : "rdfs:Resource";
    var parsed;
    switch (range) {
      case "xsd:string": parsed = value; break;
      case "xsd:integer":
      case "xsd:decimal": parsed = parseFloat( value.split(" ").join("").split(",").join(".") ); break;
      case "xsd:boolean": parsed = value === "true"; break;
      case "xsd:dateTime": parsed = new Date(value); break;
      default: parsed = new IndividualModel(value);
    }
    return parsed;
  }

  // Render search form
  return Promise.resolve().then(function () {
    if ( searchBlank ) {
      return searchBlank.load().then(function(searchBlank) {
        $("#reset-button.reset-button", template).click(function () {
          searchBlank.object.off("*");
          delete searchBlank.object;
          resetBlank();
          hideResults();
        });
        return setupBlank();
      });
    } else {
      $(".params", template).remove();
      $("#reset-button.reset-button", template).remove();
    }
    function setupBlank () {
      return searchBlank.initBlank().then(function (blankObject) {
        blankObject.on("propertyModified", hideResults);
        template.one("remove", function () {
          blankObject.off("propertyModified", hideResults);
        });
        // Populate blank with extra parameters from URL
        if (extra) {
          for (var property_uri in extra) {
            blankObject[property_uri] = extra[property_uri];
          }
        }
        if ( searchBlankTemplate && searchBlankContainer.length ) {
          searchBlankContainer.empty();
          return blankObject.present(searchBlankContainer, searchBlankTemplate, "search");
        }
      });
    }
    function resetBlank () {
      return searchBlank.resetBlank().then(function (blankObject) {
        blankObject.on("propertyModified", hideResults);
        template.one("remove", function () {
          blankObject.off("propertyModified", hideResults);
        });
        // Populate blank with extra parameters from URL
        if (extra) {
          for (var property_uri in extra) {
            blankObject[property_uri] = extra[property_uri];
          }
        }
        if ( searchBlankTemplate && searchBlankContainer.length ) {
          searchBlankContainer.empty();
          return blankObject.present(searchBlankContainer, searchBlankTemplate, "search");
        }
      });
    }
    function hideResults () {
      $(".results", template).addClass("hidden");
    }
  }).then(function () {
    // Search on load
    if ( individual.hasValue("v-fs:searchOnLoad", true) ) {
      return self.search()
        .then(renderResult)
        .then(clearSelected)
        .then(function () {
          if ( location.hash.indexOf(individual.id) >= 0 ) {
            scrollTo(self.scroll);
          }
        });
    // Show results on load if they are available (e.g. if we came back)
    } else if ( self.hasValue("v-fs:searchResult") ) {
      return renderResult( self["v-fs:searchResult"] )
        .then(function () {
          if ( location.hash.indexOf(individual.id) >= 0 ) {
            scrollTo(self.scroll);
          }
        });
    }
  });
};

export const html = `
<div>
  <style scoped>
    .swipe {
      cursor: move;
    }
    .td-wrapper {
      max-height: 100px;
      overflow: hidden;
      display: inline-block;
      position: relative;
    }
    .td-wrapper::after {
      content: "";
      position: absolute;
      bottom: 0;
      right: 0;
      z-index: 2;
      border-top: 0 solid transparent;
      border-right: 0 solid transparent;
      border-bottom: 7px solid gray;
      border-left: 7px solid transparent;
    }
    .marked {
      outline-offset: -2px;
      outline: 2px solid #aaa;
    }
  </style>
  <h2 class="caption hidden">
    <span about="@" property="rdfs:label"></span>
    <hr class="margin-sm">
  </h2>
  <div class="params">
    <div class="search-form"></div>
    <br>
    <div class="search-actions clearfix">
      <button class="btn btn-primary search-button" id="search-button" about="v-fs:Find" property="rdfs:label"></button>
      <button class="btn btn-default reset-button" id="reset-button" about="v-fs:Reset" property="rdfs:label"></button>
      <span class="results-load-buttons">
        <button class="more-results btn btn-primary hidden" about="v-fs:MoreResults" property="rdfs:label"></button>
        <button class="all-results btn btn-warning hidden" about="v-fs:AllResults" property="rdfs:label"></button>
      </span>
      <!--div class="pull-right btn-group dropup set-columns-wrapper" style="margin-left:3px;">
        <button type="button" class="btn btn-info dropdown-toggle set-columns" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
          <span about="v-fs:SetColumns" property="rdfs:label"></span>
          <span class="caret"></span>
        </button>
        <div class="dropdown-menu" style="padding:15px; width: 300px; max-height: 500px; overflow-y: auto;">
          <div class="checkbox">
            <label>
              <input class="column-check" type="checkbox" checked="true"> <span class="column-name"></span>
            </label>
          </div>
        </div>
      </div-->
    </div>
    <br>
  </div>
  <div class="results hidden">
    <div class="result-heading">
      <h4 class="clearfix">
        <span class="pull-left" about="v-fs:Results" property="rdfs:label"></span>
        <div class="pull-left margin-md-h" about="@" data-template="v-fs:SelectedResultsActionsTemplate"></div>
        <small class="stats-top pull-right" style="color:black">
          <span about="v-fs:estimated" property="rdfs:label"></span>
          <span about="@" property="v-fs:estimated" class="badge"></span>&nbsp;&nbsp;
          <span about="v-fs:cursor" property="rdfs:label"></span>
          <span about="@" property="v-fs:cursor" class="badge"></span>&nbsp;&nbsp;
          <strong about="v-fs:authorized" property="rdfs:label"></strong>
          <span about="@" property="v-fs:authorized" class="badge"></span>&nbsp;&nbsp;
        </small>
      </h4>
    </div>
    <div class="search-result table-responsive noSwipe"></div>
    <div class="not-found alert alert-warning no-margin hidden">
      <strong about="v-fs:Empty" property="rdfs:label"></strong> <span about="v-fs:NothingFound" property="rdfs:label"></span>
    </div>
    <div class="no-more-results alert alert-success no-margin hidden">
      <strong about="v-fs:NoMoreResults" property="rdfs:label"></strong>
    </div>
  </div>
  <div class="search-error alert alert-danger no-margin hidden">
    <strong about="v-fs:SearchErrorMessage" property="rdfs:label"></strong>
  </div>
</div>
`;
