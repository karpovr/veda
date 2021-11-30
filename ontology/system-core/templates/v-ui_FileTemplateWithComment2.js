import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  var fn = individual["v-s:fileName"][0];
  if (typeof fn === "string" || fn instanceof String) {
    var idx = fn.lastIndexOf("."),
        ext = fn.substr(idx + 1);
    $("span#icon", template).text(ext);
  }
};

export const html = `
<div class="panel panel-default" style="word-wrap:break-word; width:250px; display: inline-block; margin:0 20px 20px 0; overflow: hidden">
  <div class="panel-body">
    <!--Remove-->
    <em about="v-s:fileUri" property="rdfs:label"></em>
    <veda-control data-type="string" property="v-s:fileUri"></veda-control>
    <em about="v-s:filePath" property="rdfs:label"></em>
    <veda-control data-type="string" property="v-s:filePath"></veda-control>
    <!--/Remove-->

    <em about="rdfs:comment" property="rdfs:label" class="-view edit search"></em>
    <strong property="rdfs:comment" class="view -edit -search"></strong>
    <veda-control data-type="string" property="rdfs:comment" class="-view edit search"></veda-control>
    <br>
    <hr class="margin-sm view -edit -search">
    <div>
      <span id="icon" class="label label-primary"></span>
      <a href="/files/@">
        <span about="@" property="v-s:fileName"></span>
      </a>
    </div>
    <div class="view -edit -search" style="font-style:italic">
      <small rel="v-s:creator" data-template="v-ui:LabelTemplate"></small><small property="v-s:created"></small>
    </div>
  </div>
  <!--Remove-->
  <div class="actions panel-footer">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save"></span>
  </div>
  <!--/Remove-->
</div>
`;