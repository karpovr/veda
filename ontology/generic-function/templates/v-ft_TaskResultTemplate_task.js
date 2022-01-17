import $ from 'jquery';
import veda from '/js/common/veda.js';
import riot from 'riot';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Remove completed tasks from inbox & outbox
  const folder = decodeURIComponent(location.hash).substr(2).split('/')[0];
  const remove = folder !== 'v-ft:Completed';
  removeCompleted.call(this);
  function removeCompleted () {
    if (remove && this.hasValue('v-wf:isCompleted', true)) {
      template.remove();
    }
  }
  individual.on('v-wf:isCompleted', removeCompleted);
  template.one('remove', function () {
    individual.off('v-wf:isCompleted', removeCompleted);
  });

  $('.to-journal', template).click(function (e) {
    e.stopPropagation();
    const journalUri = individual['v-wf:onDocument'][0].id + 'j';
    riot.route('#/' + journalUri);
  });
  new IndividualModel('v-ft:ToJournalBundle').load().then(function (bundle) {
    $('.to-journal', template).prop('title', bundle.toString());
  });

  // Toggle read/unread
  const toggler = $('.toggle-read', template);
  toggler.prop('title', new IndividualModel('v-ft:ReadUnreadBundle').toString());
  if (folder === 'v-ft:Inbox') {
    toggler.addClass('pointer').click(toggleReadClickHandler);
  }
  function toggleReadClickHandler (e) {
    e.stopPropagation();
    const isRead = individual.hasValue('v-wf:read', true);
    toggleRead(!isRead);
    Backend.set_in_individual({
      ticket: veda.ticket,
      individual: {
        '@': individual.id,
        'v-wf:read': [
          {
            data: !isRead,
            type: 'Boolean',
          },
        ],
      },
      async: true,
    });
  }
  function readHandler () {
    const isRead = individual.hasValue('v-wf:read', true);
    toggleRead(isRead);
  }
  function toggleRead (isRead) {
    if (isRead) {
      template.css('font-weight', 'normal');
      toggler.removeClass('text-primary').addClass('text-muted');
    } else {
      template.css('font-weight', 'bold');
      toggler.removeClass('text-muted').addClass('text-primary');
    }
  }
  readHandler();
  individual.on('v-wf:read', readHandler);
  template.one('remove', function () {
    individual.off('v-wf:read', readHandler);
  });

  // Child task indicator
  if (individual.hasValue('v-wf:hasChildTask')) {
    template.find('.child-task').addClass('glyphicon glyphicon-comment').prop('title', new IndividualModel('v-wf:hasChildTask').toString());
  }

  // Due date indicator
  const dateGivenCell = $('.date-given', template);
  const yesterday = new Date().setHours(0, 0, 0, 1);
  const tomorrow = new Date().setHours(23, 59, 59, 999);
  const dateGiven = individual['v-wf:dateGiven'][0];
  const dateGivenYesterday = new Date(dateGiven).setHours(0, 0, 0, 1);
  const dateGivenTomorrow = new Date(dateGiven).setHours(23, 59, 59, 999);
  const dateDone = individual.hasValue('v-wf:takenDecision') && individual['v-wf:takenDecision'][0]['v-s:created'][0];
  if (individual.hasValue('v-wf:isCompleted', false)) {
    if (dateGiven < yesterday) {
      dateGivenCell.toggleClass('bg-danger');
    } else if (yesterday < dateGiven && dateGiven <= tomorrow) {
      dateGivenCell.toggleClass('bg-warning');
    } else if (tomorrow < dateGiven) {
      dateGivenCell.toggleClass('bg-success');
    }
  } else {
    if (dateGivenYesterday < dateDone && dateDone <= dateGivenTomorrow) {
      dateGivenCell.toggleClass('bg-warning');
    } else if (dateDone < dateGiven) {
      dateGivenCell.toggleClass('bg-success');
    } else if (dateGiven < dateDone) {
      dateGivenCell.toggleClass('bg-danger');
    }
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
      <span class="toggle-read glyphicon glyphicon-exclamation-sign"></span>
      <span class="child-task text-muted"></span>
    </td>
    <td>
      <a href="#/@" about="@" property="rdfs:label"></a><br />
      <i about="@" property="v-s:description"></i>
    </td>
    <td about="@" rel="v-wf:onDocument" data-template="v-ui:ClassNameLabelTemplate"></td>
    <td>
      <span class="to-journal pointer text-primary glyphicon glyphicon-list"></span>
    </td>
    <td about="@" property="v-s:created"></td>
    <td about="@" property="v-wf:dateGiven" class="date-given"></td>
  </tr>
`;
