import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var re = new RegExp('.*?:');
  var label = template.text();
  template.attr('title', label);
  if (label.length > 70) {
    label = label.replace(re, function (typeName) {
      return (
        typeName
          .split(' ')
          .reduce(function (abbr, word) {
            return (abbr += word.charAt(0));
          }, '')
          .toUpperCase() + ':'
      );
    });
    label = label.substring(0, 70) + '...';
    template.text(label);
  }
};

export const html = `
  <a href="#/@"
    ><span about="@" rel="rdf:type"><span about="@" property="rdfs:label"></span></span>: <span about="@" property="rdfs:label"></span
  ></a>
`;
