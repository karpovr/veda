export const html = `
  <div class="container sheet">
    <div class="clearfix">
      <h2 class="pull-left" about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></h2>
      <a class="pull-right" href="#/@"><small property="@"></small></a>
    </div>
    <em about="rdfs:label" property="rdfs:label" class="-view edit search"></em>
    <h3 property="rdfs:label"></h3>
    <veda-control property="rdfs:label" data-type="string" class="-view edit search" id="label"></veda-control>
    <br class="-view edit search" />
    <em about="rdfs:comment" property="rdfs:label" class="-view edit search"></em>
    <div><em property="rdfs:comment"></em></div>
    <veda-control property="rdfs:comment" data-type="string" class="-view edit search" id="comment"></veda-control>
    <br class="-view edit search" />
    <div class="checkbox">
      <label>
        <veda-control property="v-ui:testBoolean" data-type="boolean"></veda-control>
        <em about="v-ui:testBoolean" property="rdfs:label"></em>
      </label>
    </div>
    <hr />
    <em about="v-s:hasTransportKind" property="rdfs:label"></em>
    <div rel="v-s:hasTransportKind" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
    <veda-control data-type="link" rel="v-s:hasTransportKind" class="-view edit search fulltext dropdown"></veda-control>
    <em about="v-s:hasTransportKindSingle" property="rdfs:label"></em>
    <div rel="v-s:hasTransportKindSingle" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
    <veda-control data-type="link" rel="v-s:hasTransportKindSingle" class="-view edit search fulltext dropdown"></veda-control>
    <hr />
    <em about="v-ui:testString" property="rdfs:label"></em>
    <div property="v-ui:testString"></div>
    <veda-control property="v-ui:testString" data-type="string" class="-view edit search" id="testString"></veda-control>
    <veda-control property="v-ui:testString" data-type="multilingualString" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testString" data-type="text" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testString" data-type="multilingualText" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testString" data-type="select" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testString" data-type="checkbox" class="view edit search"></veda-control>
    <veda-control property="v-ui:testString" data-type="radio" class="view edit search"></veda-control>
    <veda-control property="v-ui:testString" data-type="augmentedText" class="view edit search"></veda-control>
    <hr />
    <em about="v-ui:testInteger" property="rdfs:label"></em>
    <div property="v-ui:testInteger"></div>
    <veda-control property="v-ui:testInteger" data-type="integer" class="-view edit search"></veda-control>
    <br />
    <br />
    <veda-control property="v-ui:testInteger" data-type="select" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testInteger" data-type="checkbox"></veda-control>
    <veda-control property="v-ui:testInteger" data-type="radio"></veda-control>
    <hr />
    <em about="v-ui:testDecimal" property="rdfs:label"></em>
    <div property="v-ui:testDecimal"></div>
    <veda-control property="v-ui:testDecimal" data-type="decimal" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testDecimal" data-type="select" class="-view edit search"></veda-control>
    <hr />
    <em about="v-ui:testDatetime" property="rdfs:label"></em>
    <div property="v-ui:testDatetime" class="view edit -search"></div>
    <veda-control property="v-ui:testDatetime" data-type="date" class="-view edit search" id="date"></veda-control>
    <veda-control property="v-ui:testDatetime" data-type="dateTime" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testDatetime" data-type="select" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testDatetime" data-type="checkbox" class="-view edit search"></veda-control>
    <veda-control property="v-ui:testDatetime" data-type="radio" class="-view edit search"></veda-control>
    <hr />
    <em about="v-ui:testLink" property="rdfs:label"></em>
    <div rel="v-ui:testLink" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
    <veda-control rel="v-ui:testLink" data-type="link" class="-view edit search full"></veda-control>
    <veda-control rel="v-ui:testLink" data-type="checkbox"></veda-control>
    <veda-control rel="v-ui:testLink" data-type="radio"></veda-control>
    <veda-control rel="v-ui:testLink" data-type="select" class="-view edit search"></veda-control>
    <!--hr>
  <em about="v-ui:template" property="rdfs:label"></em>
  <veda-control property="v-ui:template" data-type="source"></veda-control>
  <hr>
  <em about="v-s:script" property="rdfs:label"></em>
  <veda-control property="v-s:script" data-type="source"></veda-control-->
    <hr />
    <em about="v-ui:testFile" property="rdfs:label"></em>
    <div rel="v-ui:testFile" data-template="v-ui:FileTemplate" class="view edit -search"></div>
    <br />
    <veda-control rel="v-ui:testFile" data-type="file" class="-view edit -search"></veda-control>
    <br />
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="send edit save cancel delete journal task"></span>
    </div>
    <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
  </div>
`;
