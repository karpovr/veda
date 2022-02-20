import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import notify from '/js/browser/notify.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const startFormContainer = $('.groupStartForm', template);
  startFormContainer.empty();

  const startForm = new IndividualModel();
  startForm['rdf:type'] = [new IndividualModel('v-df:TaskRouteStartForm')];
  startForm['v-wf:forNet'] = [new IndividualModel('s-wf:WrapUniversalNet')];
  startForm['v-wf:useTransformation'] = [new IndividualModel('v-df:TaskRouteStartFormToNet')];
  startForm['v-wf:StartForm_setStatus'] = [true];
  startForm['v-wf:StartForm_canEdit'] = [false];
  return startForm.present(startFormContainer, 'v-df:TaskRouteStartFormTemplate', 'edit').then(function (startFormTemplate) {
    $('.action#send', startFormTemplate)
      .off('click')
      .click(function () {
        const savingPromises = individual['v-s:data'].map(function (doc) {
          startForm.clone().then(function (clonedStartForm) {
            clonedStartForm['v-wf:hasStatusWorkflow'] = [new IndividualModel('v-wf:ToBeSent')];
            clonedStartForm['v-wf:processedDocument'] = [doc];
            return clonedStartForm.save();
          });
        });
        return Promise.all(savingPromises)
          .then(function () {
            const successMsg = new IndividualModel('v-s:SuccessBundle').load();
            return successMsg.then(function (successMsg) {
              notify('success', {name: successMsg});
            });
          })
          .catch(function (error) {
            console.log(error);
            const errorMsg = new IndividualModel('v-s:ErrorBundle').load();
            return errorMsg.then(function (errorMsg) {
              notify('danger', {name: errorMsg});
            });
          })
          .then(function () {
            startFormContainer.closest('.modal').modal('hide');
            const documentsSearch = new IndividualModel('v-s:DocumentsSearch');
            documentsSearch.clearValue('v-fs:selected');
          });
      });
  });
};

export const html = `
  <div class="container sheet">
    <div class="groupStartForm"></div>
  </div>
`;
