import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';
import Notify from '/js/browser/notify.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var startFormContainer = $('.groupStartForm', template);
  startFormContainer.empty();

  var startForm = new IndividualModel();
  startForm['rdf:type'] = [new IndividualModel('v-df:TaskRouteStartForm')];
  startForm['v-wf:forNet'] = [new IndividualModel('s-wf:WrapUniversalNet')];
  startForm['v-wf:useTransformation'] = [new IndividualModel('v-df:TaskRouteStartFormToNet')];
  startForm['v-wf:StartForm_setStatus'] = [true];
  startForm['v-wf:StartForm_canEdit'] = [false];
  return startForm.present(startFormContainer, 'v-df:TaskRouteStartFormTemplate', 'edit').then(function (startFormTemplate) {
    $('.action#send', startFormTemplate)
      .off('click')
      .click(function () {
        var savingPromises = individual['v-s:data'].map(function (doc) {
          startForm.clone().then(function (clonedStartForm) {
            clonedStartForm['v-wf:hasStatusWorkflow'] = [new IndividualModel('v-wf:ToBeSent')];
            clonedStartForm['v-wf:processedDocument'] = [doc];
            return clonedStartForm.save();
          });
        });
        return Promise.all(savingPromises)
          .then(function () {
            var successMsg = new IndividualModel('v-s:SuccessBundle').load();
            return successMsg.then(function (successMsg) {
              var notify = Notify ? new Notify() : function () {};
              notify('success', { name: successMsg });
            });
          })
          .catch(function (error) {
            console.log(error);
            var errorMsg = new IndividualModel('v-s:ErrorBundle').load();
            return errorMsg.then(function (errorMsg) {
              var notify = Notify ? new Notify() : function () {};
              notify('danger', { name: errorMsg });
            });
          })
          .then(function () {
            startFormContainer.closest('.modal').modal('hide');
            var documentsSearch = new IndividualModel('v-s:DocumentsSearch');
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
