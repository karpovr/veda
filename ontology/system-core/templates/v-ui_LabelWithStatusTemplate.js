import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('rdfs:label')) {
    template.text(individual.id);
  }
  let done;
  let initPopoverTimeout;
  const type = individual.hasValue('rdf:type') && individual['rdf:type'][0].id;
  if (type === 'v-s:Appointment' || type === 'v-s:Person' || type === 'v-s:Position' || type === 'v-s:Organization') {
    template
      .css('cursor', 'help')
      .click(function () {
        if (done) return;
        initPopover();
      })
      .one('remove', function () {
        template.popover('destroy');
      });
  }

  function initPopover () {
    const cntr = $('<div></div>');
    let tmpl;
    if (type === 'v-s:Appointment') {
      tmpl = 'v-ui:AppointmentPopoverTemplate';
    } else if (type === 'v-s:Person') {
      tmpl = 'v-ui:PersonPopoverTemplate';
    } else if (type === 'v-s:Organization') {
      tmpl = 'v-ui:OrganizationPopoverTemplate';
    } else {
      tmpl = 'v-ui:PositionPopoverTemplate';
    }
    individual.present(cntr, tmpl).then(function () {
      done = true;
      template
        .popover({
          trigger: 'click',
          placement: 'auto bottom',
          html: true,
          container: $('div#main'),
          content: cntr,
        })
        .click();
      cntr.on('click', '.close', function (e) {
        e.stopPropagation();
        template.click();
      });
    });
  };
};

export const html = `
  <div>
    <span class="label-template" about="@" property="rdfs:label"></span>
    <span about="@" rel="v-s:hasVisualStatus"></span>
  </div>
`;
