import $ from 'jquery';
import veda from '/js/common/veda.js';
import notify from '/js/browser/notify.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('v-s:creator', veda.appointment || veda.user)) {
    $('.action.save-create', template).click(function () {
      const enterLabel = new IndividualModel('v-s:EnterLabel');
      enterLabel.load().then(function (enterLabel) {
        const personalLabel = prompt(enterLabel.toString(), individual.toString());
        if (!personalLabel) {
          return;
        }
        individual
          .clone()
          .then(function (personalCreate) {
            personalCreate['rdf:type'] = [new IndividualModel('v-fc:PersonalCreate')];
            personalCreate['v-s:creator'] = [];
            personalCreate['v-s:created'] = [];
            personalCreate['rdfs:isDefinedBy'] = [];
            personalCreate['rdfs:label'] = [personalLabel];
            const createBlank = individual.hasValue('v-fc:hasBlank') ? individual['v-fc:hasBlank'][0] : undefined;
            if (createBlank && createBlank.object) {
              return createBlank
                .clone()
                .then(function (personalCreateBlank) {
                  personalCreateBlank.object = createBlank.object;
                  return personalCreateBlank.updateBlank();
                })
                .then(function (personalCreateBlank) {
                  personalCreate['v-fc:hasBlank'] = [personalCreateBlank];
                  return personalCreate.save();
                });
            } else {
              return personalCreate.save();
            }
          })
          .then(function (personalCreate) {
            return veda.user.aspect.load().then(function (aspect) {
              aspect.addValue('v-s:hasCreate', personalCreate);
              return aspect.save();
            });
          })
          .then(function () {
            return new IndividualModel('v-fc:BlankSuccessfullySaved').load();
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
    $('.action.save-create', template).remove();
  }

  individual.rights.then(function (rights) {
    if (rights.hasValue('v-s:canUpdate', true)) {
      $('.action.update-create', template).click(function () {
        const createBlank = individual.hasValue('v-fc:hasBlank') ? individual['v-fc:hasBlank'][0] : undefined;
        if (createBlank && createBlank.object) {
          createBlank
            .updateBlank()
            .then(function () {
              return new IndividualModel('v-fc:BlankSuccessfullyUpdated').load();
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
      $('.action.update-create', template).remove();
    }
    if (rights.hasValue('v-s:canDelete', true)) {
      $('.action.delete-create', template).click(function () {
        veda.user.aspect
          .load()
          .then(function (aspect) {
            aspect.removeValue('v-s:hasCreate', individual);
            return aspect.save();
          })
          .then(function () {
            return individual.delete();
          })
          .then(function () {
            return new IndividualModel('v-fc:BlankSuccessfullyDeleted').load();
          })
          .then(function (message) {
            notify('success', {message: message});
          })
          .catch(function (error) {
            notify('danger', {message: error});
          });
      });
    } else {
      $('.action.delete-create', template).remove();
    }
  });
};

export const html = `
  <div>
    <div class="container sheet">
      <div class="ribbon-wrapper top-left">
        <div class="ribbon top-left success" about="v-fc:CreateBundle" property="rdfs:label"></div>
      </div>
      <div class="actions text-right">
        <button class="action save-create btn btn-success" about="v-fc:SavePersonalBlank" property="rdfs:label"></button>
        <button class="action update-create btn btn-success" about="v-fc:UpdatePersonalBlank" property="rdfs:label"></button>
        <button class="action delete-create btn btn-link" about="v-s:Delete" property="rdfs:label"></button>
      </div>
    </div>
    <div about="@" rel="v-fc:hasBlank" data-template="v-fc:BlankTemplate"></div>
  </div>
`;
