import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function handler (values) {
    const $state = $('#' + BrowserUtil.escape4$(individual.id));
    $('.state-name', $state).html(values);
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
          <td style="width:25%"><span about="v-wf:NetElement" property="rdfs:label"></span></td>
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
      <tr>
        <td about="v-wf:hasFlow" property="rdfs:label"></td>
        <td about="@" rel="v-wf:hasFlow">
          <div>
            #<a href="#/@">
              <strong><span about="@" rel="v-wf:flowsInto" data-template="v-ui:LabelTemplate"></span></strong>
              [<span about="@" property="v-wf:predicate"></span>]
            </a>
          </div>
        </td>
      </tr>
      <tr>
        <td about="v-wf:locationX" property="rdfs:label"></td>
        <td about="@" property="v-wf:locationX"></td>
      </tr>
      <tr>
        <td about="v-wf:locationY" property="rdfs:label"></td>
        <td about="@" property="v-wf:locationY"></td>
      </tr>
    </table>
  </div>
`;
