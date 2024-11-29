import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import notify from '/js/browser/notify.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const actions = $('.actions', template);
  const scriptBlock = $('.script', template);
  const audience = $('.audience', template);
  const statusBlock = $('.status-block', template);
  const datesBlock = $('.dates-block', template);

  // Устанавливаем сегодняшнюю дату по умолчанию для dateFrom
  if (!individual.hasValue('v-s:dateFrom')) {
    individual['v-s:dateFrom'] = [new Date()];
  }

  template.on('validate', function () {
    const result = {};
    result['v-s:dateFrom'] = {
      state: individual.hasValue('v-s:dateFrom'),
      cause: ['v-ui:minCardinality'],
    };
    result['v-s:dateTo'] = {
      state: individual.hasValue('v-s:dateTo'), 
      cause: ['v-ui:minCardinality'],
    };
    template[0].dispatchEvent(new CustomEvent('validated', {detail: result}));
  });

  return veda.user.isMemberOf('cfg:SuperUser').then(function (isSuperUser) {
    if (!isSuperUser) {
      actions.remove();
      scriptBlock.remove();
      audience.remove();
      statusBlock.remove();
      datesBlock.remove();
    } else {
      const notifyAction = $('.notify-action', template);
      const clientNotification = new IndividualModel('cfg:ClientNotification');
      clientNotification.load().then(function (clientNotification) {
        if (clientNotification.hasValue('rdf:value', individual)) {
          notifyAction.addClass('disabled').attr('disabled', 'disabled');
        } else {
          notifyAction.removeClass('disabled').removeAttr('disabled');
        }
        notifyAction.click(function () {
          try {
            const newsLinks = clientNotification['rdf:value'];
            newsLinks.unshift(individual);
            clientNotification['rdf:value'] = newsLinks.slice(0, 5);
            clientNotification.save();

            // Устанавливаем статус Исполнение
            individual['v-s:hasStatus'] = [new IndividualModel('v-s:StatusExecution')];
            individual.save();
            
            notifyAction.addClass('disabled').attr('disabled', 'disabled');
          } catch (error) {
            notify('danger', {name: error});
          }
        });
      });
    }
  });
};

export const html = `
  <div class="container">
    <div class="sheet">
      <em about="v-s:title" property="rdfs:label" class="-view edit search"></em>
      <h3 about="@" property="v-s:title" class="margin-md view -edit -search"></h3>
      <veda-control data-type="augmentedText" property="v-s:title" class="-view edit search"></veda-control>
      <em about="v-s:description" property="rdfs:label" class="-view edit search"></em>
      <i about="@" property="v-s:description" class="markdown view -edit -search"></i>
      <veda-control data-type="augmentedText" rows="3" property="v-s:description" class="-view edit search"></veda-control>
      <em about="v-s:content" property="rdfs:label" class="-view edit search"></em>
      <div about="@" property="v-s:content" class="markdown view -edit -search"></div>
      <veda-control data-type="augmentedText" rows="10" property="v-s:content" class="-view edit search"></veda-control>
      <div about="@" rel="v-s:attachment" data-template="v-ui:FileTemplate" data-embedded="true"></div>
      <veda-control data-type="file" property="v-s:attachment" class="-view edit search"></veda-control>

      <div class="dates-block">
        <em about="v-s:dateFrom" property="rdfs:label" class="-view edit search"></em>
        <div about="@" property="v-s:dateFrom" class="view -edit -search"></div>
        <veda-control data-type="dateTime" property="v-s:dateFrom" class="-view edit search" required></veda-control>

        <em about="v-s:dateTo" property="rdfs:label" class="-view edit search"></em>
        <div about="@" property="v-s:dateTo" class="view -edit -search"></div>
        <veda-control data-type="dateTime" property="v-s:dateTo" class="-view edit search" required></veda-control>
      </div>

      <div class="status-block">
        <em about="v-s:hasStatus" property="rdfs:label" class="view edit -search"></em>
        <div about="@" rel="v-s:hasStatus" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
        <veda-control data-type="link" rel="v-s:hasStatus" class="-view edit -search"></veda-control>
      </div>

      <div class="script">
        <em about="v-s:script" property="rdfs:label" class="view edit -search"></em>
        <pre about="@" property="v-s:script" class="markdown view -edit -search"></pre>
        <veda-control data-type="source" rows="10" property="v-s:script" class="-view edit -search"></veda-control>
      </div>
      <div class="audience">
        <em about="v-s:newsAudience" property="rdfs:label" class="view edit search"></em>
        <div rel="v-s:newsAudience" data-template="v-ui:LabelLinkTemplate" class="view edit search"></div>
        <veda-control data-type="link" rel="v-s:newsAudience" class="-view edit search dropdown fulltext"></veda-control>
      </div>
      <div class="actions margin-lg">
        <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
        <button class="btn btn-warning view -edit -search notify-action" about="v-s:NotifyBundle" property="rdfs:label"></button>
        <a
          class="btn btn-default view -edit -search"
          href="#/cfg:ClientNotification//v-s:ClientNotificationTemplate"
          about="v-s:AllNotificationsBundle"
          property="rdfs:label"></a>
      </div>
    </div>
    <!--div about="@" class="sheet view -edit -search" data-template="v-s:CommentsTemplate"></div-->
  </div>
`;
