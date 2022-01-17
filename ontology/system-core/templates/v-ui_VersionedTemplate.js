import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const actual = individual.hasValue('v-s:actualVersion') ? individual['v-s:actualVersion'][0] : individual;
  const tmpl =
    '' +
    '<tr>' +
    '<td>#</td>' +
    '<td about="@" data-template="v-ui:LabelLinkTemplate" class="view edit -search"></td>' +
    '<td about="@" property="v-s:created" class="view edit -search"></td>' +
    '<td about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate" class="view edit -search"></td>' +
    '</tr>';
  const tbody = $('#versions', template);
  const btn = $('button', template).click(function () {
    tbody.empty();
    renderVersion(actual, 1, -1);
  });
  renderVersion(actual, 1, 5);

  individual.on('v-s:previousVersion', versionHandler);
  template.one('remove', function () {
    individual.off('v-s:previousVersion', versionHandler);
  });
  function versionHandler () {
    tbody.empty();
    renderVersion(actual, 1, 5);
  }

  function renderVersion (current, counter, limit) {
    if (!current) {
      return btn.remove();
    }
    if (!limit) {
      return;
    }
    return current.load().then(function (current) {
      const previous = current['v-s:previousVersion'][0];
      let row = tmpl.replace('#', counter);
      if (current.id === actual.id) {
        row = row.replace('<tr>', "<tr class='info'>");
      }
      if (current.id === individual.id) {
        row = row.replace(/td/g, 'th').replace('v-ui:LabelLinkTemplate', 'v-ui:LabelTemplate');
      }
      return current.present(tbody, row).then(function () {
        renderVersion(previous, ++counter, --limit);
      });
    });
  }
};

export const html = `
  <div>
    <h3 about="v-ui:VersionedTemplate" property="rdfs:comment"></h3>
    <div class="panel panel-default">
      <table class="table table-condensed">
        <thead>
          <tr class="active">
            <th width="1%">#</th>
            <th about="rdfs:label" property="rdfs:label"></th>
            <th about="v-s:created" property="rdfs:label"></th>
            <th about="v-s:creator" property="rdfs:label"></th>
          </tr>
        </thead>
        <tbody id="versions"></tbody>
        <tfoot>
          <tr>
            <td colspan="10" class="clearfix">
              <button class="pull-left btn btn-xs btn-primary glyphicon glyphicon-chevron-down"></button>
              <div class="pull-right">
                <span class="bg-info" style="padding:0px 5px;display: inline-block">Актуальная версия</span>
                <strong>Текущая версия</strong>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
`;
