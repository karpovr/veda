import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const relatedTasks = new IndividualModel('v-ft:RelatedTasks');
  return relatedTasks.load().then(function (relatedTasks) {
    relatedTasks.clearValue('v-fs:searchResult');
    const taskId = individual.id;
    const docId = individual.hasValue('v-wf:onDocument') && individual['v-wf:onDocument'][0].id;
    const queryStr = ["'@' != '" + taskId + "'", "'v-wf:onDocument' == '" + docId + "'", "'rdf:type'==='v-wf:DecisionForm'", "'v-wf:isCompleted'== false "].join(
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
