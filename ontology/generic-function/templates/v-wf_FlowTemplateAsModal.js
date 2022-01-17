import $ from 'jquery';
import veda from '/js/common/veda.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function handler (values) {
    if (veda.net) {
      $.each(veda.net.getAllConnections(), function (idx, connection) {
        if (connection.id === individual.id) {
          const value = typeof values[0] === 'undefined' ? '' : values[0];
          if (connection.getOverlay('flowLabel') == undefined) {
            connection.addOverlay(['Label', {label: value, location: 0.5, id: 'flowLabel'}]);
          } else {
            connection.getOverlay('flowLabel').setLabel(value);
          }
        }
      });
    }
  }
  individual.on('rdfs:label', handler);
  template.one('remove', function () {
    individual.off('rdfs:label');
  });
};

export const html = `
  <div>
    <table id="taskTemplateProperties" class="table table-condensed table-hover properties-editor">
      <thead>
        <tr>
          <td style="width:25%"><span about="v-wf:Net" property="rdfs:label"></span></td>
          <td>
            <strong
              ><span about="@" property="@"></span> <a href="#/@"><i class="glyphicon glyphicon-share-alt"></i></a
            ></strong>
          </td>
        </tr>
      </thead>
      <tr onclick="javascript: $('#VClabel').show(); $('#viewVClabel').hide();">
        <td><span about="rdfs:label" property="rdfs:label"></span></td>
        <td>
          <veda-control id="VClabel" data-type="string" property="rdfs:label" class="properties-editor" style="display:none;"></veda-control>
          <div id="viewVClabel" about="@" property="rdfs:label"></div>
        </td>
      </tr>
      <tr onclick="javascript: $('#VCcomment').show(); $('#viewVCcomment').hide();">
        <td><span about="rdfs:comment" property="rdfs:label"></span></td>
        <td>
          <veda-control id="VCcomment" data-type="string" property="rdfs:comment" class="properties-editor" style="display:none;"></veda-control>
          <div id="viewVCcomment" about="@" property="rdfs:comment"></div>
        </td>
      </tr>
      <tr onclick="javascript: $('#VCpredicate').show().trigger('edit'); $('#viewVCpredicate').hide();">
        <td><span about="v-wf:predicate" property="rdfs:label"></span></td>
        <td>
          <veda-control
            id="VCpredicate"
            data-type="source"
            mode="javascript"
            property="v-wf:predicate"
            class="properties-editor"
            style="display:none;width:75%"></veda-control>
          <div id="viewVCpredicate" about="@" property="v-wf:predicate"></div>
        </td>
      </tr>
      <tr>
        <td><span about="v-wf:flowsInto" property="rdfs:label"></span></td>
        <td>
          <strong><span about="@" rel="v-wf:flowsInto" data-template="v-ui:LabelTemplate"></span></strong>
        </td>
      </tr>
    </table>
  </div>
`;
