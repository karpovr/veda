import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  template.on("validate", function () {
    var result = {};
    //if (individual.hasValue("v-s:isShelfLifeAlways",false)) {
    result["v-s:shelfLife"] = {
      state: individual.hasValue("v-s:shelfLife"),
      cause: ["v-ui:minCardinality"]
    };
    //}
    result["v-ui:forClass"] = {
      state: individual.hasValue("v-ui:forClass"),
      cause: ["v-ui:minCardinality"]
    };
    template[0].dispatchEvent(new CustomEvent("validated", {detail: result}));
  });
};

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (mode != "search" && !individual.hasValue("v-s:shelfLife") && individual.isNew()) {
    individual["v-s:shelfLife"] = [9999];
  }
  /*function shelfLifeView() {
    if (individual.hasValue("v-s:isShelfLifeAlways",false)) {
      $(".shelfLife", template).removeClass("hidden");
    }
    else { $(".shelfLife", template).addClass("hidden");}
  }
  shelfLifeView();
  individual.on("v-s:isShelfLifeAlways", shelfLifeView);
  template.one("remove", function () {
    individual.off("v-s:isShelfLifeAlways", shelfLifeView);
  });*/
};

export const html = `
<div>
  <div class="container sheet">
    <div class="alert alert-info -view edit -search">
      <span>Помни, что индивиды данного класса находятся в ttl.</span>
    </div>
    <h3 class="margin-sm">
      <span about="v-s:ClassSpecification" property="rdfs:label"></span>
      <small about="@" property="rdfs:label"></small>
    </h3>
    <section id="MainProperties">
      <h4 class="section-header" about="v-s:MainProperties" property="rdfs:label"></h4>
      <div class="section-content">
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-ui:forClass" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-ui:forClass" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-ui:forClass" class="-view edit search fulltext dropdown"
              data-query-prefix="'rdf:type'=='owl:Class'" data-template="{@.rdfs:label}, {@.id}"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-ui:defaultTemplate" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-ui:defaultTemplate" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-ui:defaultTemplate" class="-view edit search fulltext dropdown"
              data-query-prefix="'v-ui:ClassTemplate'" data-template="{@.rdfs:label}, {@.id}"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5 name">
            <label about="v-s:hasDeletedProperties" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7 value">
            <div rel="v-s:hasDeletedProperties" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
            <veda-control rel="v-s:hasDeletedProperties" data-type="link" class="-view edit search fulltext dropdown"
              data-query-prefix="'rdf:type'=='owl:ObjectProperty'" data-template="{@.rdfs:label}, {@.id}">
            </veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5 name">
            <label about="v-s:dateProperties" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7 value">
            <div rel="v-s:dateProperties" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
            <veda-control rel="v-s:dateProperties" data-type="link" class="-view edit search fulltext dropdown"
              data-template="{@.rdfs:label}, {@.id}"></veda-control>
          </div>
        </div>
        <!--<div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <em about="v-s:isShelfLifeAlways" property="rdfs:label"></em>
          </div>
          <div class="col-sm-3 col-xs-3">
             <div class="checkbox">
                <label>
                  <veda-control data-type="boolean" property="v-s:isShelfLifeAlways" class="view edit search"></veda-control>
                </label>
              </div>
          </div>
        </div>-->
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:shelfLife" property="rdfs:label"></label>
          </div>
          <div class="col-sm-3 col-xs-3">
            <div property="v-s:shelfLife" class="view -edit -search"></div>
            <veda-control data-type="integer" property="v-s:shelfLife" class="-view edit search"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:responsible" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:responsible" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-s:responsible" class="-view edit search fulltext"
              data-query-prefix="'rdf:type'=='v-s:Appointment' && 'v-s:official'===true"></veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:hasApplication" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:hasApplication" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-s:hasApplication" class="-view edit search fulltext dropdown">
            </veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="v-s:hasAspect" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div rel="v-s:hasAspect" data-template="v-ui:LabelTemplate"></div>
            <veda-control data-type="link" rel="v-s:hasAspect" class="-view edit search fulltext dropdown">
            </veda-control>
          </div>
        </div>
        <div class="row row-attribute">
          <div class="col-sm-3 col-xs-5">
            <label about="rdfs:comment" property="rdfs:label"></label>
          </div>
          <div class="col-sm-9 col-xs-7">
            <div property="rdfs:comment" class="view -edit -search"></div>
            <veda-control data-type="text" property="rdfs:comment" class="-view edit search"></veda-control>
          </div>
        </div>
      </div>
    </section>

    <hr>
    <!--Системные свойства-->
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br>
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true"
        data-buttons="edit save cancel delete"></span>
    </div>
  </div>

  <div about="@" class="container sheet view edit -search" data-template="v-s:LinksTemplate" data-embedded="true"></div>
  <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
</div>
`;