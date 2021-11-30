import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue("v-s:hasBlank") && !individual.hasValue("v-s:hasCreate")) {
    $(".blanks", template).remove();
  }
  if (!individual.hasValue("v-s:hasRegistry")) {
    $(".registries", template).remove();
  }
  if (!individual.hasValue("v-s:hasReport")) {
    $(".reports", template).remove();
  }
  if (!individual.hasValue("v-s:attachmentBlank")) {
    $(".attachment-blanks", template).remove();
  }
};

export const html = `
<div about="@" class="container">
  <div>
    <div class="sheet">
      <div class="clearfix">
        <div class="pull-left" style="width:78px;" about="@" rel="v-s:hasIcon" data-template="v-ui:ImageTemplate"></div>
        <h2 class="pull-left margin-lg-h" style="color: #555;">
          <span href="#/@" property="rdfs:label"></span>
          <small property="rdfs:comment"></small>
        </h2>
        <div class="pull-right margin-lg" about="@" rel="v-s:hasSettings">
          <a class="btn btn-primary" href="#/@">
            <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
          </a>
        </div>
      </div>
      <hr class="margin-md">
      <div class="row">
        <div class="col-lg-8 col-sm-6" style="border-right: 1px dotted #ddd;">
          <div about="@" property="v-s:description" class="markdown"></div>
          <!--em about="v-s:responsible" property="rdfs:label"></em>
          <div about="@" rel="v-s:responsible" class="margin-md"></div-->
        </div>
        <div class="col-lg-4 col-sm-6">
          <em class="no-margin" about="v-s:ManualBundle" property="rdfs:label"></em>
          <div about="@" rel="v-s:attachment" data-template="v-ui:FileTemplate"></div>
        </div>
      </div>
      <div class="attachment-blanks">
        <em about="v-s:attachmentBlank" property="rdfs:label"></em>
        <div about="@" rel="v-s:attachmentBlank" data-template="v-ui:FileTemplate"></div>
      </div>
    </div>
    <div class="row" style="display: flex; flex-flow: row wrap;">
      <div class="blanks col-md-4 col-sm-6 col-xs-12" style="display: flex;">
        <div class="sheet" style="width:100%;">
          <h4 class="text-center" style="text-transform: uppercase"><i class="fa fa-file-text-o text-muted margin-md-h"></i><span about="v-s:CreateBundle" property="rdfs:label"></span></h4>
          <div about="@" rel="v-s:hasBlank">
            <a href="#/@" class="btn btn-success btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
          <div about="@" rel="v-s:hasCreate">
            <a href="#/@" class="btn btn-success btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
        </div>
      </div>
      <div class="registries col-md-4 col-sm-6 col-xs-12" style="display: flex;">
        <div class="sheet" style="width:100%;">
          <h4 class="text-center" style="text-transform: uppercase"><i class="fa fa-table text-muted margin-md-h"></i><span about="v-s:FindBundle" property="rdfs:label"></span></h4>
          <div about="@" rel="v-s:hasRegistry">
            <a href="#/@" class="btn btn-info btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
        </div>
      </div>
      <div class="reports col-md-4 col-sm-6 col-xs-12" style="display: flex;">
        <div class="sheet" style="width:100%;">
          <h4 class="text-center" style="text-transform: uppercase"><i class="fa fa-bar-chart text-muted margin-md-h"></i><span about="v-s:Report" property="rdfs:label"></span></h4>
          <div about="@" rel="v-s:hasReport">
            <a href="#/@" class="btn btn-warning btn-lg btn-block margin-lg" about="@" property="rdfs:label" style="white-space: normal;"></a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;