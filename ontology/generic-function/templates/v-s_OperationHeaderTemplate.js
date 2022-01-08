export const html = `
  <div>
    <div class="clearfix">
      <h4 class="pull-left margin-sm" about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></h4>
      <div class="pull-left margin-md-h" style="margin-top:5px;" about="@" data-template="v-s:OperationProgressTemplate"></div>
    </div>
    <hr class="margin-md" />
    <div class="row margin-md">
      <div class="col-sm-6" style="border-right: 1px solid #ddd;">
        <!--em about="v-s:dataQuery" property="rdfs:label"></em>
      <div style="overflow:auto;" about="@" property="v-s:dataQuery"></div-->
        <em about="v-s:dateFrom" property="rdfs:label"></em>
        <span about="@" property="v-s:dateFrom"></span>
        <em about="v-s:duration" property="rdfs:label"></em>
        <span about="@" property="v-s:duration"></span> sec
        <em about="v-s:processed" property="rdfs:label"></em>
        <span about="@" property="v-s:processed"></span>
        <em about="v-s:creator" property="rdfs:label"></em>
        <span about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></span>
      </div>
      <div class="col-sm-6" style="border-left: 1px solid #ddd; margin-left: -1px;">
        <em about="v-s:data" property="rdfs:label"></em>
        <ul rel="v-s:data" class="view edit search" data-limit="5" data-more="true">
          <li about="@" data-template="v-ui:LabelTemplate"></li>
        </ul>
      </div>
    </div>
  </div>
`;
