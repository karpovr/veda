import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const actions = $('#edit-comment, #delete', template);
  individual.rights.then(function (rights) {
    if (!rights.hasValue('v-s:canUpdate', true)) {
      actions.remove();
    }
  });

  $('.action', template).click(function (e) {
    e.preventDefault();
    const actionId = this.id;
    const warning = new IndividualModel('v-s:AreYouSure');
    warning.load().then(function (warning) {
      warning = warning['rdfs:label'].map(CommonUtil.formatValue).join(' ');
      if (actionId === 'delete' && !confirm(warning)) {
        return;
      }
      template[0].dispatchEvent(new Event(actionId));
    });
  });

  individual.on('v-s:hasComment', commentHandler);
  individual.on('v-s:linkedObject', linkedHandler);
  template.one('remove', function () {
    individual.off('v-s:hasComment', commentHandler);
    individual.off('v-s:linkedObject', linkedHandler);
  });
  commentHandler(individual['v-s:hasComment']);
  linkedHandler(individual['v-s:linkedObject']);

  function commentHandler (values) {
    values.length ? actions.hide() : actions.show();
  }
  function linkedHandler (values) {
    values.length ? $('.linked-object', template).show() : $('.linked-object', template).hide();
  }
};

export const html = `
  <div class="media" style="overflow:initial;">
    <div class="media-body" style="overflow:initial;">
      <div id="comment-content">
        <div>
          <span rel="v-s:creator">
            <span>
              <strong rel="v-s:employee" data-template="v-ui:LabelTemplate"></strong>
              <small rel="v-s:occupation" data-template="v-ui:LabelTemplate"></small>
            </span>
          </span>
          <small>
            <span>&bullet;&nbsp;&nbsp;</span>
            <span property="v-s:created"></span>
          </small>
          <br />
          <span property="rdfs:label"></span>
        </div>
        <div rel="v-s:attachment" data-template="v-ui:FileTemplate"></div>
        <div class="linked-object">
          <em about="v-s:linkedObject" property="rdfs:label"></em>
          <ul rel="v-s:linkedObject">
            <li about="@" data-template="v-ui:ClassNameLabelLinkTemplate"></li>
          </ul>
        </div>
        <small>
          <a href="#" id="reply" class="action" about="v-s:Reply" property="rdfs:label"></a>
          &nbsp;
          <a href="#" id="edit-comment" class="action" about="v-s:Edit" property="rdfs:label"></a>
          &nbsp;
          <a href="#" id="delete" class="action" about="v-s:Delete" property="rdfs:label"></a>
        </small>
      </div>
      <div id="new-reply"></div>
      <hr class="margin-sm" />
      <div class="row">
        <div class="col-sm-1 col-xs-1"></div>
        <div class="col-sm-11 col-xs-11">
          <div about="@" rel="v-s:hasComment" data-template="v-s:RecursiveCommentTemplate"></div>
        </div>
      </div>
    </div>
  </div>
`;
