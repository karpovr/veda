import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('#add-comment', template).click(function () {
    const addComment = $(this).hide();
    const _class = new IndividualModel('v-s:Comment');
    const comment = new IndividualModel();
    const cntr = $('#new-comment', template).empty();
    const tmpl = 'v-s:SingleCommentTemplate';
    comment['rdf:type'] = [_class];
    comment['v-s:backwardTarget'] = [individual];
    comment['v-s:backwardProperty'] = [new IndividualModel('v-s:hasComment')];
    comment['v-s:commentedResource'] = individual;
    comment['v-s:canRead'] = [true];
    comment.present(cntr, tmpl, 'edit');
    comment.one('afterSave beforeReset', function () {
      addComment.show();
      cntr.empty();
    });
  });

  template.on('click', '#reply.action', function (e) {
    e.preventDefault();
    const commentTemplate = $(this).closest('[resource]');
    const inReplyComment = new IndividualModel(commentTemplate.attr('resource'));
    const cntr = $('#new-reply', commentTemplate).first().empty();
    const tmpl = 'v-s:SingleCommentTemplate';
    const reply = new IndividualModel();
    reply['rdf:type'] = 'v-s:Comment';
    reply['v-s:backwardTarget'] = inReplyComment;
    reply['v-s:backwardProperty'] = 'v-s:hasComment';
    reply['v-s:commentedResource'] = individual;
    reply['v-s:canRead'] = true;
    reply.present(cntr, tmpl, 'edit');
    reply.one('afterSave beforeReset', function () {
      cntr.empty();
    });
  });

  template.on('click', '#edit-comment.action', function (e) {
    e.preventDefault();
    const tmpl = 'v-s:SingleCommentTemplate';
    const commentTemplate = $(this).closest('[resource]');
    const comment = new IndividualModel(commentTemplate.attr('resource'));
    const cntr = $('#new-reply', commentTemplate).first().empty();
    const commentContent = $('#comment-content', commentTemplate).hide();
    comment.present(cntr, tmpl, 'edit');
    comment.one('afterSave beforeReset', function () {
      commentContent.show();
      cntr.empty();
    });
  });
};

export const html = `
  <div>
    <h3 about="v-s:Comments" property="rdfs:label"></h3>
    <div about="@" rel="v-s:hasComment" data-template="v-s:RecursiveCommentTemplate"></div>
    <div id="new-comment"></div>
    <button class="margin-sm btn btn-success pull-right" id="add-comment" about="v-s:AddComment" property="rdfs:label"></button>
  </div>
`;
