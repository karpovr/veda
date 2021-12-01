import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $("#copy-log", template).click(e=>{
    let temp = $("<textarea>");
    $(".modal").append(temp);
    temp.val(individual['rdfs:comment'][0]).select();
    document.execCommand("copy");
    temp.remove();
    return false;
  });

  $(".panel-heading", template).css("cursor", "pointer");
  $(".panel-heading", template).click(e => {
    $(e.target).siblings().slideToggle();
  })

  var dd = individual['rdfs:comment'][0];
  var pre = $("pre", template);
  var anchored = dd.replace(/([a-z0-9_-]+:[a-z0-9_-]*)/gi, "<a class='text-black' href='#/$1//v-ui:ttl'>$1</a>");
  pre.html(anchored);
};

export const html = `
<div class="container sheet">
  <h2>
    <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span><br>
    <small property="@"></small>
  </h2>
  <div class="row">
    <div class="col-md-6">
      <div class="panel panel-default">
        <div class="panel-body bg-default">
          <em about="v-s:moduleUrl" property="rdfs:label"></em>
          <div property="v-s:moduleUrl" class="view -edit -search"></div>
          <veda-control data-type="text" property="v-s:moduleUrl" class="-view edit search"></veda-control>
          <em about="v-s:moduleVersion" property="rdfs:label"></em>
          <div property="v-s:moduleVersion" class="view -edit -search"></div>
          <veda-control data-type="text" property="v-s:moduleVersion" class="-view edit search"></veda-control>
        </div>
      </div>
    </div>
    <div class="col-md-6">
      <div about="@" rel="v-s:hasImage" style="" data-template="v-ui:ImageTemplate"></div>
    </div>
  </div>
  <div class="panel panel-default view -search -create">
    <div class="panel-heading">
      <span>Лог модуля</span>
      <button type="button" class="btn btn-xs btn-default pull-right" id="copy-log">Скопировать</button>
    </div>
    <div class="panel-body">
        <pre property="rdfs:comment" style="border:none; background-color:#fff; font-size: 0.8em; max-height: 500px; overflow-y: auto;"></pre>
    </div>
  </div>
  <!-- заготовка для отображения созданных модулем классов -->
  <!-- <div class="panel panel-default">
    <div class="panel-heading">
      <span>Связанные классы</span>
    </div>
    <div class="panel-body">

    </div>
  </div> -->
  <hr>
  <div class="actions">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="cancel delete"></span>
  </div>
</div>
`;