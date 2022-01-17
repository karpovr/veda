import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const propСontainer = $('.properties-container', template);
  const tmpl = propСontainer.html();
  propСontainer.empty();
  const promises = Object.keys(this.properties).map(function (property_uri) {
    if (property_uri === '@' || property_uri === 'rdf:type' || property_uri === 'rdfs:label') {
      return;
    }
    const propRow = $(tmpl);
    propRow.find('.prop-name').attr({
      about: property_uri,
      property: 'rdfs:label',
    });
    const property = new IndividualModel(property_uri);
    return property.load().then(function (property) {
      const literalAttrs = {
        about: '@',
        property: property_uri,
      };
      const objectAttrs = {
        'about': '@',
        'rel': property_uri,
        'data-template': 'v-ui:LabelLinkTemplate',
      };
      if (property.hasValue('rdfs:range')) {
        if (['xsd:string', 'xsd:integer', 'xsd:decimal', 'xsd:boolean', 'xsd:Literal', 'xsd:dateTime'].indexOf(property['rdfs:range'][0].id) >= 0) {
          propRow.find('.prop-value').attr(literalAttrs);
        } else {
          propRow.find('.prop-value').attr(objectAttrs);
        }
      } else {
        propRow.find('.prop-value').attr(literalAttrs);
      }
      propСontainer.append(propRow);
    });
  });
  return Promise.all(promises);
};

export const html = `
  <div class="container sheet">
    <div class="clearfix">
      <h2 class="pull-left">
        <span about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></span>
        <small about="@" property="rdfs:label"></small>
        <small>(<span about="@" property="@"></span>)</small>
      </h2>
    </div>
    <div class="properties-container">
      <hr class="margin-sm" />
      <div class="row">
        <div class="col-md-4 col-sm-6 text-right prop-name"></div>
        <div class="col-md-8 col-sm-6 prop-value"></div>
      </div>
    </div>
  </div>
`;
