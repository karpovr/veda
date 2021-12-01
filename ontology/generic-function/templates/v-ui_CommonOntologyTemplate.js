import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if ( this.isNew() ) {
    $("#uri", template)
      .prop("placeholder", this.id)
      .change(function () {
        if (this.value) {
          individual.id = this.value;
        }
      });
  } else {
    $("#uri", template).remove();
  }
};

export const html = `
<div style="position:relative;">
  <a style="position:absolute;top:10px;right:10px;" href="#/@//v-ui:Graph"><span class="glyphicon glyphicon-link"></span></a>
  <h3><span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span><br><small><span about="@" property="rdfs:label"></span> (<span property="@"></span>)</small></h3>
  <input type="text" id="uri" class="form-control" />
  <em about="rdfs:label" property="rdfs:label" class="-view edit search"></em>
  <veda-control property="rdfs:label" data-type="multilingualString" class="-view edit search"></veda-control>
  <em about="rdfs:comment" property="rdfs:label" class="-view edit search"></em>
  <i property="rdfs:comment" class="view -edit -search"></i>
  <veda-control property="rdfs:comment" data-type="multilingualText" rows="2" class="-view edit search"></veda-control>
  <hr>
</div>
`;