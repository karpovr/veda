import $ from 'jquery';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  individual.on('v-s:archived', archivedHandler);
  template.one('remove', function () {
    individual.off('v-s:archived', archivedHandler);
  });
  function archivedHandler() {
    this['v-s:deleted'] = this['v-s:archived'];
  }
};

export const html = `
<div>
  <h3 about="v-ui:SystemPropertiesTemplate" property="rdfs:comment"></h3>
  <div class="row">
    <div class="col-sm-3 col-xs-12">
      <em about="v-s:creator" property="rdfs:label"></em>
      <veda-control data-type="link" rel="v-s:creator" class="-view -edit search fulltext"></veda-control>
      <div about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
      <div rel="v-s:creator" data-template="v-ui:LabelTemplate" class="-view -edit search"></div>
    </div>
    <div class="col-sm-3 col-xs-12">
      <em about="v-s:created" property="rdfs:label"></em>
      <veda-control property="v-s:created" data-type="date" class="-view -edit search"></veda-control>
      <div about="@" property="v-s:created" class="view edit -search"></div>
      <div property="v-s:created" class="-view -edit search"></div>
    </div>
    <div class="col-sm-3 col-xs-12">
      <em about="v-s:lastEditor" property="rdfs:label"></em>
      <veda-control data-type="link" rel="v-s:lastEditor" class="-view -edit search fulltext"></veda-control>
      <div about="@" rel="v-s:lastEditor" data-template="v-ui:LabelTemplate" class="view edit -search"></div>
      <div rel="v-s:lastEditor" data-template="v-ui:LabelTemplate" class="-view -edit search"></div>
    </div>
    <div class="col-sm-3 col-xs-12">
      <em about="v-s:edited" property="rdfs:label"></em>
      <veda-control data-type="date" property="v-s:edited" class="-view -edit search"></veda-control>
      <div about="@" property="v-s:edited" class="view edit -search"></div>
      <div property="v-s:edited" class="-view -edit search"></div>
    </div>
  </div>
  <div class="-view -edit search margin-md">
    <label class="checkbox-inline">
      <veda-control property="v-s:archived" data-type="boolean"></veda-control>
      <strong about="v-s:archived" property="rdfs:label"></strong>
    </label>
    <label class="checkbox-inline">
      <veda-control property="v-s:deleted" data-type="boolean"></veda-control>
      <strong about="v-s:deleted" property="rdfs:label"></strong>
    </label>
  </div>
</div>
`;