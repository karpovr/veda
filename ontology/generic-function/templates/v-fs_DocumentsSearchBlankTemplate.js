import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function searchHandler() {
    var queryString = null;
    if (individual.hasValue('rdfs:label')) {
      queryString = "('*'=='" + individual['rdfs:label'][0] + "')";
    }
    if (individual.hasValue('v-s:created')) {
      var dates = individual['v-s:created'];
      var start = new Date(dates[0]);
      var end = new Date(dates[dates.length - 1]);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      var createdPart = "('v-s:created'==[" + start.toISOString() + ',' + end.toISOString() + '])';

      queryString = queryString == null ? createdPart : queryString + ' && ' + createdPart;
    }

    if (individual.hasValue('v-fs:requiredClass')) {
      var typePart = individual['v-fs:requiredClass']
        .map(function (type) {
          return "('rdf:type'==='" + type.id + "')";
        })
        .join(' || ');
      typePart = '(' + typePart + ')';

      queryString = queryString == null ? typePart : queryString + ' && ' + typePart;
    } else if (queryString != null) {
      queryString = queryString + " && ('rdf:type'=='v-s:Document')";
    }

    if (queryString != null) {
      individual.set('*', [queryString]);
    } else {
      delete individual.properties['*'];
    }
  }

  individual.on('rdfs:label', searchHandler);
  individual.on('v-fs:requiredClass', searchHandler);
  individual.on('v-s:created', searchHandler);
  template.one('remove', function () {
    individual.off('rdfs:label', searchHandler);
    individual.off('v-fs:requiredClass', searchHandler);
    individual.off('v-s:created', searchHandler);
  });
};

export const html = `
  <div>
    <div class="row">
      <div class="col-md-4">
        <em about="v-fs:SearchForContentBundle" property="rdfs:label"></em>
        <veda-control property="rdfs:label" data-type="string" placeholder="Введите запрос"></veda-control>
      </div>
      <div class="col-md-4">
        <em about="v-fs:requiredClass" property="rdfs:label"></em>
        <div rel="v-fs:requiredClass" data-template="v-ui:LabelTemplate"></div>
        <veda-control
          rel="v-fs:requiredClass"
          data-type="link"
          class="fulltext dropdown"
          data-query-prefix="'rdfs:subClassOf'==='v-s:UserSearchableDocument'"></veda-control>
      </div>
      <div class="col-md-4">
        <em about="v-s:created" property="rdfs:label"></em>
        <div property="v-s:created"></div>
        <veda-control data-type="date" property="v-s:created"></veda-control>
      </div>
    </div>
  </div>
`;
