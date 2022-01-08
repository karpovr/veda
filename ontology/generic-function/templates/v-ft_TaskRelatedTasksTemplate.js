import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var relatedTasks = new IndividualModel('v-ft:RelatedTasks');
  return relatedTasks.load().then(function (relatedTasks) {
    relatedTasks.clearValue('v-fs:searchResult');
    var taskId = individual.id;
    var docId = individual.hasValue('v-wf:onDocument') && individual['v-wf:onDocument'][0].id;
    var queryStr = ["'@' != '" + taskId + "'", "'v-wf:onDocument' == '" + docId + "'", "'rdf:type'==='v-wf:DecisionForm'", "'v-wf:isCompleted'== false "].join(
      ' && ',
    );
    relatedTasks['v-fs:fulltextQuery'] = [queryStr];
  });
};

export const html = `
  <div>
    <div about="v-ft:RelatedTasks" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
  </div>
`;
