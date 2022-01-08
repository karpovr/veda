import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var self = this;
  function setRegistrationDate() {
    if (this.hasValue('rdf:type', 'v-s:LetterRegistrationRecordEnumerated') && !this.hasValue('v-s:registrationNumber')) {
      var today = new Date();
      const d = today.getDate();
      const m = today.getMonth();
      const y = today.getFullYear();
      today.setUTCFullYear(y, m, d);
      today.setUTCHours(0, 0, 0, 0);
      individual['v-s:registrationDate'] = [today];
    }
  }
  this.on('beforeSave', setRegistrationDate);
  template.one('remove', function () {
    self.off('beforeSave', setRegistrationDate);
  });

  if (mode === 'edit' || template.data('mode') === 'edit') {
    individual.on('rdf:type', typeHandler);
    template.one('remove', function () {
      individual.off('rdf:type', typeHandler);
    });
    typeHandler.call(this);
  }

  function typeHandler() {
    this.is('v-s:LetterRegistrationRecordEnumerated').then(function (isEnumerated) {
      if (isEnumerated) {
        var autoBundle = new IndividualModel('v-s:AutomaticallyBundle');
        autoBundle.load().then(function (autoBundle) {
          $('input, textarea', template).attr('placeholder', autoBundle['rdfs:label'].map(CommonUtil.formatValue).join(' '));
        });
      } else {
        var manualBundle = new IndividualModel('v-s:ManuallyBundle');
        manualBundle.load().then(function (manualBundle) {
          $('input, textarea', template).attr('placeholder', manualBundle['rdfs:label'].map(CommonUtil.formatValue).join(' '));
        });
      }
    });
  }

  if (container.attr('rel') === 'v-s:hasLetterRegistrationRecordSender') {
    template.addClass('panel-info');
    template.children(':first').addClass('bg-info');
  } else if (container.attr('rel') === 'v-s:hasLetterRegistrationRecordRecipient') {
    template.addClass('panel-success');
    template.children(':first').addClass('bg-success');
  }
};

export const html = `
  <div class="panel">
    <div class="panel-body">
      <div class="row">
        <div class="col-sm-6">
          <em about="v-s:registrationNumber" property="rdfs:label"></em>
          <div property="v-s:registrationNumber" class="view -edit -search"></div>
          <veda-control property="v-s:registrationNumber" data-type="text" class="-view edit search"></veda-control>
        </div>
        <div class="col-sm-6">
          <em about="v-s:registrationDate" property="rdfs:label"></em>
          <div property="v-s:registrationDate" class="view -edit search"></div>
          <veda-control property="v-s:registrationDate" data-type="date" class="-view edit search"></veda-control>
        </div>
      </div>
    </div>
  </div>
`;
