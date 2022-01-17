import $ from 'jquery';
import riot from 'riot';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('.to-journal', template).click(function (e) {
    e.stopPropagation();
    const journalUri = individual['v-wf:onDocument'][0].id + 'j';
    riot.route('#/' + journalUri);
  });
  new IndividualModel('v-ft:ToJournalBundle').load().then(function (bundle) {
    $('.to-journal', template).prop('title', bundle.toString());
  });

  // Child task indicator
  if (individual.hasValue('v-wf:hasChildTask')) {
    template.find('.child-task').addClass('glyphicon glyphicon-comment').prop('title', new IndividualModel('v-wf:hasChildTask').toString());
  }
};

export const html = `
  <tr>
    <td class="serial-number"></td>
    <td><a href="#/@" class="glyphicon glyphicon-search"></a></td>
    <td>
      <div about="@" rel="v-wf:from" data-template="v-ui:LabelTemplate"></div>
      <div about="@" rel="v-wf:redirect_from_task" data-template="v-ft:RedirectInfo_template"></div>
    </td>
    <td about="@" rel="v-wf:to" data-template="v-ui:LabelTemplate"></td>
    <td>
      <span class="child-task text-muted"></span>
    </td>
    <td>
      <a href="#/@" about="@" property="rdfs:label"></a><br />
      <i about="@" property="v-s:description"></i>
    </td>
    <td about="@" rel="v-wf:onDocument" data-template="v-ui:ClassNameLabelTemplate"></td>
    <td about="@" rel="v-wf:takenDecision">
      <div>
        <div property="rdfs:label"></div>
        <i property="rdfs:comment"></i>
      </div>
    </td>
    <td>
      <span class="to-journal pointer text-primary glyphicon glyphicon-list"></span>
    </td>
    <td property="v-s:created"></td>
    <td rel="v-wf:takenDecision">
      <div property="v-s:created"></div>
    </td>
    <td rel="v-wf:takenDecision">
      <div rel="v-s:creator" data-template="v-ui:LabelTemplate"></div>
    </td>
  </tr>
`;
