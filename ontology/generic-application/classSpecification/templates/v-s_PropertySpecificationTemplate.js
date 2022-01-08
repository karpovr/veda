import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (mode != 'search' && !individual.hasValue('v-s:shelfLife') && individual.isNew()) {
    individual['v-s:shelfLife'] = [9999];
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
        <span about="v-ui:ObjectPropertySpecification" property="rdfs:label"></span>
        <small about="@" property="rdfs:label"></small>
      </h3>
      <section id="MainProperties">
        <h4 class="section-header" about="v-s:MainProperties" property="rdfs:label"></h4>
        <div class="section-content">
          <div class="row row-attribute">
            <div class="col-sm-3 col-xs-5">
              <label about="rdfs:label" property="rdfs:label"></label>
            </div>
            <div class="col-sm-9 col-xs-7">
              <div property="rdfs:label" class="view -edit -search"></div>
              <veda-control data-type="multilingualText" property="rdfs:label" class="-view edit search"></veda-control>
            </div>
          </div>
          <div class="row row-attribute">
            <div class="col-sm-3 col-xs-5">
              <label about="v-ui:forClass" property="rdfs:label"></label>
            </div>
            <div class="col-sm-9 col-xs-7">
              <div rel="v-ui:forClass" data-template="v-ui:LabelTemplate"></div>
              <veda-control
                data-type="link"
                rel="v-ui:forClass"
                class="-view edit search fulltext dropdown"
                data-query-prefix="'rdf:type'=='owl:Class'"
                data-template="{@.rdfs:label}, {@.id}"></veda-control>
            </div>
          </div>
          <div class="row row-attribute">
            <div class="col-sm-3 col-xs-5">
              <label about="v-ui:forProperty" property="rdfs:label"></label>
            </div>
            <div class="col-sm-9 col-xs-7">
              <div rel="v-ui:forProperty" data-template="v-ui:LabelTemplate"></div>
              <veda-control
                data-type="link"
                rel="v-ui:forProperty"
                class="-view edit search fulltext dropdown"
                data-query-prefix="'rdf:type'=='owl:DatatypeProperty' || 'rdf:type'=='owl:ObjectProperty'"
                data-template="{@.rdfs:label}, {@.id}"></veda-control>
            </div>
          </div>
          <div class="row row-attribute">
            <div class="col-sm-3 col-xs-5">
              <label about="v-ui:minCardinality" property="rdfs:label"></label>
            </div>
            <div class="col-sm-3 col-xs-3">
              <div property="v-ui:minCardinality" class="view -edit search"></div>
              <veda-control data-type="integer" property="v-ui:minCardinality" class="-view edit search"></veda-control>
            </div>
          </div>
          <div class="row row-attribute">
            <div class="col-sm-3 col-xs-5">
              <label about="v-ui:maxCardinality" property="rdfs:label"></label>
            </div>
            <div class="col-sm-3 col-xs-3">
              <div property="v-ui:maxCardinality" class="view -edit search"></div>
              <veda-control data-type="integer" property="v-ui:maxCardinality" class="-view edit search"></veda-control>
            </div>
          </div>
          <div class="row row-attribute">
            <div class="col-sm-3 col-xs-5">
              <label about="v-ui:queryPrefix" property="rdfs:label"></label>
            </div>
            <div class="col-sm-9 col-xs-7">
              <div property="v-ui:queryPrefix" class="view -edit -search"></div>
              <veda-control data-type="text" property="v-ui:queryPrefix" class="-view edit search"></veda-control>
            </div>
          </div>
          <div class="row row-attribute">
            <div class="col-sm-3 col-xs-5">
              <label about="v-ui:placeholder" property="rdfs:label"></label>
            </div>
            <div class="col-sm-9 col-xs-7">
              <div property="v-ui:placeholder" class="view -edit -search"></div>
              <veda-control data-type="multilingualText" property="v-ui:placeholder" class="-view edit search"></veda-control>
            </div>
          </div>
        </div>
      </section>

      <hr />
      <!--Системные свойства-->
      <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
      <br />
      <div class="actions view edit -search">
        <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
      </div>
    </div>

    <div about="@" class="container sheet view edit -search" data-template="v-s:LinksTemplate" data-embedded="true"></div>
    <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
  </div>
`;
