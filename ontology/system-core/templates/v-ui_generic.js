import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Construct generic template
  var props = $('#properties', template);
  var propTmpl = props.html();
  props.empty();

  var ontology = veda.ontology;

  var properties = [].concat.apply(
    [],
    individual['rdf:type'].map(function (_class) {
      return ontology.getClassProperties(_class.id);
    }),
  );

  props.append(
    properties.map(function (property_uri, index, array) {
      if (property_uri === '@' || property_uri === 'rdfs:label' || property_uri === 'rdf:type' || property_uri === 'v-s:deleted') {
        return;
      }

      var property = new IndividualModel(property_uri);

      var result = $('<div></div>').append(propTmpl);
      $('.name', result).append($('<strong></strong>', { about: property_uri, property: 'rdfs:label' }).addClass('text-muted'));

      var range = property.hasValue('rdfs:range') ? property['rdfs:range'][0].id : 'rdfs:Resource';

      switch (range) {
        case 'rdfs:Literal':
        case 'xsd:string':
          if (property_uri === 'v-s:script' || property_uri === 'v-ui:template') {
            $('.value', result).append("<veda-control property='" + property_uri + "' data-type='source'></veda-control>");
          } else {
            $('.value', result).append(
              "<div property='" +
                property_uri +
                "' class='view -edit -search'></div>" +
                "<veda-control property='" +
                property_uri +
                "' data-type='multilingualText' class='-view edit search'></veda-control>",
            );
          }
          break;
        case 'xsd:integer':
        case 'xsd:nonNegativeInteger':
          $('.value', result).append(
            "<div property='" +
              property_uri +
              "'></div>" +
              "<veda-control property='" +
              property_uri +
              "' data-type='integer' class='-view edit search'></veda-control>",
          );
          break;
        case 'xsd:decimal':
          $('.value', result).append(
            "<div property='" +
              property_uri +
              "'></div>" +
              "<veda-control property='" +
              property_uri +
              "' data-type='decimal' class='-view edit search'></veda-control>",
          );
          break;
        case 'xsd:dateTime':
          $('.value', result).append(
            "<div property='" +
              property_uri +
              "'></div>" +
              "<veda-control property='" +
              property_uri +
              "' data-type='dateTime' class='-view edit search'></veda-control>",
          );
          break;
        case 'xsd:boolean':
          $('.name', result).empty();
          $('.value', result).append(
            "<div class='checkbox'>" +
              '<label>' +
              "<veda-control property='" +
              property_uri +
              "' data-type='boolean'></veda-control>" +
              "<em about='" +
              property_uri +
              "' property='rdfs:label' class='text-muted'></em>" +
              '</label>' +
              '</div>',
          );
          break;
        case 'rdfs:Resource':
          $('.value', result).append(
            "<div property='" +
              property_uri +
              "'></div>" +
              "<veda-control property='" +
              property_uri +
              "' data-type='generic' class='-view edit search'></veda-control>",
          );
          break;
        default:
          if (property_uri === 'v-s:attachment') {
            $('.value', result).append(
              "<div rel='" +
                property_uri +
                "' data-template='v-ui:FileTemplateWithComment' data-embedded='true'></div>" +
                "<veda-control rel='" +
                property_uri +
                "' data-type='file' class='-view edit -search'></veda-control>",
            );
          } else {
            $('.value', result).append(
              "<div rel='" +
                property_uri +
                "' data-template='v-ui:ClassNameLabelLinkTemplate'></div>" +
                "<veda-control rel='" +
                property_uri +
                "' data-type='link' class='-view edit search fulltext dropdown'></veda-control>",
            );
          }
          break;
      }
      if (index < array.length - 1) result.append($('<hr/>').attr('style', 'margin: 10px 0px'));

      return result;
    }),
  );
};

export const html = `
  <div>
    <div class="container sheet">
      <div class="row">
        <div class="col-md-4 col-xs-5 text-right">
          <h2 class="text-muted" rel="rdf:type" data-template="v-ui:LabelTemplate"></h2>
        </div>
        <div class="col-md-8 col-xs-7">
          <h2 about="@" property="rdfs:label"></h2>
        </div>
      </div>
      <hr style="margin: 10px 0px" />
      <div class="row">
        <div class="col-md-4 col-xs-5 text-right">
          <strong class="text-muted">@</strong>
        </div>
        <div class="col-md-8 col-xs-7">
          <a href="#/@"><span property="@"></span></a>
          <a href="#/@//v-ui:Graph"><span class="glyphicon glyphicon-link"></span></a>
        </div>
      </div>
      <hr style="margin: 10px 0px" />
      <div class="row">
        <div class="col-md-4 col-xs-5 text-right">
          <strong about="rdf:type" property="rdfs:label" class="text-muted"></strong>
        </div>
        <div class="col-md-8 col-xs-7">
          <div rel="rdf:type" data-template="v-ui:ClassNameLabelLinkTemplate"></div>
          <veda-control
            rel="rdf:type"
            data-type="link"
            data-template="{@.rdf:type.rdfs:label} : {@.rdfs:label}"
            class="-view edit search fulltext dropdown"></veda-control>
        </div>
      </div>
      <hr style="margin: 10px 0px" />
      <div class="row">
        <div class="col-md-4 col-xs-5 text-right">
          <strong about="rdfs:label" property="rdfs:label" class="text-muted"></strong>
        </div>
        <div class="col-md-8 col-xs-7">
          <div property="rdfs:label" class="view -edit -search"></div>
          <veda-control property="rdfs:label" data-type="multilingualString" class="-view edit search"></veda-control>
        </div>
      </div>
      <hr style="margin: 10px 0px" />
      <div id="properties">
        <div class="row">
          <div class="col-md-4 col-xs-5 text-right name"></div>
          <div class="col-md-8 col-xs-7 value"></div>
        </div>
      </div>
      <br />
      <br />
      <div class="actions">
        <span
          about="@"
          data-template="v-ui:StandardButtonsTemplate"
          data-embedded="true"
          data-buttons="edit save cancel delete destroy journal task rights"></span>
        <a id="default" class="btn btn-info" href="#/@" about="v-s:Default" property="rdfs:label"></a>
        <a id="generic" class="disabled btn btn-default" href="#/@//v-ui:generic">generic</a>
        <a id="json" class="btn btn-default" href="#/@//v-ui:json">json</a>
        <a id="ttl" class="btn btn-default" href="#/@//v-ui:ttl">ttl</a>
      </div>
    </div>
    <div about="@" class="container sheet view -edit -search" data-template="v-s:CommentsTemplate"></div>
  </div>
`;
