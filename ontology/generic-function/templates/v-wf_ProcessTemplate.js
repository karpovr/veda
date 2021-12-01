import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  System.import("jsworkflow").then(function (module) {
    var jsWorkflow = module.default;
    var wrapper = $(".workflow-canvas-wrapper", template),
      height = ( $("#copyright").offset().top - wrapper.offset().top - 15 ) + "px",
      fullWidth = $("#full-width", template),
      icon = $("span", fullWidth),
      propsCol = $("#props-col", template),
      schema = $("#schema", template);
    wrapper.css("height", height);
    propsCol.css("height", height);
    fullWidth.click(function () {
      propsCol.toggle();
      icon.toggleClass("glyphicon-resize-full glyphicon-resize-small");
      schema.toggleClass("col-md-8 col-md-12");
    });
    jsWorkflow.ready(function () {
        // Create a new workflow instance as workflow
        var workflow = new jsWorkflow.Instance();

        // Initialize workflow with workflow container id
        var net = workflow.init('workflow-canvas', veda, individual, template, container);
    });
  });
};

export const html = `
<div class="workflow-wrapper container-fluid sheet">
  <style>
    #main {
      margin-bottom: 0px;
    }
  </style>
  <div class="row">
    <div id="schema" class="col-md-8">
      <div class="workflow-canvas-wrapper">
        <div class="row" id="workflow-toolbar">
          <div class="col-md-4">
            <h4 id="workflow-net-name" style="margin-left:10px"></h4>
          </div>
          <div class="col-md-8">
            <div class="btn-toolbar pull-right">

              <div class="btn-group">
                <button type="button" class="btn btn-sm btn-default zoom-in">
                  <span class="glyphicon glyphicon-zoom-in" aria-hidden="true"></span>
                </button>
                <button type="button" class="btn btn-sm btn-default zoom-default">
                  <span class="glyphicon glyphicon-search" aria-hidden="true"></span>
                </button>
                <button type="button" class="btn btn-sm btn-default zoom-out">
                  <span class="glyphicon glyphicon-zoom-out" aria-hidden="true"></span>
                </button>
              </div>

              <div class="btn-group">
                <button type="button" class="btn btn-sm btn-default process-refresh">
                  <span class="glyphicon glyphicon-refresh" aria-hidden="true"></span>
                </button>
              </div>
              <div class="btn-group">
                  <button type="button" class="btn btn-sm btn-default to-net-editor">
                    <span class="glyphicon glyphicon-pencil" aria-hidden="true"></span>
                  </button>
              </div>
              <div class="btn-group">
                <button id="full-width" class="btn btn-sm btn-default">
                <span class=" glyphicon glyphicon-resize-full" aria-hidden="true"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div id="workflow-canvas">
        </div>
      </div>
    </div>
    <div id="props-col" class="col-md-4">
      <h4>Элемент: <span id="props-head" property="rdfs:label"></span></h4><hr class="no-margin"/><br/>
      <div id="props"></div>
    </div>
    <div id="workflow-context-menu" class="dropdown clearfix">
        <ul class="workflow-context-menu-list" role="menu" aria-labelledby="dropdownMenu" style="display:block;position:static;margin-bottom:5px;">
        </ul>
    </div>
  </div>
</div>
`;