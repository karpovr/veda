import $ from 'jquery';
import veda from '/js/common/veda.js';
import Notify from '/js/browser/notify.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const notify = new Notify();

  if (!individual.hasValue('v-s:creator', veda.appointment || veda.user)) {
    $('.action.save-report', template).click(function () {
      const enterLabel = new IndividualModel('v-s:EnterLabel');
      enterLabel.load().then(function (enterLabel) {
        const personalLabel = prompt(enterLabel.toString(), individual.toString());
        if (!personalLabel) {
          return;
        }
        individual
          .clone()
          .then(function (personalReport) {
            personalReport['rdf:type'] = [new IndividualModel('v-s:PersonalReport')];
            personalReport['v-s:creator'] = [];
            personalReport['v-s:created'] = [];
            personalReport['rdfs:isDefinedBy'] = [];
            personalReport['rdfs:label'] = [personalLabel];
            const reportBlank = individual.hasValue('v-s:reportBlank') ? individual['v-s:reportBlank'][0] : undefined;
            if (reportBlank && reportBlank.object) {
              return reportBlank
                .clone()
                .then(function (personalReportBlank) {
                  personalReportBlank.object = reportBlank.object;
                  return personalReportBlank.updateBlank();
                })
                .then(function (personalReportBlank) {
                  personalReport['v-s:reportBlank'] = [personalReportBlank];
                  return personalReport.save();
                });
            } else {
              return personalReport.save();
            }
          })
          .then(function (personalReport) {
            veda.user.aspect.load().then(function (aspect) {
              aspect.addValue('v-s:hasReport', personalReport);
              return aspect.save();
            });
          })
          .then(function () {
            return new IndividualModel('v-s:ReportSuccessfullySaved').load();
          })
          .then(function (message) {
            notify('success', {message: message});
          })
          .catch(function (error) {
            notify('danger', {message: error});
          });
      });
    });
  } else {
    $('.action.save-report', template).remove();
  }

  individual.rights.then(function (rights) {
    if (rights.hasValue('v-s:canUpdate', true)) {
      $('.action.update-report', template).click(function () {
        const reportBlank = individual.hasValue('v-s:reportBlank') ? individual['v-s:reportBlank'][0] : undefined;
        if (reportBlank && reportBlank.object) {
          reportBlank
            .updateBlank()
            .then(function () {
              return new IndividualModel('v-s:ReportSuccessfullyUpdated').load();
            })
            .then(function (message) {
              notify('success', {message: message});
            })
            .catch(function (error) {
              notify('danger', {message: error});
            });
        }
      });
    } else {
      $('.action.update-report', template).remove();
    }

    if (rights.hasValue('v-s:canDelete', true)) {
      $('.action.delete-report', template).click(function () {
        veda.user.aspect
          .load()
          .then(function (aspect) {
            aspect.removeValue('v-s:hasReport', individual);
            return aspect.save();
          })
          .then(function () {
            return individual.delete();
          })
          .then(function () {
            return new IndividualModel('v-s:ReportSuccessfullyDeleted').load();
          })
          .then(function (message) {
            return notify('success', {message: message});
          })
          .catch(function (error) {
            notify('danger', {message: error});
          });
      });
    } else {
      $('.action.delete-report', template).remove();
    }
  });
};

export const html = `
  <div>
    <div class="container sheet">
      <div class="ribbon-wrapper top-left">
        <div class="ribbon top-left warning" about="v-s:Report" property="rdfs:label"></div>
      </div>
      <div class="actions text-right">
        <button class="action save-report btn btn-warning" about="v-s:SavePersonalReport" property="rdfs:label"></button>
        <button class="action update-report btn btn-warning" about="v-s:UpdatePersonalReport" property="rdfs:label"></button>
        <button class="action delete-report btn btn-link" about="v-s:Delete" property="rdfs:label"></button>
      </div>
    </div>
    <div class="margin-lg" about="@" data-template="v-s:ReportTemplate"></div>
  </div>
`;
